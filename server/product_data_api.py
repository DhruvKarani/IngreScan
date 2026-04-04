#!/usr/bin/env python3   125
"""
Product Data Orchestrator API

FastAPI endpoint that orchestrates multi-source product data fetching.

Waterfall Logic:
1. Try OpenFoodFacts (largest database)
2. If no usable data, try Edamam (professional data)
3. If still no data, try FatSecret (user-submitted)
4. Validate and merge results
5. Return best data with metadata

Endpoints:
- GET /api/product/{barcode} - Fetch product by barcode
- GET /api/product/{barcode}/sources - Get data from all sources
- GET /health - Health check
- GET /docs - Interactive API documentation (Swagger UI)

Usage:
    python product_data_api.py
    # Server runs on http://localhost:5001
    # API docs at http://localhost:5001/docs
"""

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import logging
from typing import Dict, Optional, Any, List
import sys
import os

# Add current directory to path for imports
sys.path.append(os.path.dirname(__file__))

from api_fetchers import fetch_from_firebase, fetch_from_off, fetch_from_edamam, fetch_from_fatsecret
from data_merger import DataMerger
from data_quality_validator import validate_product_data, is_usable_data
from score_api import (
    analyze_legacy_product,
    calculate_ml_score_payload,
    calculate_personalized_score_payload,
    get_scoring_health,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Product Data Orchestrator",
    description="Multi-source product data fetching with waterfall fallback",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for React Native app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
API_VERSION = "1.0.0"
DEFAULT_PORT = 5001


# =============================================================================
# PYDANTIC MODELS (for automatic API documentation)
# =============================================================================

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    ml_available: bool
    personalized_scoring_available: bool
    endpoints: Dict[str, str]

class ProductMetadata(BaseModel):
    sources_tried: List[str]
    sources_used: List[str]
    completeness_score: int
    confidence: str
    needs_verification: bool
    missing_fields: List[str]
    primary_source: Optional[str] = None
    source_contributions: Optional[Dict[str, List[str]]] = None

class ProductResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]]
    error: Optional[str]
    metadata: Dict[str, Any]

class SourceInfo(BaseModel):
    name: str
    full_name: str
    description: str
    coverage: str
    priority: int
    status: Optional[str] = None

class SourcesListResponse(BaseModel):
    sources: List[SourceInfo]


