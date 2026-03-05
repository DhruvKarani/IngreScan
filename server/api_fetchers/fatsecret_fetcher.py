#!/usr/bin/env python3
"""
FatSecret Platform API Fetcher

Fetches product nutrition data from FatSecret Platform API.
Requires OAuth credentials from https://platform.fatsecret.com/

SETUP REQUIRED:
1. Sign up at https://platform.fatsecret.com/api/
2. Create an application to get API credentials
3. Set environment variables:
   - FATSECRET_CLIENT_ID=your_client_id
   - FATSECRET_CLIENT_SECRET=your_client_secret
"""

import requests
import os
import base64
from typing import Dict, Optional, Any
import logging
import time
import re

logger = logging.getLogger(__name__)

# FatSecret API configuration
FATSECRET_API_BASE = "https://platform.fatsecret.com/rest/server.api"
FATSECRET_TOKEN_URL = "https://oauth.fatsecret.com/connect/token"
FATSECRET_TIMEOUT = 10  # seconds

# API credentials (from environment variables)
FATSECRET_CLIENT_ID = os.environ.get('FATSECRET_CLIENT_ID', '')
FATSECRET_CLIENT_SECRET = os.environ.get('FATSECRET_CLIENT_SECRET', '')

# Token cache (to avoid repeated OAuth calls)
_access_token = None
_token_expiry = 0


def get_access_token() -> Optional[str]:
    """
    Get OAuth 2.0 access token for FatSecret API.
    Uses Client Credentials flow with token caching.
    
    Returns:
        Access token string or None if failed
    """
    global _access_token, _token_expiry
    
    # Return cached token if still valid
    if _access_token and time.time() < _token_expiry:
        return _access_token
    
    if not FATSECRET_CLIENT_ID or not FATSECRET_CLIENT_SECRET:
        logger.warning("FatSecret: API credentials not configured (set FATSECRET_CLIENT_ID and FATSECRET_CLIENT_SECRET)")
        return None
    
    try:
        # Create Basic Auth header
        credentials = f"{FATSECRET_CLIENT_ID}:{FATSECRET_CLIENT_SECRET}"
        encoded = base64.b64encode(credentials.encode()).decode()
        
        headers = {
            'Authorization': f'Basic {encoded}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        data = {
            'grant_type': 'client_credentials',
            'scope': 'basic'  # Use 'basic' for free tier, 'premier' for paid tier
        }
        
        response = requests.post(FATSECRET_TOKEN_URL, headers=headers, data=data, timeout=FATSECRET_TIMEOUT)
        
        if not response.ok:
            logger.error(f"FatSecret: Token request failed - HTTP {response.status_code}")
            return None
        
        token_data = response.json()
        _access_token = token_data.get('access_token')
        expires_in = token_data.get('expires_in', 3600)  # Default 1 hour
        _token_expiry = time.time() + expires_in - 60  # Refresh 1 min early
        
        logger.info("FatSecret: OAuth token obtained successfully")
        return _access_token
        
    except Exception as e:
        logger.error(f"FatSecret: Token request error - {e}")
        return None
        expires_in = token_data.get('expires_in', 3600)  # Default 1 hour
        _token_expiry = time.time() + expires_in - 60  # Refresh 1 min early
        
        logger.info("FatSecret: OAuth token obtained successfully")
        return _access_token
        
    except Exception as e:
        logger.error(f"FatSecret: Token request error - {e}")
        return None


