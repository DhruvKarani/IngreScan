"""
Test Natural vs Artificial Sweetener Detection + Unknown Ingredient Learning
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from ml_engine import ml_analyze_product, classify_unknown_ingredient
import json

print("=" * 80)
print("NATURAL vs ARTIFICIAL SWEETENER DETECTION TEST")
print("=" * 80)

# Test 1: Product with natural sweeteners
print("\n" + "=" * 80)
print("TEST 1: Protein Bar with Natural Sweeteners")
print("=" * 80)

product_natural = {
    "product_name": "Sugar-Free Protein Bar",
    "ingredients_text": "dates, almonds, whey protein, honey, coconut oil, stevia, vanilla extract",
    "nutriments": {
        "sugars_100g": 8,  # From dates/honey
        "proteins_100g": 20,
        "fat_100g": 10
    }
}

result1 = ml_analyze_product(product_natural)
print(f"\n📊 Analysis:")
print(f"  Ingredients found: {result1['ingredient_count']}")
print(f"  False claims detected: {result1['false_claims']}")
print(f"  Total penalty: {result1['total_ml_penalty']}")

if 'ingredient_categories' in result1:
    for cat_name, cat_data in result1['ingredient_categories'].items():
        if 'sweetener' in cat_name or 'sugar' in cat_name:
            print(f"\n  🍯 {cat_name.upper()}:")
            breakdown = cat_data.get('breakdown', {})
            if breakdown.get('natural'):
                print(f"    ✅ Natural: {[i['name'] for i in breakdown['natural']]}")
            if breakdown.get('artificial'):
                print(f"    ❌ Artificial: {[i['name'] for i in breakdown['artificial']]}")
            if breakdown.get('processed'):
                print(f"    ⚠️  Processed: {[i['name'] for i in breakdown['processed']]}")

print(f"\n  💬 Verdict: {'NATURAL SWEETENERS DETECTED' if result1['total_ml_penalty'] < 15 else 'ARTIFICIAL SWEETENERS DETECTED'}")

# Test 2: Product with artificial sweeteners
print("\n\n" + "=" * 80)
print("TEST 2: Diet Soda with Artificial Sweeteners")
print("=" * 80)

product_artificial = {
    "product_name": "Sugar-Free Diet Cola",
    "ingredients_text": "carbonated water, aspartame, acesulfame potassium, citric acid, natural flavors, caffeine",
    "nutriments": {
        "sugars_100g": 0,
        "energy_100g": 2
    }
}

result2 = ml_analyze_product(product_artificial)
print(f"\n📊 Analysis:")
print(f"  Ingredients found: {result2['ingredient_count']}")
print(f"  False claims detected: {result2['false_claims']}")
print(f"  Total penalty: {result2['total_ml_penalty']}")

if 'ingredient_categories' in result2:
    for cat_name, cat_data in result2['ingredient_categories'].items():
        if 'sweetener' in cat_name or 'sugar' in cat_name:
            print(f"\n  🍯 {cat_name.upper()}:")
            breakdown = cat_data.get('breakdown', {})
            if breakdown.get('natural'):
                print(f"    ✅ Natural: {[i['name'] for i in breakdown['natural']]}")
            if breakdown.get('artificial'):
                print(f"    ❌ Artificial: {[i['name'] for i in breakdown['artificial']]}")
            if breakdown.get('processed'):
                print(f"    ⚠️  Processed: {[i['name'] for i in breakdown['processed']]}")

print(f"\n  💬 Verdict: {'NATURAL SWEETENERS DETECTED' if result2['total_ml_penalty'] < 15 else 'ARTIFICIAL SWEETENERS DETECTED'}")

# Test 3: Unknown ingredient learning
print("\n\n" + "=" * 80)
print("TEST 3: Unknown Ingredient Classification")
print("=" * 80)

unknown_ingredients = [
    "dragon fruit powder",
    "methylcellulose",
    "nutritional yeast",
    "e472e",
    "spirulina extract"
]

print("\n🔍 Classifying unknown ingredients using ML:\n")

for ing in unknown_ingredients:
    classification = classify_unknown_ingredient(ing)
    
    type_emoji = "🌿" if classification['type'] == "natural" else "🧪" if classification['type'] == "artificial" else "🔄"
    
    print(f"  {type_emoji} {ing}")
    print(f"     Category: {classification['category']}")
    print(f"     Type: {classification['type'].upper()}")
    print(f"     Confidence: {classification['confidence']:.1%}")
    print(f"     Method: {classification['detected_by']}")
    print()

# Test 4: Mixed sweeteners with penalty differences
print("=" * 80)
print("TEST 4: Penalty Comparison - Natural vs Artificial in False Claims")
print("=" * 80)

test_products = [
    {
        "name": "Product A: Sugar-free with NATURAL sweetener",
        "product": {
            "product_name": "Sugar-Free Yogurt with Stevia",
            "ingredients_text": "milk, stevia, fruit pectin, natural flavors",
            "nutriments": {"sugars_100g": 0.1}
        }
    },
    {
        "name": "Product B: Sugar-free with ARTIFICIAL sweetener",
        "product": {
            "product_name": "Sugar-Free Yogurt with Aspartame",
            "ingredients_text": "milk, aspartame, fruit pectin, natural flavors",
            "nutriments": {"sugars_100g": 0.1}
        }
    },
    {
        "name": "Product C: Sugar-free with REFINED sugar",
        "product": {
            "product_name": "Sugar-Free Cookies",
            "ingredients_text": "flour, maltodextrin, sucralose, eggs, butter",
            "nutriments": {"sugars_100g": 0.2}
        }
    }
]

for test in test_products:
    print(f"\n{test['name']}")
    result = ml_analyze_product(test['product'])
    print(f"  False Claim Penalty: {result['false_claim_penalty']} points")
    
    # Show breakdown
    if result.get('claim_validations'):
        for validation in result['claim_validations']:
            if not validation['valid']:
                print(f"  Violation: {validation.get('violation_details', [])}")

print("\n" + "=" * 80)
print("✅ TESTS COMPLETE - See penalty differences based on sweetener type!")
print("=" * 80)
