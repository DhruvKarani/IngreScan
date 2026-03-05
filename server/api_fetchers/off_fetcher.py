#!/usr/bin/env python3
"""
OpenFoodFacts API Fetcher

Fetches product data from OpenFoodFacts database.
Ported from JavaScript (src/utils/openFoodFacts.js) to Python.
"""

import requests
from typing import Dict, Optional, Any
import logging

logger = logging.getLogger(__name__)

# OpenFoodFacts API configuration
OFF_API_BASE = "https://world.openfoodfacts.org/api/v0/product"
OFF_TIMEOUT = 10  # seconds


def fetch_from_off(barcode: str) -> Optional[Dict[str, Any]]:
    """
    Fetch product data from OpenFoodFacts API.
    
    Args:
        barcode: Product barcode number
    
    Returns:
        Normalized product dictionary or None if not found/error
    """
    if not barcode or not str(barcode).strip():
        logger.warning("OFF: Empty barcode provided")
        return None
    
    barcode = str(barcode).strip()
    url = f"{OFF_API_BASE}/{barcode}.json"
    
    try:
        logger.info(f"OFF: Fetching product {barcode}")
        
        response = requests.get(url, timeout=OFF_TIMEOUT)
        
        if not response.ok:
            logger.warning(f"OFF: HTTP {response.status_code} for barcode {barcode}")
            return None
        
        data = response.json()
        
        # Check if product was found (status = 1)
        if not data or data.get('status') != 1:
            logger.info(f"OFF: Product {barcode} not found in database")
            return None
        
        product = data.get('product', {})
        
        if not product:
            logger.warning(f"OFF: Empty product data for barcode {barcode}")
            return None
        
        # Normalize to standard format
        normalized = normalize_off_product(product, barcode)
        
        logger.info(f"OFF: Successfully fetched {barcode} - {normalized.get('product_name', 'Unknown')}")
        
        return normalized
        
    except requests.exceptions.Timeout:
        logger.error(f"OFF: Timeout fetching barcode {barcode}")
        return None
    except requests.exceptions.RequestException as e:
        logger.error(f"OFF: Request error for barcode {barcode}: {e}")
        return None
    except Exception as e:
        logger.error(f"OFF: Unexpected error for barcode {barcode}: {e}")
        return None


def normalize_off_product(product: Dict, barcode: str) -> Dict[str, Any]:
    """
    Normalize OpenFoodFacts product data to standard format.
    
    Args:
        product: Raw product data from OFF API
        barcode: Product barcode
    
    Returns:
        Normalized product dictionary
    """
    # Get nutriments (prefer _100g values)
    raw_nutr = product.get('nutriments', {})
    
    # Extract and normalize nutrients
    nutriments = {
        'energy-kcal_100g': _get_nutrient(raw_nutr, ['energy-kcal_100g', 'energy_100g', 'energy-kcal', 'energy']),
        'sugars_100g': _get_nutrient(raw_nutr, ['sugars_100g', 'sugars']),
        'fat_100g': _get_nutrient(raw_nutr, ['fat_100g', 'fat']),
        'proteins_100g': _get_nutrient(raw_nutr, ['proteins_100g', 'protein_100g', 'proteins', 'protein']),
        'carbohydrates_100g': _get_nutrient(raw_nutr, ['carbohydrates_100g', 'carbohydrates']),
        'fiber_100g': _get_nutrient(raw_nutr, ['fiber_100g', 'fiber']),
        'salt_100g': _get_nutrient(raw_nutr, ['salt_100g', 'salt']),
        'sodium_100g': _get_nutrient(raw_nutr, ['sodium_100g', 'sodium']),
        'saturated-fat_100g': _get_nutrient(raw_nutr, ['saturated-fat_100g', 'saturated_fat_100g', 'saturated-fat', 'saturated_fat']),
    }
    
    # Remove None values
    nutriments = {k: v for k, v in nutriments.items() if v is not None}
    
    # Keep raw nutriments for reference
    nutriments['__raw'] = raw_nutr
    
    # Get ingredients text (try different language versions)
    ingredients_text = (
        product.get('ingredients_text') or 
        product.get('ingredients_text_en') or 
        product.get('ingredients_text_with_allergens') or
        ''
    )
    
    # Extract allergens
    allergens = _extract_allergens(product)
    
    # Build normalized product
    normalized = {
        'barcode': barcode,
        'product_name': product.get('product_name') or product.get('name') or '',
        'ingredients_text': ingredients_text,
        'brands': product.get('brands', ''),
        'categories': product.get('categories', ''),
        'nutriments': nutriments,
        'allergens': allergens,
        'image_url': product.get('image_small_url') or product.get('image_url') or '',
        '_source': 'OFF',
        '_raw': product  # Keep raw data for debugging
    }
    
    return normalized