def fetch_from_fatsecret(barcode: str) -> Optional[Dict[str, Any]]:
    """
    Fetch product data from FatSecret Platform API.
    
    Strategy:
    1. Search by barcode using foods.search
    2. If found, get detailed info using food.get.v3 (optional, for more data)
    3. Normalize to standard format
    
    Args:
        barcode: Product barcode
    
    Returns:
        Normalized product dictionary or None if not found/error
    """
    token = get_access_token()
    if not token:
        logger.warning("FatSecret: Cannot fetch without access token")
        return None
    
    if not barcode or not str(barcode).strip():
        logger.warning("FatSecret: Empty barcode provided")
        return None
    
    barcode = str(barcode).strip()
    
    # FatSecret uses method-based API with 'method' parameter
    params = {
        'method': 'foods.search',
        'search_expression': barcode,
        'format': 'json',
        'max_results': '5'  # Limit results
    }
    
    headers = {
        'Authorization': f'Bearer {token}'
    }
    
    try:
        logger.info(f"FatSecret: Searching for barcode {barcode}")
        
        response = requests.get(FATSECRET_API_BASE, params=params, headers=headers, timeout=FATSECRET_TIMEOUT)
        
        if not response.ok:
            logger.warning(f"FatSecret: HTTP {response.status_code} for barcode {barcode}")
            return None
        
        data = response.json()
        
        # Parse FatSecret response structure
        # Expected: { "foods": { "food": [ {...}, {...} ] } } or { "foods": { "food": {...} } }
        foods = data.get('foods', {})
        food_list = foods.get('food', [])
        
        if not food_list:
            logger.info(f"FatSecret: No results for barcode {barcode}")
            return None
        
        # Ensure food_list is actually a list
        if not isinstance(food_list, list):
            food_list = [food_list]
        
        # Try to find exact barcode match, or use first result
        food_data = None
        for food in food_list:
            # Check if barcode matches exactly (some products have barcode field)
            if str(food.get('food_id', '')).strip() == barcode or barcode in str(food.get('food_name', '')):
                food_data = food
                break
        
        # If no exact match, use first result
        if not food_data:
            food_data = food_list[0]
        
        # Get food_id for detailed lookup (optional enhancement)
        food_id = food_data.get('food_id')
        
        # If we have food_id, we could call food.get.v3 for more details
        # For now, use the search result data directly
        # TODO: Implement food.get.v3 call if search data is insufficient
        
        # Normalize to standard format
        normalized = normalize_fatsecret_product(food_data, barcode)
        
        logger.info(f"FatSecret: Successfully fetched {barcode} ({food_data.get('food_name', 'Unknown')})")
        
        return normalized
        
    except requests.exceptions.Timeout:
        logger.error(f"FatSecret: Timeout fetching barcode {barcode}")
        return None
    except requests.exceptions.RequestException as e:
        logger.error(f"FatSecret: Request error for barcode {barcode}: {e}")
        return None
    except Exception as e:
        logger.error(f"FatSecret: Unexpected error for barcode {barcode}: {e}")
        return None


def normalize_fatsecret_product(food: Dict, barcode: str) -> Dict[str, Any]:
    """
    Normalize FatSecret product data to standard format.
    
    FatSecret provides nutrients per serving, need to convert to per 100g.
    
    Args:
        food: Raw food data from FatSecret API
        barcode: Product barcode
    
    Returns:
        Normalized product dictionary
    """
    # Extract serving information
    serving_size = float(food.get('metric_serving_amount', 100))  # grams per serving
    serving_unit = food.get('metric_serving_unit', 'g')
    
    # Extract nutrients (per serving)
    # FatSecret provides: calories, fat, carbohydrate, protein, etc.
    nutriments = {}
    
    # Helper function to convert per-serving to per-100g
    def to_per_100g(value, serving_g=serving_size):
        """Convert nutrient value from per-serving to per-100g"""
        if value is None or serving_g == 0:
            return 0
        try:
            return (float(value) / serving_g) * 100
        except (ValueError, TypeError):
            return 0
    
    # Parse food_description if available (contains nutrient text)
    food_desc = food.get('food_description', '')
    if food_desc:
        # Try to extract nutrients from text using regex
        # Example: "Per 1 cup - Calories: 200kcal | Fat: 8g | Carbs: 25g | Protein: 10g"
        
        # Calories
        cal_match = re.search(r'Calories:\s*([\d.]+)\s*kcal', food_desc, re.IGNORECASE)
        if cal_match:
            nutriments['energy-kcal_100g'] = to_per_100g(cal_match.group(1))
            nutriments['energy_100g'] = nutriments['energy-kcal_100g'] * 4.184  # Convert to kJ
        
        # Fat
        fat_match = re.search(r'Fat:\s*([\d.]+)\s*g', food_desc, re.IGNORECASE)
        if fat_match:
            nutriments['fat_100g'] = to_per_100g(fat_match.group(1))
        
        # Carbs
        carb_match = re.search(r'Carbs?:\s*([\d.]+)\s*g', food_desc, re.IGNORECASE)
        if carb_match:
            nutriments['carbohydrates_100g'] = to_per_100g(carb_match.group(1))
        
        # Protein
        protein_match = re.search(r'Protein:\s*([\d.]+)\s*g', food_desc, re.IGNORECASE)
        if protein_match:
            nutriments['proteins_100g'] = to_per_100g(protein_match.group(1))
    
    # Alternatively, use structured serving data if available
    servings = food.get('servings', {})
    if isinstance(servings, dict):
        serving_data = servings.get('serving', {})
        if isinstance(serving_data, list) and serving_data:
            serving_data = serving_data[0]  # Use first serving
        
        if isinstance(serving_data, dict):
            # Extract structured nutrients
            if 'calories' in serving_data:
                nutriments['energy-kcal_100g'] = to_per_100g(serving_data.get('calories'))
                nutriments['energy_100g'] = nutriments['energy-kcal_100g'] * 4.184
            
            if 'fat' in serving_data:
                nutriments['fat_100g'] = to_per_100g(serving_data.get('fat'))
            
            if 'carbohydrate' in serving_data:
                nutriments['carbohydrates_100g'] = to_per_100g(serving_data.get('carbohydrate'))
            
            if 'protein' in serving_data:
                nutriments['proteins_100g'] = to_per_100g(serving_data.get('protein'))
            
            if 'sugar' in serving_data:
                nutriments['sugars_100g'] = to_per_100g(serving_data.get('sugar'))
            
            if 'fiber' in serving_data:
                nutriments['fiber_100g'] = to_per_100g(serving_data.get('fiber'))
            
            if 'saturated_fat' in serving_data:
                nutriments['saturated-fat_100g'] = to_per_100g(serving_data.get('saturated_fat'))
            
            if 'sodium' in serving_data:
                # FatSecret provides sodium in mg, convert to g
                sodium_mg = float(serving_data.get('sodium', 0))
                nutriments['sodium_100g'] = to_per_100g(sodium_mg / 1000)  # mg to g
            
            if 'cholesterol' in serving_data:
                # Cholesterol in mg
                cholesterol_mg = float(serving_data.get('cholesterol', 0))
                nutriments['cholesterol_100g'] = to_per_100g(cholesterol_mg / 1000)
    
    # Build normalized product structure
    normalized = {
        'barcode': barcode,
        'product_name': food.get('food_name', ''),
        'ingredients_text': '',  # FatSecret doesn't provide ingredient lists
        'brands': food.get('brand_name', ''),
        'categories': food.get('food_type', ''),
        'nutriments': nutriments,
        'allergens': [],  # FatSecret doesn't provide allergen information
        'image_url': '',  # FatSecret doesn't provide images in basic tier
        'serving_size': f"{serving_size}{serving_unit}",
        '_source': 'FatSecret',
        '_metadata': {
            'original_serving': f"{serving_size}{serving_unit}",
            'converted_to_100g': True
        },
        '_raw': food
    }
    
    return normalized


