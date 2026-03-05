#!/usr/bin/env python3
"""
Data Quality Validator
Validates product data completeness and determines verification requirements.

This module provides quality scoring for product data fetched from various sources
(OpenFoodFacts, Edamam, FatSecret, etc.) and determines whether user verification
is needed.
"""

from typing import Dict, List, Any, Tuple
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# PRODUCT SCHEMA DEFINITION
# =============================================================================

PRODUCT_SCHEMA = {
    # Critical: Essential for ingredient-based health scoring (50 points)
    'critical': {
        'ingredients_text': {
            'weight': 50,
            'validator': lambda x: x and isinstance(x, str) and len(x.strip()) > 10
        }
    },
    
    # Important: Key data used for health scoring (5 points each = 35 total)
    'important': {
        'calories': {
            'weight': 5,
            'paths': ['nutriments.energy-kcal_100g', 'nutriments.energy_100g', 
                     'nutrition.calories', 'nutriments.calories'],
            'validator': lambda x: x is not None and (isinstance(x, (int, float)) and x >= 0)
        },
        'sugar': {
            'weight': 5,
            'paths': ['nutriments.sugars_100g', 'nutriments.sugars', 'nutrition.sugar'],
            'validator': lambda x: x is not None and (isinstance(x, (int, float)) and x >= 0)
        },
        'fat': {
            'weight': 5,
            'paths': ['nutriments.fat_100g', 'nutriments.fat', 'nutrition.fat'],
            'validator': lambda x: x is not None and (isinstance(x, (int, float)) and x >= 0)
        },
        'protein': {
            'weight': 5,
            'paths': ['nutriments.proteins_100g', 'nutriments.protein', 'nutrition.protein'],
            'validator': lambda x: x is not None and (isinstance(x, (int, float)) and x >= 0)
        },
        'sodium': {
            'weight': 5,
            'paths': ['nutriments.sodium_100g', 'nutriments.salt_100g', 'nutrition.sodium'],
            'validator': lambda x: x is not None and (isinstance(x, (int, float)) and x >= 0)
        },
        'carbohydrates': {
            'weight': 5,
            'paths': ['nutriments.carbohydrates_100g', 'nutriments.carbohydrates', 'nutrition.carbs'],
            'validator': lambda x: x is not None and (isinstance(x, (int, float)) and x >= 0)
        },
        'allergens': {
            'weight': 5,
            'paths': ['allergens', 'allergens_tags'],
            'validator': lambda x: x is not None and (isinstance(x, (list, str)) and len(str(x)) > 0)
        }
    },
    
    # Optional: Metadata not used for scoring (15 points total)
    'optional': {
        'product_name': {
            'weight': 5,
            'validator': lambda x: x and isinstance(x, str) and len(x.strip()) > 0
        },
        'brands': {
            'weight': 3,
            'validator': lambda x: x and isinstance(x, str) and len(x.strip()) > 0
        },
        'categories': {
            'weight': 3,
            'validator': lambda x: x and isinstance(x, str) and len(x.strip()) > 0
        },
        'fiber': {
            'weight': 4,
            'paths': ['nutriments.fiber_100g', 'nutriments.fiber', 'nutrition.fiber'],
            'validator': lambda x: x is not None and (isinstance(x, (int, float)) and x >= 0)
        }
    }
}


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_nested_value(data: Dict, path: str) -> Any:
    """
    Get value from nested dictionary using dot notation.
    
    Args:
        data: Dictionary to search
        path: Dot-separated path (e.g., 'nutriments.sugars_100g')
    
    Returns:
        Value if found, None otherwise
    """
    keys = path.split('.')
    value = data
    
    try:
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            else:
                return None
        return value
    except (KeyError, TypeError, AttributeError):
        return None


