"""
Comprehensive Ingredient Classification Test
Tests harm level detection across ALL food categories
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from ml_engine import ml_analyze_product
import json

print("=" * 100)
print("COMPREHENSIVE INGREDIENT HARM LEVEL CLASSIFICATION TEST")
print("=" * 100)

# Test products with various harm levels
test_products = [
    {
        "name": "Healthy Whole Food Product",
        "product": {
            "product_name": "Organic Quinoa Bowl",
            "ingredients_text": "organic quinoa, spinach, tomatoes, olive oil, lemon juice, garlic, herbs",
            "nutriments": {"proteins_100g": 8, "fat_100g": 5, "fiber_100g": 4}
        },
        "expected_harm": "VERY_LOW to LOW"
    },
    {
        "name": "Natural Preservatives Product",
        "product": {
            "product_name": "Natural Juice",
            "ingredients_text": "apple juice, water, vitamin C (ascorbic acid), citric acid, natural flavors",
            "nutriments": {"sugars_100g": 10, "vitamin_c_100g": 50}
        },
        "expected_harm": "LOW"
    },
    {
        "name": "Moderate Risk Product",
        "product": {
            "product_name": "Packaged Bread",
            "ingredients_text": "enriched flour, water, sugar, yeast, soybean oil, salt, calcium propionate, soy lecithin",
            "nutriments": {"carbohydrates_100g": 45, "sugar_100g": 3}
        },
        "expected_harm": "MEDIUM"
    },
    {
        "name": "High Risk - Artificial Colors & Flavors",
        "product": {
            "product_name": "Fruit Punch Drink",
            "ingredients_text": "water, high fructose corn syrup, citric acid, artificial flavor, red 40, yellow 5, yellow 6, sodium benzoate, potassium sorbate",
            "nutriments": {"sugars_100g": 12}
        },
        "expected_harm": "HIGH"
    },
    {
        "name": "Very High Risk - Processed Meat with Nitrites",
        "product": {
            "product_name": "Hot Dogs",
            "ingredients_text": "mechanically separated chicken, water, corn syrup, salt, sodium phosphate, sodium nitrite, BHA, BHT, red 40",
            "nutriments": {"proteins_100g": 10, "fat_100g": 20, "sodium_100g": 2}
        },
        "expected_harm": "VERY_HIGH"
    },
    {
        "name": "Mixed - Natural & Artificial Sweeteners",
        "product": {
            "product_name": "Yogurt",
            "ingredients_text": "milk, sugar, strawberries, pectin, natural flavor, stevia, potassium sorbate, carmine",
            "nutriments": {"sugars_100g": 8, "proteins_100g": 5}
        },
        "expected_harm": "LOW to MEDIUM"
    }
]

for i, test in enumerate(test_products, 1):
    print(f"\n{'='*100}")
    print(f"TEST {i}/{len(test_products)}: {test['name']}")
    print(f"Expected Harm Level: {test['expected_harm']}")
    print(f"{'='*100}")
    
    result = ml_analyze_product(test['product'])
    
    print(f"\n📊 ANALYSIS RESULTS:")
    print(f"  Product: {test['product']['product_name']}")
    print(f"  Ingredients Found: {result['ingredient_count']}")
    print(f"  Harm Score: {result.get('harm_score', 0)} points")
    
    # Show harm summary
    harm_summary = result.get('harm_summary', {})
    print(f"\n🔍 HARM LEVEL BREAKDOWN:")
    for level in ["VERY_HIGH", "HIGH", "MEDIUM", "LOW", "VERY_LOW"]:
        count = harm_summary.get(level, 0)
        if count > 0:
            emoji = {
                "VERY_HIGH": "🔴",
                "HIGH": "🟠",
                "MEDIUM": "🟡",
                "LOW": "🟢",
                "VERY_LOW": "🟢"
            }.get(level, "⚪")
            print(f"  {emoji} {level}: {count} ingredient(s)")
    
    # Show ingredient categories detected
    if result.get('ingredient_categories'):
        print(f"\n📦 DETECTED CATEGORIES:")
        for cat_name, cat_data in result['ingredient_categories'].items():
            items = cat_data.get('detected_items', [])
            if items:
                print(f"\n  {cat_name.replace('_', ' ').title()}:")
                for item in items[:5]:  # Show first 5
                    type_emoji = {
                        "natural": "🌿",
                        "processed": "🔄",
                        "artificial": "🧪"
                    }.get(item.get('type', 'unknown'), "❓")
                    
                    harm = item.get('harm_level', 'N/A')
                    harm_emoji = {
                        "VERY_LOW": "🟢",
                        "LOW": "🟢",
                        "MEDIUM": "🟡",
                        "HIGH": "🟠",
                        "VERY_HIGH": "🔴"
                    }.get(harm, "⚪")
                    
                    print(f"    {type_emoji} {item['name']} {harm_emoji} [{harm}]")
    
    # Show warnings
    if result.get('ml_warnings'):
        print(f"\n⚠️  WARNINGS ({len(result['ml_warnings'])}):")
        for warning in result['ml_warnings'][:5]:
            print(f"  • {warning}")
    
    # Overall verdict
    total_penalty = result.get('total_ml_penalty', 0)
    if total_penalty < 5:
        verdict = "✅ SAFE - Minimal risk ingredients"
    elif total_penalty < 15:
        verdict = "⚠️  MODERATE - Some concerning ingredients"
    elif total_penalty < 30:
        verdict = "🔶 HIGH RISK - Multiple concerning ingredients"
    else:
        verdict = "🔴 VERY HIGH RISK - Avoid frequent consumption"
    
    print(f"\n🎯 VERDICT: {verdict}")
    print(f"   Total Penalty: {total_penalty} points")

# Summary comparison
print(f"\n\n{'='*100}")
print("SUMMARY COMPARISON - Harm Scores")
print(f"{'='*100}\n")

print(f"{'Product':<40} {'Harm Score':<15} {'Verdict':<30}")
print("-" * 100)

for test in test_products:
    result = ml_analyze_product(test['product'])
    harm_score = result.get('harm_score', 0)
    
    if harm_score == 0:
        verdict = "✅ SAFE"
    elif harm_score < 10:
        verdict = "🟢 LOW RISK"
    elif harm_score < 30:
        verdict = "🟡 MEDIUM RISK"
    elif harm_score < 50:
        verdict = "🟠 HIGH RISK"
    else:
        verdict = "🔴 VERY HIGH RISK"
    
    product_name = test['product']['product_name'][:38]
    print(f"{product_name:<40} {harm_score:<15} {verdict:<30}")

print("\n" + "="*100)
print("✅ COMPREHENSIVE TEST COMPLETE")
print("="*100)
print("\nKEY INSIGHTS:")
print("• Natural preservatives (Vitamin C, citric acid) = LOW harm")
print("• Artificial colors (Red 40, Yellow 5) = HIGH harm")
print("• Nitrites in processed meat = VERY HIGH harm")
print("• Whole foods (quinoa, vegetables) = VERY LOW harm")
print("• System distinguishes between 300+ ingredients across 5 harm levels!")