class ProductDataOrchestrator:
    """
    Orchestrates multi-source product data fetching with waterfall fallback.
    """
    
    # Source fetch order (priority)
    # Firebase FIRST - it has verified user data with highest trust
    FETCH_ORDER = [
        ('Firebase', fetch_from_firebase),
        ('OFF', fetch_from_off),
        ('Edamam', fetch_from_edamam),
        ('FatSecret', fetch_from_fatsecret)
    ]
    
    def __init__(self):
        self.merger = DataMerger()
    
    def fetch_product(self, barcode: str, merge_strategy: str = 'waterfall') -> Dict[str, Any]:
        """
        Fetch product data using waterfall fallback strategy.
        
        Args:
            barcode: Product barcode
            merge_strategy: 'waterfall' (default) or 'smart'
        
        Returns:
            {
                'success': bool,
                'data': product_dict or None,
                'error': error_message or None,
                'metadata': {
                    'sources_tried': [...],
                    'sources_used': [...],
                    'completeness_score': int,
                    'needs_verification': bool,
                    ...
                }
            }
        """
        if not barcode or not str(barcode).strip():
            return {
                'success': False,
                'data': None,
                'error': 'Invalid barcode: empty or null',
                'metadata': {}
            }
        
        barcode = str(barcode).strip()
        logger.info(f"Fetching product {barcode} (strategy: {merge_strategy})")
        
        # Fetch from all sources
        fetch_results = []
        
        for source_name, fetch_func in self.FETCH_ORDER:
            try:
                product_data = fetch_func(barcode)
                fetch_results.append((source_name, product_data))
            except Exception as e:
                logger.error(f"Error fetching from {source_name}: {e}")
                fetch_results.append((source_name, None))
        
        # Merge results based on strategy
        if merge_strategy == 'smart':
            merged_data = self.merger.smart_merge(fetch_results)
        else:  # waterfall (default)
            merged_data = self.merger.waterfall_merge(fetch_results)
        
        if not merged_data:
            return {
                'success': False,
                'data': None,
                'error': 'Product not found in any database',
                'metadata': {
                    'sources_tried': [name for name, _ in fetch_results],
                    'sources_used': [],
                    'completeness_score': 0
                }
            }
        
        # Success!
        return {
            'success': True,
            'data': merged_data,
            'error': None,
            'metadata': merged_data.get('_metadata', {})
        }
    
    def fetch_all_sources(self, barcode: str) -> Dict[str, Any]:
        """
        Fetch product data from all sources (for comparison).
        
        Args:
            barcode: Product barcode
        
        Returns:
            {
                'success': bool,
                'sources': {
                    'OFF': {...},
                    'Edamam': {...},
                    'FatSecret': {...}
                },
                'comparison': {...}
            }
        """
        if not barcode or not str(barcode).strip():
            return {
                'success': False,
                'sources': {},
                'error': 'Invalid barcode: empty or null'
            }
        
        barcode = str(barcode).strip()
        logger.info(f"Fetching product {barcode} from ALL sources")
        
        sources = {}
        validations = {}
        
        for source_name, fetch_func in self.FETCH_ORDER:
            try:
                product_data = fetch_func(barcode)
                
                if product_data:
                    validation = validate_product_data(product_data)
                    sources[source_name] = product_data
                    validations[source_name] = validation
                else:
                    sources[source_name] = None
                    validations[source_name] = None
                    
            except Exception as e:
                logger.error(f"Error fetching from {source_name}: {e}")
                sources[source_name] = None
                validations[source_name] = {'error': str(e)}
        
        # Compare sources
        comparison = self._compare_sources(sources, validations)
        
        return {
            'success': any(sources.values()),
            'sources': sources,
            'validations': validations,
            'comparison': comparison
        }
    
    def _compare_sources(self, sources: Dict, validations: Dict) -> Dict:
        """
        Compare data from different sources.
        
        Returns:
            {
                'available_sources': [...],
                'completeness_scores': {...},
                'recommended_source': str,
                'discrepancies': {...}
            }
        """
        available = [name for name, data in sources.items() if data]
        
        scores = {
            name: val['completeness_score'] 
            for name, val in validations.items() 
            if val and 'completeness_score' in val
        }
        
        recommended = max(scores.items(), key=lambda x: x[1])[0] if scores else None
        
        # TODO: Detect discrepancies (different values for same field)
        
        return {
            'available_sources': available,
            'completeness_scores': scores,
            'recommended_source': recommended,
            'discrepancies': {}  # TODO: Implement
        }


# Initialize orchestrator
orchestrator = ProductDataOrchestrator()

@app.get('/', tags=["Root"])
async def root():
    """
    Root endpoint - redirects to interactive API documentation.
    """
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url='/docs')