def check_field(product: Dict, field_name: str, field_config: Dict) -> Tuple[bool, Any]:
    """
    Check if a field exists and is valid in product data.
    
    Args:
        product: Product data dictionary
        field_name: Name of the field to check
        field_config: Field configuration with validator and optional paths
    
    Returns:
        Tuple of (is_valid, actual_value)
    """
    validator = field_config.get('validator')
    paths = field_config.get('paths', [field_name])
    
    logger.debug(f"  Checking field: {field_name}")
    logger.debug(f"    Paths to try: {paths}")
    
    # Try all possible paths for this field
    for path in paths:
        value = get_nested_value(product, path)
        logger.debug(f"    Path '{path}' -> value: {value} (type: {type(value).__name__ if value is not None else 'None'})")
        if validator and validator(value):
            logger.info(f"  ✓ {field_name} FOUND via '{path}': {value}")
            return True, value
    
    # Also try direct field name
    direct_value = product.get(field_name)
    logger.debug(f"    Direct key '{field_name}' -> value: {direct_value}")
    if validator and validator(direct_value):
        logger.info(f"  ✓ {field_name} FOUND via direct key: {direct_value}")
        return True, direct_value
    
    logger.warning(f"  ✗ {field_name} MISSING (none of the paths returned valid data)")
    return False, None


# =============================================================================
# MAIN VALIDATION FUNCTIONS
# =============================================================================