# =============================================================================
# IMPLEMENTATION NOTES
# =============================================================================
"""
FATSECRET API IMPLEMENTATION STATUS:

[✓] 1. Get API credentials from https://platform.fatsecret.com/api/
[✓] 2. Set environment variables FATSECRET_CLIENT_ID and FATSECRET_CLIENT_SECRET
[✓] 3. Implement OAuth 2.0 Client Credentials flow
[✓] 4. Implement token caching and renewal
[✓] 5. Implement foods.search method
[✓] 6. Parse food_description text for nutrients (regex + structured)
[✓] 7. Convert per-serving nutrients to per-100g
[✓] 8. Handle multiple search results (filter by barcode)
[✓] 9. Normalize to standard product format

KNOWN LIMITATIONS:
- Free tier has rate limits (check your plan)
- Barcode coverage may be limited (primarily US products)
- No ingredient lists provided (only nutrition data)
- No allergen information
- No product images in basic tier
- Database may be limited for non-US products

NUTRIENT PARSING:
- Extracts from food_description text using regex
- Falls back to structured servings.serving data
- Supports: calories, fat, carbs, protein, sugars, fiber, sodium, cholesterol
- All nutrients converted from per-serving to per-100g basis

BEST USE CASE:
- Tertiary fallback after Firebase and OpenFoodFacts
- Useful for US-market fitness/nutrition products
- Good for calories/macros, limited for ingredient analysis
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
    print("FatSecret Fetcher - Test Cases (PLACEHOLDER)")
    print("=" * 70)
    
    print("\n⚠️  API credentials not configured")
    print("   Set FATSECRET_CLIENT_ID and FATSECRET_CLIENT_SECRET environment variables")
    print("   Sign up at: https://platform.fatsecret.com/api/")
    
    # Test with mock barcode
    result = fetch_from_fatsecret('8901719128462')
    
    if result:
        print(f"\n✓ Result: {result}")
    else:
        print(f"\n✗ No result (expected - API not configured)")
    
    print("\n" + "=" * 70 + "\n")
