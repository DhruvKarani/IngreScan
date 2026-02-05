"""
Test Suite for ML-Enhanced Scoring System
Tests false claim detection, synergy detection, and personalization
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from unified_scoring import calculate_unified_score
import json

# Test cases
TEST_CASES = [
    {
        "name": "Sugar-Free Energy Drink with Sucrose (FALSE CLAIM)",
        "product": {
            "product_name": "Sugar-Free Energy Boost",
            "ingredients_text": "carbonated water, sucrose, glucose syrup, dextrose, citric acid, caffeine, taurine, natural flavors, preservatives (E211, E202)",
            "nutriments": {
                "sugars_100g": 0.2,
                "energy_100g": 180,
                "salt_100g": 0.1,
                "caffeine_100g": 32
            }
        },
        "user": {"conditions": ["diabetes"], "allergies": []},
        "expected": {
            "should_detect_false_claim": True,
            "false_claim_type": "sugar_free",
            "should_have_high_penalty": True,
            "min_penalty": 15
        }
    },
    {
        "name": "Fat-Free Cookies with Palm Oil (FALSE CLAIM)",
        "product": {
            "product_name": "Fat-Free Chocolate Cookies",
            "ingredients_text": "enriched flour, sugar, palm oil, cocoa, eggs, vanilla extract, baking soda, artificial flavor",
            "nutriments": {
                "sugars_100g": 28,
                "fat_100g": 0.4,
                "saturated-fat_100g": 0.2,
                "salt_100g": 0.6
            }
        },
        "user": {"conditions": [], "allergies": []},
        "expected": {
            "should_detect_false_claim": True,
            "false_claim_type": "fat_free",
            "should_detect_high_sugar": True
        }
    },
    {
        "name": "Gluten-Free Bread with Wheat (FALSE CLAIM)",
        "product": {
            "product_name": "Gluten-Free Artisan Bread",
            "ingredients_text": "wheat flour, water, yeast, salt, olive oil, sugar",
            "nutriments": {
                "sugars_100g": 3,
                "fat_100g": 2,
                "salt_100g": 1.2,
                "carbohydrates_100g": 45
            }
        },
        "user": {"conditions": ["celiac_disease"], "allergies": []},
        "expected": {
            "should_detect_false_claim": True,
            "false_claim_type": "gluten_free",
            "should_have_strict_penalty": True
        }
    },
    {
        "name": "High Sugar + High Fat Synergy",
        "product": {
            "product_name": "Chocolate Hazelnut Spread",
            "ingredients_text": "sugar, palm oil, hazelnuts, cocoa, skim milk powder, soy lecithin, vanillin",
            "nutriments": {
                "sugars_100g": 56,
                "fat_100g": 30,
                "saturated-fat_100g": 10,
                "salt_100g": 0.1
            }
        },
        "user": {"conditions": ["diabetes", "heart_disease"], "allergies": ["soy"]},
        "expected": {
            "should_detect_synergy": True,
            "synergy_type": "sugar_fat_combo",
            "should_detect_allergy": True,
            "allergen": "soy"
        }
    },
    {
        "name": "Natural Product with Artificial Ingredients (MISLEADING)",
        "product": {
            "product_name": "100% Natural Fruit Juice",
            "ingredients_text": "water, fruit juice concentrate, artificial flavor, yellow 5, red 40, preservative (E211), citric acid",
            "nutriments": {
                "sugars_100g": 11,
                "energy_100g": 45,
                "salt_100g": 0.02
            }
        },
        "user": {"conditions": [], "allergies": []},
        "expected": {
            "should_detect_false_claim": True,
            "false_claim_type": "artificial_free",
            "should_detect_artificial_ingredients": True
        }
    },
    {
        "name": "Healthy Product (No Issues)",
        "product": {
            "product_name": "Organic Quinoa",
            "ingredients_text": "organic quinoa",
            "nutriments": {
                "sugars_100g": 0,
                "fat_100g": 2,
                "proteins_100g": 14,
                "fiber_100g": 7,
                "salt_100g": 0.01
            }
        },
        "user": {"conditions": [], "allergies": []},
        "expected": {
            "should_have_high_score": True,
            "min_score": 8,
            "should_detect_false_claim": False
        }
    },
    {
        "name": "Dairy-Free Product with Milk (FALSE CLAIM)",
        "product": {
            "product_name": "Dairy-Free Ice Cream Alternative",
            "ingredients_text": "coconut milk, whey protein, sugar, vanilla extract, guar gum, carrageenan",
            "nutriments": {
                "sugars_100g": 18,
                "fat_100g": 8,
                "salt_100g": 0.15
            }
        },
        "user": {"conditions": [], "allergies": ["lactose_intolerance"]},
        "expected": {
            "should_detect_false_claim": True,
            "false_claim_type": "dairy_free",
            "should_detect_allergy": True
        }
    }
]


def run_tests():
    """Run all test cases and report results"""
    print("=" * 80)
    print("ML-ENHANCED SCORING SYSTEM - TEST SUITE")
    print("=" * 80)
    print()
    
    passed = 0
    failed = 0
    
    for i, test in enumerate(TEST_CASES, 1):
        print(f"\n{'=' * 80}")
        print(f"TEST {i}/{len(TEST_CASES)}: {test['name']}")
        print(f"{'=' * 80}")
        
        try:
            result = calculate_unified_score(test['product'], test['user'])
            
            print(f"\n📊 RESULTS:")
            print(f"  Score: {result['score10']}/10 ({result['score']}/100)")
            print(f"  Tier: {result['Tier']}")
            print(f"  Confidence: {result['Confidence']}")
            
            if result.get('ml_insights'):
                insights = result['ml_insights']
                print(f"\n🤖 ML INSIGHTS:")
                print(f"  Ingredients Found: {insights['ingredients_found']}")
                print(f"  Categories Detected: {', '.join(insights['categories_detected'])}")
                print(f"  False Claims: {insights['false_claims_detected']}")
                print(f"  Synergies Found: {insights['synergies_found']}")
            
            if result.get('warnings'):
                print(f"\n⚠️  WARNINGS ({len(result['warnings'])}):")
                for warning in result['warnings'][:5]:
                    print(f"  - {warning}")
            
            # Validate expectations
            print(f"\n✅ VALIDATION:")
            expected = test['expected']
            validation_passed = True
            
            if expected.get('should_detect_false_claim'):
                false_claims = result.get('ml_insights', {}).get('false_claims_detected', 0)
                if false_claims > 0:
                    print(f"  ✓ False claim detected: {false_claims} claim(s)")
                else:
                    print(f"  ✗ FAIL: Expected false claim detection")
                    validation_passed = False
            
            if expected.get('should_detect_synergy'):
                synergies = result.get('ml_insights', {}).get('synergies_found', 0)
                if synergies > 0:
                    print(f"  ✓ Synergy detected: {synergies} synergy(ies)")
                else:
                    print(f"  ✗ FAIL: Expected synergy detection")
                    validation_passed = False
            
            if expected.get('should_have_high_score'):
                min_score = expected.get('min_score', 8)
                if result['score10'] >= min_score:
                    print(f"  ✓ High score achieved: {result['score10']} >= {min_score}")
                else:
                    print(f"  ✗ FAIL: Score too low: {result['score10']} < {min_score}")
                    validation_passed = False
            
            if expected.get('should_detect_allergy'):
                allergy_warnings = [w for w in result.get('warnings', []) if 'ALLERGY' in w.upper() or 'allergen' in w.lower()]
                if allergy_warnings:
                    print(f"  ✓ Allergy detected: {len(allergy_warnings)} warning(s)")
                else:
                    print(f"  ✗ FAIL: Expected allergy detection")
                    validation_passed = False
            
            if validation_passed:
                print(f"\n✅ TEST PASSED")
                passed += 1
            else:
                print(f"\n❌ TEST FAILED")
                failed += 1
            
        except Exception as e:
            print(f"\n❌ TEST FAILED WITH ERROR:")
            print(f"  {type(e).__name__}: {e}")
            failed += 1
    
    # Summary
    print(f"\n\n{'=' * 80}")
    print(f"TEST SUMMARY")
    print(f"{'=' * 80}")
    print(f"Total Tests: {len(TEST_CASES)}")
    print(f"Passed: {passed} ✅")
    print(f"Failed: {failed} ❌")
    print(f"Success Rate: {(passed / len(TEST_CASES) * 100):.1f}%")
    print(f"{'=' * 80}\n")
    
    return passed, failed


if __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.WARNING)  # Reduce noise during tests
    
    passed, failed = run_tests()
    
    # Exit with appropriate code
    sys.exit(0 if failed == 0 else 1)