def validate_product_data(product: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate product data and calculate completeness score.
    
    Args:
        product: Product data dictionary from any source
    
    Returns:
        Dictionary containing:
        - completeness_score: 0-100 score indicating data completeness
        - has_critical_data: Boolean indicating if critical fields are present
        - missing_fields: List of missing field names by category
        - present_fields: List of present field names
        - confidence: LOW/MEDIUM/HIGH based on score
        - needs_verification: Boolean indicating if user verification is needed
    """
    logger.info("=" * 70)
    logger.info("VALIDATING PRODUCT DATA")
    logger.info("=" * 70)
    logger.info(f"Product keys: {list(product.keys())}")
    logger.info(f"Has 'nutriments'? {('nutriments' in product)}")
    if 'nutriments' in product:
        logger.info(f"Nutriment keys: {list(product.get('nutriments', {}).keys())[:15]}")  # First 15 keys
    logger.info("-" * 70)
    
    score = 0
    max_score = 0
    missing_fields = {'critical': [], 'important': [], 'optional': []}
    present_fields = []
    
    # Check all field categories
    for category in ['critical', 'important', 'optional']:
        fields = PRODUCT_SCHEMA.get(category, {})
        
        logger.info(f"\nChecking {category.upper()} fields:")
        
        for field_name, field_config in fields.items():
            weight = field_config['weight']
            max_score += weight
            
            is_valid, value = check_field(product, field_name, field_config)
            
            if is_valid:
                score += weight
                present_fields.append(field_name)
            else:
                missing_fields[category].append(field_name)
    
    # Calculate percentage score
    completeness_score = int((score / max_score) * 100) if max_score > 0 else 0
    
    # Determine if critical data is present
    has_critical_data = len(missing_fields['critical']) == 0
    
    # Determine confidence level
    if completeness_score >= 90:
        confidence = 'HIGH'
    elif completeness_score >= 70:
        confidence = 'MEDIUM'
    else:
        confidence = 'LOW'
    
    # Determine if verification is needed (Option A logic)
    # Auto-verify if score is very high (>90) and has critical data
    needs_verification = not (completeness_score > 90 and has_critical_data)
    
    logger.info("=" * 70)
    logger.info("VALIDATION SUMMARY")
    logger.info(f"  Score: {completeness_score}% ({score}/{max_score} points)")
    logger.info(f"  Confidence: {confidence}")
    logger.info(f"  Has Critical Data: {has_critical_data}")
    logger.info(f"  Needs Verification: {needs_verification}")
    logger.info(f"  Present Fields ({len(present_fields)}): {present_fields}")
    logger.info(f"  Missing Critical ({len(missing_fields['critical'])}): {missing_fields['critical']}")
    logger.info(f"  Missing Important ({len(missing_fields['important'])}): {missing_fields['important']}")
    logger.info(f"  Missing Optional ({len(missing_fields['optional'])}): {missing_fields['optional']}")
    logger.info("=" * 70)
    
    return {
        'completeness_score': completeness_score,
        'has_critical_data': has_critical_data,
        'missing_fields': missing_fields,
        'present_fields': present_fields,
        'confidence': confidence,
        'needs_verification': needs_verification,
        'raw_score': score,
        'max_possible_score': max_score
    }


def identify_missing_fields(product: Dict[str, Any]) -> Dict[str, List[str]]:
    """
    Identify which fields are missing from product data.
    
    Args:
        product: Product data dictionary
    
    Returns:
        Dictionary with categories (critical, important, optional) 
        and lists of missing field names
    """
    validation_result = validate_product_data(product)
    return validation_result['missing_fields']


def is_usable_data(product: Dict[str, Any]) -> bool:
    """
    Determine if product data is usable (has minimum required fields).
    
    Products are usable if they have:
    - At least ingredients_text OR some nutrition data
    - This allows incomplete products to be returned for user verification
    
    Args:
        product: Product data dictionary
    
    Returns:
        Boolean indicating if data meets minimum requirements
    """
    validation_result = validate_product_data(product)
    
    # Accept product if it has ANY critical or important data
    # (even if incomplete - user can verify/complete it)
    has_some_data = (
        len(validation_result['missing_fields']['critical']) < len(PRODUCT_SCHEMA['critical']) or
        len(validation_result['missing_fields']['important']) < len(PRODUCT_SCHEMA['important'])
    )
    
    # Minimum requirement: must have at least 20% completeness OR ingredients OR one nutrient
    return has_some_data and validation_result['completeness_score'] >= 20


def should_prompt_verification(
    product: Dict[str, Any],
    verification_prompted_count: int = 0,
    scan_count: int = 0
) -> bool:
    """
    Determine if user should be prompted for verification (Option A logic).
    
    Args:
        product: Product data dictionary
        verification_prompted_count: Number of times user has been prompted
        scan_count: Total number of times this product has been scanned
    
    Returns:
        Boolean indicating if verification prompt should be shown
    """
    validation_result = validate_product_data(product)
    
    # Don't prompt if already verified in Firebase (checked by caller)
    
    # Auto-verify high-quality data (>90% complete)
    if validation_result['completeness_score'] > 90:
        return False
    
    # Don't prompt more than 3 times per user
    if verification_prompted_count >= 3:
        return False
    
    # If product has been scanned 10+ times without verification,
    # assume it's "good enough" (crowd consensus)
    if scan_count >= 10:
        return False
    
    # Otherwise, prompt if data needs verification
    return validation_result['needs_verification']


def get_verification_metadata(
    product: Dict[str, Any],
    source: str = 'unknown'
) -> Dict[str, Any]:
    """
    Generate metadata for Firebase storage with verification tracking.
    
    Args:
        product: Product data dictionary
        source: Data source name (e.g., 'OFF', 'Edamam', 'manual')
    
    Returns:
        Dictionary with verification metadata fields
    """
    validation_result = validate_product_data(product)
    
    # Auto-verify if completeness is very high
    auto_verified = validation_result['completeness_score'] > 90
    
    return {
        'verified': auto_verified,
        'verification_prompted_count': 0,
        'scan_count': 0,
        'completeness_score': validation_result['completeness_score'],
        'confidence': validation_result['confidence'],
        'missing_fields': validation_result['missing_fields'],
        'data_source': source,
        'last_updated': datetime.utcnow().isoformat(),
        'needs_verification': validation_result['needs_verification']
    }


# =============================================================================
# VALIDATION REPORT (for debugging/testing)
# =============================================================================

def get_validation_report(product: Dict[str, Any]) -> str:
    """
    Generate a human-readable validation report.
    
    Args:
        product: Product data dictionary
    
    Returns:
        Formatted string report
    """
    validation = validate_product_data(product)
    
    report = f"""
╔══════════════════════════════════════════════════════════════╗
║           PRODUCT DATA QUALITY REPORT                        ║
╚══════════════════════════════════════════════════════════════╝

Product Name: {product.get('product_name', 'N/A')}

COMPLETENESS SCORE: {validation['completeness_score']}/100
Confidence Level: {validation['confidence']}
Has Critical Data: {'✓ Yes' if validation['has_critical_data'] else '✗ No'}
Needs Verification: {'Yes' if validation['needs_verification'] else 'No'}

FIELD STATUS:
──────────────────────────────────────────────────────────────

✓ Present Fields ({len(validation['present_fields'])}):
  {', '.join(validation['present_fields']) if validation['present_fields'] else 'None'}

✗ Missing Fields:
  Critical: {', '.join(validation['missing_fields']['critical']) if validation['missing_fields']['critical'] else 'None'}
  Important: {', '.join(validation['missing_fields']['important']) if validation['missing_fields']['important'] else 'None'}
  Optional: {', '.join(validation['missing_fields']['optional']) if validation['missing_fields']['optional'] else 'None'}

SCORING BREAKDOWN:
  Raw Score: {validation['raw_score']}/{validation['max_possible_score']}
  
╚══════════════════════════════════════════════════════════════╝
"""
    return report


# =============================================================================
# TESTING / MAIN
# =============================================================================

if __name__ == '__main__':
    # Test with sample product data
    print("=" * 65)
    print("DATA QUALITY VALIDATOR - TEST CASES")
    print("=" * 65)
    
    # Test Case 1: Complete product
    print("\n[Test 1] Complete Product (High Quality)")
    print("-" * 65)
    complete_product = {
        'product_name': 'Parle-G Gold Biscuits',
        'ingredients_text': 'Wheat Flour, Sugar, Edible Vegetable Oil, Glucose, Milk Solids, Raising Agents (503, 500), Salt',
        'brands': 'Parle',
        'categories': 'Biscuits',
        'nutriments': {
            'energy-kcal_100g': 456,
            'sugars_100g': 20.5,
            'fat_100g': 12.3,
            'proteins_100g': 6.8,
            'carbohydrates_100g': 72.1,
            'fiber_100g': 2.1,
            'sodium_100g': 0.5
        },
        'allergens': 'milk, wheat'
    }
    
    result1 = validate_product_data(complete_product)
    print(f"Score: {result1['completeness_score']}/100")
    print(f"Confidence: {result1['confidence']}")
    print(f"Needs Verification: {result1['needs_verification']}")
    print(get_validation_report(complete_product))
    
    # Test Case 2: Minimal product (only critical fields)
    print("\n[Test 2] Minimal Product (Only Critical Fields)")
    print("-" * 65)
    minimal_product = {
        'product_name': 'Unknown Snack',
        'ingredients_text': 'Sugar, Flour, Oil'
    }
    
    result2 = validate_product_data(minimal_product)
    print(f"Score: {result2['completeness_score']}/100")
    print(f"Confidence: {result2['confidence']}")
    print(f"Needs Verification: {result2['needs_verification']}")
    print(get_validation_report(minimal_product))
    
    # Test Case 3: Incomplete product (missing critical fields)
    print("\n[Test 3] Incomplete Product (Missing Critical Data)")
    print("-" * 65)
    incomplete_product = {
        'product_name': 'Mystery Product',
        'brands': 'Unknown Brand'
    }
    
    result3 = validate_product_data(incomplete_product)
    print(f"Score: {result3['completeness_score']}/100")
    print(f"Confidence: {result3['confidence']}")
    print(f"Is Usable: {is_usable_data(incomplete_product)}")
    print(get_validation_report(incomplete_product))
    
    # Test Case 4: Verification prompt logic
    print("\n[Test 4] Verification Prompt Logic")
    print("-" * 65)
    test_cases = [
        (complete_product, 0, 0, "High quality, first scan"),
        (minimal_product, 0, 0, "Minimal data, first scan"),
        (minimal_product, 3, 0, "Prompted 3 times already"),
        (minimal_product, 0, 10, "Scanned 10 times (crowd consensus)"),
    ]
    
    for product, prompt_count, scan_count, description in test_cases:
        should_prompt = should_prompt_verification(product, prompt_count, scan_count)
        print(f"  {description}: {'PROMPT' if should_prompt else 'SKIP'}")
    
    print("\n" + "=" * 65)
    print("✓ All tests completed")
    print("=" * 65)