def _get_nutrient(nutriments: Dict, keys: list) -> Optional[float]:
    """
    Get nutrient value from multiple possible keys.
    
    Args:
        nutriments: Nutriments dictionary
        keys: List of possible key names to try
    
    Returns:
        Nutrient value or None if not found
    """
    for key in keys:
        value = nutriments.get(key)
        if value is not None:
            try:
                return float(value)
            except (ValueError, TypeError):
                continue
    return None


def _extract_allergens(product: Dict) -> list:
    """
    Extract allergen information from product data.
    
    Args:
        product: Product dictionary
    
    Returns:
        List of allergen strings
    """
    allergens = []
    
    # Try allergens field
    if product.get('allergens'):
        if isinstance(product['allergens'], list):
            allergens.extend(product['allergens'])
        elif isinstance(product['allergens'], str):
            # Split by common separators
            allergens.extend([a.strip() for a in product['allergens'].replace(',', ';').split(';')])
    
    # Try allergens_tags
    if product.get('allergens_tags'):
        if isinstance(product['allergens_tags'], list):
            # Clean allergen tags (remove 'en:' prefix)
            clean_tags = [tag.replace('en:', '').replace('-', ' ').strip() 
                         for tag in product['allergens_tags']]
            allergens.extend(clean_tags)
    
    # Remove duplicates and empty strings
    allergens = list(set([a for a in allergens if a and a.strip()]))
    
    return allergens


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
    print("OpenFoodFacts Fetcher - Test Cases")
    print("=" * 70)
    
    # Test Case 1: Indian product (Parle-G)
    print("\n[Test 1] Indian Product - Parle-G")
    print("-" * 70)
    product1 = fetch_from_off('8901719128462')
    if product1:
        print(f"✓ Product: {product1.get('product_name')}")
        print(f"  Brands: {product1.get('brands')}")
        print(f"  Ingredients: {product1.get('ingredients_text')[:50]}...")
        print(f"  Sugar: {product1.get('nutriments', {}).get('sugars_100g')} g/100g")
        print(f"  Image: {product1.get('image_url')[:50]}...")
    else:
        print("✗ Product not found")
    
    # Test Case 2: International product (Nutella)
    print("\n[Test 2] International Product - Nutella")
    print("-" * 70)
    product2 = fetch_from_off('4008400404127')
    if product2:
        print(f"✓ Product: {product2.get('product_name')}")
        print(f"  Brands: {product2.get('brands')}")
        print(f"  Allergens: {product2.get('allergens')}")
        print(f"  Fat: {product2.get('nutriments', {}).get('fat_100g')} g/100g")
    else:
        print("✗ Product not found")
    
    # Test Case 3: Non-existent barcode
    print("\n[Test 3] Non-existent Barcode")
    print("-" * 70)
    product3 = fetch_from_off('0000000000000')
    if product3:
        print(f"✓ Product: {product3.get('product_name')}")
    else:
        print("✗ Product not found (expected)")
    
    # Test Case 4: Invalid barcode
    print("\n[Test 4] Invalid/Empty Barcode")
    print("-" * 70)
    product4 = fetch_from_off('')
    if product4:
        print(f"✓ Product: {product4.get('product_name')}")
    else:
        print("✗ Empty barcode handled correctly (expected)")
    
    print("\n" + "=" * 70)
    print("✓ All tests completed")
    print("=" * 70 + "\n")
