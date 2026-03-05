#!/usr/bin/env python3
"""
Edamam Nutrition API Fetcher

Fetches product nutrition data from Edamam API.
Requires API key and App ID from https://developer.edamam.com/

SETUP REQUIRED:
1. Sign up at https://developer.edamam.com/
2. Get Food Database API credentials (free tier: 100 requests/month)
3. Set environment variables:
   - EDAMAM_APP_ID=your_app_id
   - EDAMAM_APP_KEY=your_api_key
"""

import requests
import os
from typing import Dict, Optional, Any
import logging

logger = logging.getLogger(__name__)

# Edamam API configuration
EDAMAM_API_BASE = "https://api.edamam.com/api/food-database/v2"
EDAMAM_TIMEOUT = 10  # seconds

# API credentials (from environment variables)
EDAMAM_APP_ID = os.environ.get('EDAMAM_APP_ID', '')
EDAMAM_APP_KEY = os.environ.get('EDAMAM_APP_KEY', '')


def fetch_from_edamam(barcode: str) -> Optional[Dict[str, Any]]:
    """
    Fetch product data from Edamam Food Database API.
    
    API Endpoint: GET /parser
    Query param: upc={barcode}
    
    Args:
        barcode: Product barcode/UPC
    
    Returns:
        Normalized product dictionary or None if not found/error
    """
    # TODO: Implement API key check
    if not EDAMAM_APP_ID or not EDAMAM_APP_KEY:
        logger.warning("Edamam: API credentials not configured (set EDAMAM_APP_ID and EDAMAM_APP_KEY)")
        return None
    
    if not barcode or not str(barcode).strip():
        logger.warning("Edamam: Empty barcode provided")
        return None
    
    barcode = str(barcode).strip()
    
    # TODO: Implement API call
    url = f"{EDAMAM_API_BASE}/parser"
    params = {
        'upc': barcode,
        'app_id': EDAMAM_APP_ID,
        'app_key': EDAMAM_APP_KEY
    }
    
    try:
        logger.info(f"Edamam: Fetching product {barcode}")
        
        # TODO: Make actual API request
        response = requests.get(url, params=params, timeout=EDAMAM_TIMEOUT)
        
        if not response.ok:
            logger.warning(f"Edamam: HTTP {response.status_code} for barcode {barcode}")
            return None
        
        data = response.json()
        
        # TODO: Parse Edamam response structure
        # Expected format: { "hints": [ { "food": {...}, "measures": [...] } ] }
        hints = data.get('hints', [])
        
        if not hints:
            logger.info(f"Edamam: No results for barcode {barcode}")
            return None
        
        # Use first hint (most relevant)
        food_data = hints[0].get('food', {})
        
        # TODO: Normalize to standard format
        normalized = normalize_edamam_product(food_data, barcode)
        
        logger.info(f"Edamam: Successfully fetched {barcode}")
        
        return normalized
        
    except requests.exceptions.Timeout:
        logger.error(f"Edamam: Timeout fetching barcode {barcode}")
        return None
    except requests.exceptions.RequestException as e:
        logger.error(f"Edamam: Request error for barcode {barcode}: {e}")
        return None
    except Exception as e:
        logger.error(f"Edamam: Unexpected error for barcode {barcode}: {e}")
        return None


def normalize_edamam_product(food: Dict, barcode: str) -> Dict[str, Any]:
    """
    Normalize Edamam product data to standard format.
    
    Edamam provides nutrients per serving, need to convert to per 100g.
    
    Args:
        food: Raw food data from Edamam API
        barcode: Product barcode
    
    Returns:
        Normalized product dictionary
    """
    # TODO: Extract nutrients from Edamam format
    # Edamam nutrients structure: { "nutrients": { "ENERC_KCAL": 123, "FAT": 4.5, ... } }
    raw_nutr = food.get('nutrients', {})
    
    # TODO: Convert from per-serving to per-100g
    # Need to get serving size: food.get('servingSizes') or food.get('servingsPerContainer')
    
    # Edamam nutrient codes:
    # ENERC_KCAL = Energy (kcal)
    # FAT = Total Fat
    # SUGAR = Sugars
    # PROCNT = Protein
    # CHOCDF = Carbohydrates
    # FIBTG = Fiber
    # NA = Sodium
    # FASAT = Saturated Fat
    
    nutriments = {
        'energy-kcal_100g': raw_nutr.get('ENERC_KCAL'),
        'fat_100g': raw_nutr.get('FAT'),
        'sugars_100g': raw_nutr.get('SUGAR'),
        'proteins_100g': raw_nutr.get('PROCNT'),
        'carbohydrates_100g': raw_nutr.get('CHOCDF'),
        'fiber_100g': raw_nutr.get('FIBTG'),
        'sodium_100g': raw_nutr.get('NA'),
        'saturated-fat_100g': raw_nutr.get('FASAT'),
        '__raw': raw_nutr
    }
    
    # Remove None values
    nutriments = {k: v for k, v in nutriments.items() if v is not None}
    
    # TODO: Extract ingredients from Edamam
    # Edamam may not provide detailed ingredients for UPC lookups
    
    normalized = {
        'barcode': barcode,
        'product_name': food.get('label', ''),
        'ingredients_text': '',  # TODO: Check if Edamam provides this
        'brands': food.get('brand', ''),
        'categories': food.get('category', ''),
        'nutriments': nutriments,
        'allergens': [],  # TODO: Extract if available
        'image_url': food.get('image', ''),
        '_source': 'Edamam',
        '_raw': food
    }
    
    return normalized


# =============================================================================
# PLACEHOLDER NOTES
# =============================================================================
"""
EDAMAM API IMPLEMENTATION CHECKLIST:

[ ] 1. Get API credentials from https://developer.edamam.com/
[ ] 2. Set environment variables EDAMAM_APP_ID and EDAMAM_APP_KEY
[ ] 3. Test API connection with sample barcode
[ ] 4. Verify response structure matches expectations
[ ] 5. Implement per-serving to per-100g conversion logic
[ ] 6. Handle cases where ingredients are not provided
[ ] 7. Add rate limiting (free tier: 100 requests/month)
[ ] 8. Add retry logic for transient failures
[ ] 9. Cache responses to minimize API calls
[ ] 10. Write comprehensive test cases

KNOWN LIMITATIONS:
- Free tier: Only 100 requests/month (very limited!)
- May not have complete database for Indian products
- UPC lookup may return generic branded items without detailed ingredients
- Need to convert nutrient values from per-serving to per-100g

ALTERNATIVE CONSIDERATION:
- Edamam's free tier is very restrictive
- Consider if worth implementing vs focusing on OFF + FatSecret
- May be better as "last resort" fallback only
"""


# =============================================================================
# TESTING
# =============================================================================

if __name__ == '__main__':
    # Configure logging for testing
    logging.basicConfig(
        level=logging.INFO,
        format='%(levelname)s - %(message)s'
    )
    
    print("\n" + "=" * 70)
    print("Edamam Fetcher - Test Cases (PLACEHOLDER)")
    print("=" * 70)
    
    print("\n⚠️  API credentials not configured")
    print("   Set EDAMAM_APP_ID and EDAMAM_APP_KEY environment variables")
    print("   Sign up at: https://developer.edamam.com/")
    
    # Test with mock barcode
    result = fetch_from_edamam('8901719128462')
    
    if result:
        print(f"\n✓ Result: {result}")
    else:
        print(f"\n✗ No result (expected - API not configured)")
    
    print("\n" + "=" * 70 + "\n")
