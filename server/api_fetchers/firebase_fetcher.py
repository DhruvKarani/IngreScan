#!/usr/bin/env python3   43
"""
Firebase Firestore Fetcher

Fetches product data from Firebase Firestore database.
This is the PRIMARY source for verified, user-contributed data.
"""

import sys
import os
from typing import Dict, Optional, Any
import logging

# Add parent directory to path for firebase imports
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

logger = logging.getLogger(__name__)

# Try to import Firebase - gracefully degrade if not available
try:
    from firebase_admin import firestore, credentials, initialize_app
    import firebase_admin
    
    # Initialize Firebase if not already initialized
    if not firebase_admin._apps:
        cred_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'firebase-credentials.json')
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            initialize_app(cred)
            logger.info("Firebase initialized successfully for product fetcher")
        else:
            logger.warning(f"Firebase credentials not found at {cred_path}")
    
    db = firestore.client()
    FIREBASE_AVAILABLE = True
    
except Exception as e:
    logger.error(f"Firebase initialization failed: {e}")
    FIREBASE_AVAILABLE = False
    db = None


def fetch_from_firebase(barcode: str) -> Optional[Dict[str, Any]]:
    """
    Fetch product data from Firebase Firestore.
    
    Args:
        barcode: Product barcode number
    
    Returns:
        Normalized product dictionary or None if not found/error
    """
    if not FIREBASE_AVAILABLE:
        logger.warning("Firebase: Service not available")
        return None
    
    if not barcode or not str(barcode).strip():
        logger.warning("Firebase: Empty barcode provided")
        return None
    
    barcode = str(barcode).strip()
    
    try:
        logger.info(f"Firebase: Fetching product {barcode}")
        
        # Query Firebase products collection
        doc_ref = db.collection('products').document(barcode)
        doc = doc_ref.get()
        
        if not doc.exists:
            logger.info(f"Firebase: Product {barcode} not found in database")
            return None
        
        product = doc.to_dict()
        
        if not product:
            logger.warning(f"Firebase: Empty product data for barcode {barcode}")
            return None
        
        # Normalize to standard format
        normalized = normalize_firebase_product(product, barcode)
        
        logger.info(
            f"Firebase: Successfully fetched {barcode} - "
            f"{normalized.get('product_name', 'Unknown')} "
            f"(verified: {product.get('verifiedCount', 0)} times)"
        )
        
        return normalized
        
    except Exception as e:
        logger.error(f"Firebase: Error fetching barcode {barcode}: {e}")
        return None


def normalize_firebase_product(product: Dict, barcode: str) -> Dict[str, Any]:
    """
    Normalize Firebase product data to standard format.
    
    Firebase products may have different field names than OpenFoodFacts.
    This normalizes them to a common format for merging.
    
    Args:
        product: Raw Firebase product dictionary
        barcode: Product barcode
    
    Returns:
        Normalized product dictionary
    """
    
    # Extract nutriments (Firebase may store as 'nutriments', 'nutrition', or 'nutritional_info')
    raw_nutr = product.get('nutriments') or product.get('nutrition') or product.get('nutritional_info') or {}
    
    # Helper to safely get numeric value
    def get_num(obj, *keys):
        for key in keys:
            if key in obj and obj[key] is not None:
                try:
                    return float(obj[key])
                except (ValueError, TypeError):
                    pass
        return None
    
    # Build normalized nutriments with _100g suffix for consistency
    nutriments = {}
    
    # Map common nutrition fields
    nutrition_mapping = {
        'sugars_100g': ['sugars_100g', 'sugars', 'sugar_100g', 'sugar'],
        'fat_100g': ['fat_100g', 'fat', 'total_fat_100g', 'total_fat'],
        'saturated-fat_100g': ['saturated-fat_100g', 'saturated_fat_100g', 'saturated-fat', 'saturated_fat'],
        'proteins_100g': ['proteins_100g', 'protein_100g', 'proteins', 'protein'],
        'carbohydrates_100g': ['carbohydrates_100g', 'carbohydrate_100g', 'carbohydrates', 'carbohydrate'],
        'fiber_100g': ['fiber_100g', 'dietary_fiber_100g', 'fiber', 'dietary_fiber'],
        'salt_100g': ['salt_100g', 'salt', 'sodium_100g', 'sodium'],
        'energy-kcal_100g': ['energy-kcal_100g', 'energy_kcal_100g', 'energy-kcal', 'energy_kcal', 'calories_100g', 'calories', 'energy_100g', 'energy'],
    }
    
    for standard_key, possible_keys in nutrition_mapping.items():
        value = get_num(raw_nutr, *possible_keys)
        if value is not None:
            # Special handling for energy - convert from kJ if needed
            if 'energy' in standard_key or 'kcal' in standard_key:
                if value > 2000:  # Likely kJ, convert to kcal
                    value = round(value / 4.184)
            nutriments[standard_key] = value
    
    # Extract ingredients
    ingredients_text = (
        product.get('ingredients_text') or 
        product.get('ingredients') or 
        ''
    )
    
    # If ingredients is a list, join it
    if isinstance(ingredients_text, list):
        ingredients_text = ', '.join(str(i) for i in ingredients_text)
    
    # Extract allergens
    allergens = product.get('allergens', [])
    if isinstance(allergens, str):
        allergens = [a.strip() for a in allergens.split(',') if a.strip()]
    
    # Build normalized product
    normalized = {
        'product_name': product.get('product_name') or product.get('name') or '',
        'ingredients_text': ingredients_text,
        'nutriments': nutriments,
        'brands': product.get('brands') or product.get('brand') or '',
        'categories': product.get('categories') or product.get('category') or '',
        'image_url': product.get('image_url') or product.get('image') or '',
        'barcode': barcode,
        'allergens': allergens,
        'serving_size': product.get('serving_size') or '',
        'quantity': product.get('quantity') or '',
        
        # Firebase-specific metadata
        'verifiedCount': product.get('verifiedCount', 0),
        'createdAt': product.get('createdAt'),
        'updatedAt': product.get('updatedAt'),
        
        # Quality score from Firebase if available
        '_firebase_quality': product.get('verifiedCount', 0),  # Higher verified count = better quality
        
        # Keep raw data for reference
        '_raw_firebase': product
    }
    
    return normalized


def is_firebase_available() -> bool:
    """Check if Firebase service is available."""
    return FIREBASE_AVAILABLE


# For testing
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python firebase_fetcher.py <barcode>")
        sys.exit(1)
    
    test_barcode = sys.argv[1]
    
    logging.basicConfig(level=logging.INFO)
    
    print(f"\nTesting Firebase fetcher with barcode: {test_barcode}")
    print("=" * 60)
    
    result = fetch_from_firebase(test_barcode)
    
    if result:
        print(f"\n✓ Product found!")
        print(f"Name: {result.get('product_name')}")
        print(f"Verified: {result.get('verifiedCount', 0)} times")
        print(f"Ingredients: {result.get('ingredients_text', 'N/A')[:100]}...")
        print(f"Nutriments: {list(result.get('nutriments', {}).keys())}")
    else:
        print("\n✗ Product not found or error occurred")
