"""
IngreScan Ingredient Parser
==========================

This module provides comprehensive ingredient parsing with support for:
- E-numbers (E200-E999+)  
- INS numbers (International Numbering System)
- Preservatives with regulatory limits
- Fuzzy matching for ingredient variations
- External API fallback for unknown ingredients
- Caching system for performance

Author: IngreScan Project-Dhrub,Yesu,Deb,A.Idli
"""

import os
import json
import re
from fuzzy_matcher import get_best_match
from openfood_api import fetch_ingredient_info

# --- Load Local DB ---
with open("ingredient_db.json") as f:
    INGREDIENT_DB = json.load(f)

# --- Cache Setup ---
CACHE_FILE = "ingredient_cache.json"
if os.path.exists(CACHE_FILE):
    with open(CACHE_FILE, "r") as f:
        ingredient_cache = json.load(f)
else:
    ingredient_cache = {}

def cache_result(ingredient, result):
    """Store result in cache and update JSON file."""
    ingredient_cache[ingredient.lower()] = result
    with open(CACHE_FILE, "w") as f:
        json.dump(ingredient_cache, f, indent=2)

def get_cached_result(ingredient):
    """Check if result is already cached."""
    return ingredient_cache.get(ingredient.lower(), None)

def is_preservative(ingredient_info):
    """Check if ingredient is a preservative by looking for max_limit field."""
    return ingredient_info.get("max_limit") is not None

def get_preservative_info(ingredient_info):
    """Extract preservative information from ingredient data."""
    if is_preservative(ingredient_info):
        return {
            "max_limit": ingredient_info.get("max_limit", "Not specified"),
            "category": "preservative",
            "notes": f"Regulatory limit: {ingredient_info.get('max_limit', 'Not specified')}"
        }
    return None

def normalize_e_number(ingredient):
    """Normalize E-numbers and INS numbers to standard format."""
    ingredient = ingredient.lower().strip()
    
    # Handle E-numbers (E200, E-200, e200, etc.)
    e_pattern = r'e-?(\d{3,4})'
    e_match = re.match(e_pattern, ingredient)
    if e_match:
        return f"e{e_match.group(1)}"
    
    # Handle INS numbers (INS 200, 200, etc.)
    ins_pattern = r'(?:ins\s*)?(\d{3,4})$'
    ins_match = re.match(ins_pattern, ingredient)
    if ins_match:
        return f"e{ins_match.group(1)}"
        
    return ingredient

def enhance_with_preservative_info(result, ingredient_key=None):
    """Add preservative-specific information to the result."""
    if is_preservative(result):
        preservative_info = get_preservative_info(result)
        result["preservative_info"] = {
            "is_preservative": True,
            "max_limit": preservative_info["max_limit"],
            "category": preservative_info["category"],
            "regulatory_notes": preservative_info["notes"]
        }
        # Update risk level if it's a preservative with known limits
        if result["risk_level"] == "unknown":
            result["risk_level"] = "low" if "ppm" in preservative_info["max_limit"] else "moderate"
    else:
        result["preservative_info"] = {
            "is_preservative": False
        }
    return result

def process_ingredient(ingredient):
    """Handle E-number normalization → fuzzy match → fallback API → default result."""
    # 1. Normalize E-numbers and INS numbers
    normalized = normalize_e_number(ingredient)
    
    # 2. Try fuzzy match in local DB
    matched = get_best_match(normalized)
    if matched and matched in INGREDIENT_DB:
        result = INGREDIENT_DB[matched].copy()
        return enhance_with_preservative_info(result)

    # 3. Fallback to external API
    print(f"🔍 {ingredient} not found locally. Fetching from API...")
    api_result = fetch_ingredient_info(ingredient)
    if api_result:
        return enhance_with_preservative_info(api_result)

    # 4. Default fallback
    default_result = {
        "common_name": ingredient.upper(),
        "description": "No data available.",
        "risk_level": "unknown",
        "found_in": [],
        "also_used_in": []
    }
    return enhance_with_preservative_info(default_result)

def merge_duplicate_ingredients(results):
    """Merge ingredients that refer to the same substance (e.g., E211 and Sodium Benzoate)."""
    merged = {}
    ingredient_map = {}  # Maps common_name to the first key that used it
    
    for original_key, info in results.items():
        common_name = info['common_name'].lower()
        
        # Check if we've seen this ingredient before
        if common_name in ingredient_map:
            existing_key = ingredient_map[common_name]
            # Merge the input names
            if 'input_variations' not in merged[existing_key]:
                merged[existing_key]['input_variations'] = [existing_key]
            merged[existing_key]['input_variations'].append(original_key)
            
            # Merge found_in lists (avoid duplicates)
            existing_found_in = set(merged[existing_key]['found_in'])
            new_found_in = set(info['found_in'])
            merged[existing_key]['found_in'] = list(existing_found_in.union(new_found_in))
            
            # Merge also_used_in lists (avoid duplicates)
            existing_also_used_in = set(merged[existing_key]['also_used_in'])
            new_also_used_in = set(info['also_used_in'])
            merged[existing_key]['also_used_in'] = list(existing_also_used_in.union(new_also_used_in))
            
        else:
            # First time seeing this ingredient
            ingredient_map[common_name] = original_key
            merged[original_key] = info.copy()
            merged[original_key]['input_variations'] = [original_key]
    
    return merged

def parse_ingredients(text):
    """Main parsing pipeline with deduplication."""
    raw_ingredients = [item.strip().lower() for item in text.split(',')]
    result = {}

    for ing in raw_ingredients:
        # Check cache first
        cached = get_cached_result(ing)
        if cached:
            print(f"✅ [CACHE HIT] {ing}")
            result[ing] = cached
            continue

        print(f"🔍 [PROCESSING] {ing}")
        processed = process_ingredient(ing)
        result[ing] = processed
        cache_result(ing, processed)

    # Merge duplicate ingredients
    merged_results = merge_duplicate_ingredients(result)
    return merged_results

# 🔍 Sample test
if __name__ == "__main__":
    # Test with a new ingredient not in cache/database
    print("🧪 Testing with NEW ingredient (Ascorbic Acid):")
    test_new = "ascorbic acid"
    parsed_new = parse_ingredients(test_new)
    
    for ing, info in parsed_new.items():
        print(f"\n🔸 {ing.upper()} - {info['common_name']}")
        print(f"   Description: {info['description'][:200]}...")
        print(f"   Risk Level: {info['risk_level']}")
        print(f"   Source: {info.get('source', 'Local DB')}")
        print(f"   Found in: {', '.join(info['found_in'][:3])}")
    
    print("\n" + "="*50)
    print("🧪 Testing with EXISTING ingredients:")
    
    # Test various E-numbers, INS numbers, and preservatives
    sample = "E621, E211, E202, water"
    parsed = parse_ingredients(sample)
    
    print(f"\n📊 Found {len(parsed)} unique ingredients:")
    
    for ing, info in parsed.items():
        print(f"\n🔸 {ing.upper()} - {info['common_name']}")
        print(f"   Description: {info['description'][:100]}...")
        print(f"   Risk Level: {info['risk_level']}")
        
        if info.get('preservative_info', {}).get('is_preservative'):
            pres_info = info['preservative_info']
            print(f"   ⚠️  PRESERVATIVE - Max Limit: {pres_info['max_limit']}")
        
        print(f"   Found in: {', '.join(info['found_in'][:2])}")  # Show first 2 items