@app.get('/health', response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Health check endpoint to verify API is running.
    
    Returns status, service name, and version.
    """
    scoring_health = get_scoring_health()
    return {
        'status': 'healthy',
        'service': 'Product Data Orchestrator + Scoring',
        'version': API_VERSION,
        'ml_available': scoring_health['ml_available'],
        'personalized_scoring_available': scoring_health['personalized_scoring_available'],
        'endpoints': scoring_health['endpoints'],
    }


@app.get('/api/product/{barcode}', response_model=ProductResponse, tags=["Products"])
async def get_product(
    barcode: str,
    strategy: str = Query('waterfall', description="Merge strategy: 'waterfall' or 'smart'")
):
    """
    Fetch product data using waterfall/smart merge strategy.
    
    **Waterfall Strategy (default):**
    - Try sources in priority order
    - Return first usable data
    
    **Smart Strategy:**
    - Fetch from all sources
    - Merge best fields from each
    
    **Parameters:**
    - **barcode**: Product barcode number
    - **strategy**: 'waterfall' (default) or 'smart'
    
    **Returns:**
    - Product data with completeness metadata
    - 404 if not found in any database
    """
    result = orchestrator.fetch_product(barcode, merge_strategy=strategy)
    
    if not result['success']:
        raise HTTPException(status_code=404, detail=result['error'])
    
    return result


@app.get('/api/product/{barcode}/sources', tags=["Products"])
async def get_product_all_sources(barcode: str):
    """
    Fetch product data from ALL sources for comparison.
    
    Useful for debugging and comparing data quality across sources.
    
    **Parameters:**
    - **barcode**: Product barcode number
    
    **Returns:**
    - Data from each source (OFF, Edamam, FatSecret)
    - Validation scores for each source
    - Comparison summary with recommended source
    """
    result = orchestrator.fetch_all_sources(barcode)
    
    if not result['success']:
        raise HTTPException(status_code=404, detail="Product not found in any database")
    
    return result


@app.get('/api/sources', response_model=SourcesListResponse, tags=["Sources"])
async def list_sources():
    """
    List all available data sources with priorities.
    
    Shows which APIs are configured and their priority order.
    """
    sources = [
        {
            'name': 'OFF',
            'full_name': 'OpenFoodFacts',
            'description': 'Largest open food database',
            'coverage': 'Global (best for Indian products)',
            'priority': 1
        },
        {
            'name': 'Edamam',
            'full_name': 'Edamam Food Database',
            'description': 'Professional nutrition data',
            'coverage': 'Global (UPC/barcode lookup)',
            'priority': 2,
            'status': 'placeholder'  # TODO: Implement
        },
        {
            'name': 'FatSecret',
            'full_name': 'FatSecret Platform',
            'description': 'User-submitted nutrition data',
            'coverage': 'Global (fitness-focused)',
            'priority': 3,
            'status': 'placeholder'  # TODO: Implement
        }
    ]
    
    return {'sources': sources}


@app.post('/analyze', tags=["Scoring"])
async def analyze_product(payload: Dict[str, Any]):
    try:
        return analyze_legacy_product(payload)
    except ValueError as exc:
        return JSONResponse(status_code=400, content={'error': str(exc)})
    except LookupError as exc:
        return JSONResponse(status_code=404, content={'error': str(exc)})
    except Exception as exc:
        logging.exception('Scoring failed')
        return JSONResponse(status_code=500, content={'error': 'scoring_failed', 'message': str(exc)})


@app.post('/ml-score', tags=["Scoring"])
async def ml_score(payload: Dict[str, Any]):
    try:
        return calculate_ml_score_payload(payload)
    except ValueError as exc:
        return JSONResponse(status_code=400, content={'error': str(exc)})
    except RuntimeError as exc:
        message = str(exc)
        if message == 'ML scoring not available':
            return JSONResponse(status_code=503, content={'error': message})
        logging.exception('ML scoring failed')
        return JSONResponse(status_code=500, content={'error': 'ml_scoring_failed', 'message': message})


@app.post('/personalized-score', tags=["Scoring"])
async def personalized_score(payload: Dict[str, Any]):
    try:
        return calculate_personalized_score_payload(payload)
    except ValueError as exc:
        return JSONResponse(status_code=400, content={'error': str(exc)})
    except RuntimeError as exc:
        message = str(exc)
        if message == 'Personalized scoring not available':
            return JSONResponse(status_code=503, content={'error': message})
        logging.exception('Personalized scoring failed')
        return JSONResponse(status_code=500, content={'error': 'personalized_scoring_failed', 'message': message})


# =============================================================================
# MAIN
# =============================================================================

if __name__ == '__main__':
    import uvicorn
    import argparse
    
    parser = argparse.ArgumentParser(description='Product Data Orchestrator API')
    parser.add_argument('--port', type=int, default=DEFAULT_PORT, help=f'Port to run on (default: {DEFAULT_PORT})')
    parser.add_argument('--reload', action='store_true', help='Enable auto-reload on code changes')
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind to (default: 0.0.0.0)')
    
    args = parser.parse_args()
    
    print("=" * 70)
    print("🚀 Product Data Orchestrator API (FastAPI)")
    print("=" * 70)
    print(f"Version: {API_VERSION}")
    print(f"Host: {args.host}")
    print(f"Port: {args.port}")
    print(f"Auto-reload: {args.reload}")
    print()
    print("📚 API Documentation:")
    print(f"  - Swagger UI: http://{args.host if args.host != '0.0.0.0' else 'localhost'}:{args.port}/docs")
    print(f"  - ReDoc: http://{args.host if args.host != '0.0.0.0' else 'localhost'}:{args.port}/redoc")
    print()
    print("🔗 Available Endpoints:")
    print(f"  - GET /health")
    print(f"  - GET /api/product/{{barcode}}")
    print(f"  - GET /api/product/{{barcode}}/sources")
    print(f"  - GET /api/sources")
    print("=" * 70)
    print()
    
    uvicorn.run(
        "product_data_api:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info"
    )
