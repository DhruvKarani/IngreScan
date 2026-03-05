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
    
    # If this is an E-number/INS number but lacks detailed info, add additive information
    if ingredient_key and not result.get('additive_info'):
        is_e_or_ins = re.search(r'(?:e-?\d{3,4}|ins\s*\d{3,4}|\b\d{3,4}\b)', ingredient_key.lower())
        if is_e_or_ins:
            additive_info = get_additive_type_info(ingredient_key)
            if additive_info:
                # If description is generic/incomplete, enhance it
                if result.get('description', '').lower() in ['no data available.', 'detailed information not available offline.'] or 'detailed information not available offline' in result.get('description', '').lower():
                    result['description'] = f"{additive_info['description']} This is a regulatory-approved food additive ({additive_info['purpose'].lower()})."
                
                # Enhance common name if it's just the code
                if result.get('common_name', '').lower() == ingredient_key.lower():
                    result['common_name'] = f"{ingredient_key.upper()} ({additive_info['category']})"
                
                # Add additive info
                result['additive_info'] = {
                    "category": additive_info['category'],
                    "purpose": additive_info['purpose'],
                    "regulatory_status": "Approved food additive",
                    "note": "Required for product integrity and quality maintenance"
                }
                
                # Update risk level if unknown
                if result.get('risk_level') == 'unknown':
                    result['risk_level'] = 'low'
                
                # Enhance found_in if empty or generic
                if not result.get('found_in') or result.get('found_in') == ['various food products']:
                    result['found_in'] = ["Processed foods", "Packaged products", "Commercial food items"]
    
    return result

def get_additive_type_info(ingredient):
    """Determine the type of food additive based on E-number/INS number ranges."""
    # Extract number from E-number or INS number
    number_match = re.search(r'(\d{3,4})', ingredient.lower())
    if not number_match:
        return None
    
    number = int(number_match.group(1))
    
    # E-number/INS number classification by ranges
    if 200 <= number <= 299:
        return {
            "category": "Preservatives",
            "purpose": "Prevent spoilage and extend shelf life",
            "description": "Food preservatives used to maintain product integrity and prevent bacterial/fungal growth."
        }
    elif 300 <= number <= 399:
        return {
            "category": "Antioxidants & Acidity Regulators", 
            "purpose": "Prevent oxidation and control pH levels",
            "description": "Antioxidants and acidity regulators that maintain food quality and prevent rancidity."
        }
    elif 400 <= number <= 499:
        return {
            "category": "Stabilizers, Thickeners & Emulsifiers",
            "purpose": "Improve texture and consistency", 
            "description": "Stabilizers and thickeners required to maintain product texture and prevent separation."
        }
    elif 500 <= number <= 599:
        return {
            "category": "Acidity Regulators & Anti-caking Agents",
            "purpose": "Control pH and prevent clumping",
            "description": "pH regulators and anti-caking agents that maintain product consistency."
        }
    elif 600 <= number <= 699:
        return {
            "category": "Flavor Enhancers",
            "purpose": "Enhance taste and aroma",
            "description": "Flavor enhancers used to improve the taste profile of processed foods."
        }
    elif 700 <= number <= 799:
        return {
            "category": "Antibiotics & Preservatives",
            "purpose": "Antimicrobial protection",
            "description": "Specialized preservatives and antibiotics for food safety."
        }
    elif 900 <= number <= 999:
        return {
            "category": "Glazing Agents & Sweeteners",
            "purpose": "Surface treatment and sweetening",
            "description": "Glazing agents and artificial sweeteners for appearance and taste."
        }
    else:
        return {
            "category": "Food Additive",
            "purpose": "Regulatory approved food ingredient",
            "description": "Approved food additive required for product manufacturing and quality maintenance."
        }

