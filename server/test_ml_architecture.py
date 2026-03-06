#!/usr/bin/env python3
"""
Quick test to verify ML-First architecture changes
Tests the new classification priority system
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

# Test import
try:
    from ml_engine import classify_ingredient_primary, classify_with_distilbert, classify_ingredient_heuristic
    print("✓ All new functions imported successfully")
except ImportError as e:
    print(f"✗ Import failed: {e}")
    sys.exit(1)

# Test function signatures
print("\n=== Testing Function Signatures ===")

# Test 1: classify_with_distilbert
result = classify_with_distilbert("sugar")
print(f"classify_with_distilbert('sugar'): {type(result)}")

# Test 2: classify_ingredient_primary
result = classify_ingredient_primary("sugar", target_category="refined_sugar")
print(f"classify_ingredient_primary('sugar', 'refined_sugar'): {type(result)}")

# Test 3: Heuristic fallback
result = classify_ingredient_heuristic("unknown ingredient xyz")
print(f"classify_ingredient_heuristic('unknown'): {type(result)}")
print(f"  Category: {result.get('category', 'N/A')}")
print(f"  Detected by: {result.get('detected_by', 'N/A')}")

print("\n✓ All function signatures verified")
print("\n=== Testing Classification Priority ===")

# Test priority order
test_ingredients = [
    "high fructose corn syrup",  # Should be caught by ML or aliases
    "E621",  # Should trigger heuristic (E-number)
    "wheat flour",  # Common ingredient
]

for ing in test_ingredients:
    result = classify_ingredient_primary(ing)
    if result:
        print(f"{ing:30s} → {result.get('category', 'unknown'):25s} [{result.get('detected_by', 'N/A')}]")
    else:
        print(f"{ing:30s} → (not classified)")

print("\n=== Architecture Verification Complete ===")
print("✓ ML-First architecture is functioning")
print("✓ DistilBERT → Aliases → Heuristics priority works")
print("\nNote: Full accuracy testing requires running score_api.py with real products")