def process_ingredient(ingredient):
    """Handle E-number normalization → fuzzy match → fallback API → enhanced default result."""
    # 1. Normalize E-numbers and INS numbers
    normalized = normalize_e_number(ingredient)
    
    # 2. Try fuzzy match in local DB
    matched = get_best_match(normalized)
    if matched and matched in INGREDIENT_DB:
        result = INGREDIENT_DB[matched].copy()
        return enhance_with_preservative_info(result, ingredient)

    # 3. Fallback to external API
    print(f"🔍 {ingredient} not found locally. Fetching from API...")
    api_result = fetch_ingredient_info(ingredient)
    if api_result:
        return enhance_with_preservative_info(api_result, ingredient)

    # 4. Enhanced default fallback for E-numbers/INS numbers
    is_e_or_ins = re.search(r'(?:e-?\d{3,4}|ins\s*\d{3,4}|\b\d{3,4}\b)', ingredient.lower())
    
    if is_e_or_ins:
        additive_info = get_additive_type_info(ingredient)
        if additive_info:
            default_result = {
                "common_name": f"{ingredient.upper()} ({additive_info['category']})",
                "description": f"{additive_info['description']} This is a regulatory-approved food additive ({additive_info['purpose'].lower()}).",
                "risk_level": "low",  # Most approved additives are considered safe
                "found_in": ["Processed foods", "Packaged products", "Commercial food items"],
                "also_used_in": ["Food manufacturing", "Product preservation"],
                "additive_info": {
                    "category": additive_info['category'],
                    "purpose": additive_info['purpose'],
                    "regulatory_status": "Approved food additive",
                    "note": "Required for product integrity and quality maintenance"
                }
            }
        else:
            default_result = {
                "common_name": f"{ingredient.upper()} (Food Additive)",
                "description": "Regulatory-approved food additive required for product manufacturing and quality maintenance.",
                "risk_level": "low",
                "found_in": ["Processed foods"],
                "also_used_in": ["Food manufacturing"],
                "additive_info": {
                    "category": "Food Additive",
                    "purpose": "Product integrity",
                    "regulatory_status": "Approved",
                    "note": "Standard food industry ingredient"
                }
            }
    else:
        # Regular ingredient fallback
        default_result = {
            "common_name": ingredient.upper(),
            "description": "No data available.",
            "risk_level": "unknown",
            "found_in": [],
            "also_used_in": []
        }
    
    return enhance_with_preservative_info(default_result, ingredient)

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
        
        # Show additive information if available
        if info.get('additive_info'):
            add_info = info['additive_info']
            print(f"   🧪 ADDITIVE TYPE: {add_info['category']} - {add_info['purpose']}")
        
        print(f"   Found in: {', '.join(info['found_in'][:3])}")
    
    print("\n" + "="*50)
    print("🧪 Testing with EXISTING ingredients:")
    
    # Test various E-numbers, INS numbers, and preservatives
    sample = "Vegetable[Tomato Paste(36%)],Water,Sugar,Refined Soyabean Oil,Iodised salt,Stabilizers(INS 412,INS 415),Spices and Condiments,Acidity Regulator(INS 330),Preservative(INS 211),Antioxidant(INS 300),Herbs(0.8%)"
    parsed = parse_ingredients(sample)
    
    print(f"\n📊 Found {len(parsed)} unique ingredients:")
    
    for ing, info in parsed.items():
        print(f"\n🔸 {ing.upper()} - {info['common_name']}")
        print(f"   Description: {info['description'][:200]}...")
        print(f"   Risk Level: {info['risk_level']}")
        
        if info.get('preservative_info', {}).get('is_preservative'):
            pres_info = info['preservative_info']
            print(f"   ⚠️  PRESERVATIVE - Max Limit: {pres_info['max_limit']}")
        
        # Show additive information for E-numbers/INS numbers
        if info.get('additive_info'):
            add_info = info['additive_info']
            print(f"   🧪 ADDITIVE TYPE: {add_info['category']} - {add_info['purpose']}")
            print(f"   📋 STATUS: {add_info['regulatory_status']} - {add_info['note']}")
        
        print(f"   Found in: {', '.join(info['found_in'][:2])}")  # Show first 2 items
