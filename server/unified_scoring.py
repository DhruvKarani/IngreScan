"""
Unified Scoring System
Combines ML-based ingredient analysis with personalized health rules
"""

import json
import os
import logging
from typing import Dict, Any, List
from ml_engine import ml_analyze_product

# Load health rules
HEALTH_RULES_PATH = os.path.join(os.path.dirname(__file__), "..", "health_rules.json")
try:
    with open(HEALTH_RULES_PATH, 'r', encoding='utf-8') as f:
        HEALTH_RULES = json.load(f)
    logging.info("Loaded health rules successfully")
except FileNotFoundError:
    logging.warning("health_rules.json not found")
    HEALTH_RULES = {}


def calculate_base_nutrition_score(nutrients: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate base score from nutritional values
    Returns score (0-10) and breakdown
    """
    score = 10
    breakdown = []
    
    # Get key nutrients (per 100g)
    sugar = float(nutrients.get("sugars_100g", 0) or nutrients.get("sugars", 0))
    fat = float(nutrients.get("fat_100g", 0) or nutrients.get("fat", 0))
    saturated_fat = float(nutrients.get("saturated-fat_100g", 0) or nutrients.get("saturated_fat", 0))
    salt = float(nutrients.get("salt_100g", 0) or nutrients.get("salt", 0))
    sodium = float(nutrients.get("sodium_100g", 0) or nutrients.get("sodium", 0))
    
    # Convert sodium to salt if needed
    if salt == 0 and sodium > 0:
        salt = sodium * 2.5  # Approximate conversion
    
    # Sugar penalties
    if sugar > 20:
        penalty = 3
        score -= penalty
        breakdown.append({"type": "nutrition", "nutrient": "sugar", "value": sugar, "penalty": penalty, "reason": f"Very high sugar ({sugar}g/100g)"})
    elif sugar > 10:
        penalty = 2
        score -= penalty
        breakdown.append({"type": "nutrition", "nutrient": "sugar", "value": sugar, "penalty": penalty, "reason": f"High sugar ({sugar}g/100g)"})
    
    # Fat penalties
    if fat > 30:
        penalty = 2
        score -= penalty
        breakdown.append({"type": "nutrition", "nutrient": "fat", "value": fat, "penalty": penalty, "reason": f"Very high fat ({fat}g/100g)"})
    elif fat > 20:
        penalty = 1
        score -= penalty
        breakdown.append({"type": "nutrition", "nutrient": "fat", "value": fat, "penalty": penalty, "reason": f"High fat ({fat}g/100g)"})
    
    # Saturated fat penalties
    if saturated_fat > 10:
        penalty = 2
        score -= penalty
        breakdown.append({"type": "nutrition", "nutrient": "saturated_fat", "value": saturated_fat, "penalty": penalty, "reason": f"Very high saturated fat ({saturated_fat}g/100g)"})
    elif saturated_fat > 5:
        penalty = 1
        score -= penalty
        breakdown.append({"type": "nutrition", "nutrient": "saturated_fat", "value": saturated_fat, "penalty": penalty, "reason": f"High saturated fat ({saturated_fat}g/100g)"})
    
    # Salt/Sodium penalties
    if salt > 2.0:
        penalty = 3
        score -= penalty
        breakdown.append({"type": "nutrition", "nutrient": "salt", "value": salt, "penalty": penalty, "reason": f"Very high salt ({salt}g/100g)"})
    elif salt > 1.5:
        penalty = 2
        score -= penalty
        breakdown.append({"type": "nutrition", "nutrient": "salt", "value": salt, "penalty": penalty, "reason": f"High salt ({salt}g/100g)"})
    
    return {
        "base_score": max(1, score),
        "breakdown": breakdown,
        "total_nutrition_penalty": 10 - max(1, score)
    }


def apply_personalized_penalties(ml_results: Dict[str, Any], nutrients: Dict[str, Any], 
                                 user_profile: Dict[str, Any]) -> Dict[str, Any]:
    """
    Apply penalties based on user's health conditions and allergies
    """
    penalties = []
    warnings = []
    total_penalty = 0
    
    conditions = user_profile.get("conditions", [])
    allergies = user_profile.get("allergies", [])
    
    # Extract all ingredients from all categories
    all_ingredients = []
    for category_data in ml_results.get("ingredient_categories", {}).values():
        for item in category_data.get("detected_items", []):
            all_ingredients.append(item["name"])
    
    # Also get from ingredients_analyzed if available
    if "ingredients_analyzed" in ml_results:
        all_ingredients.extend(ml_results["ingredients_analyzed"])
    
    ingredients_text = " ".join(set(all_ingredients)).lower()
    
    # Check health conditions
    for condition in conditions:
        condition_key = str(condition).lower().strip()
        if condition_key not in HEALTH_RULES:
            continue
        
        rules = HEALTH_RULES[condition_key]
        
        # Check nutrient thresholds
        nutrient_rules = rules.get("nutrients", {})
        for nutrient_key, rule in nutrient_rules.items():
            max_value = rule.get("max", float('inf'))
            penalty_value = rule.get("penalty", 2)
            
            actual_value = float(nutrients.get(nutrient_key, 0) or 
                               nutrients.get(nutrient_key.replace("_100g", ""), 0))
            
            if actual_value > max_value:
                total_penalty += penalty_value
                penalties.append({
                    "type": "condition",
                    "condition": condition_key,
                    "nutrient": nutrient_key,
                    "limit": max_value,
                    "actual": actual_value,
                    "penalty": penalty_value
                })
                warnings.extend(rules.get("warnings", []))
        
        # Check banned ingredients
        banned_ingredients = rules.get("ingredients", [])
        for banned in banned_ingredients:
            if str(banned).lower() in ingredients_text.lower():
                penalty_value = rules.get("penalty_points", 3)
                total_penalty += penalty_value
                penalties.append({
                    "type": "condition",
                    "condition": condition_key,
                    "banned_ingredient": banned,
                    "penalty": penalty_value
                })
                warnings.extend(rules.get("warnings", []))
    
    # Check allergies
    for allergy in allergies:
        allergy_key = str(allergy).lower().strip()
        
        # Try with and without "_allergy" suffix
        if allergy_key not in HEALTH_RULES:
            allergy_key = f"{allergy_key}_allergy"
        
        if allergy_key not in HEALTH_RULES:
            continue
        
        rules = HEALTH_RULES[allergy_key]
        allergens = rules.get("ingredients", [])
        
        for allergen in allergens:
            if str(allergen).lower() in ingredients_text.lower():
                penalty_value = rules.get("penalty_points", 5)
                total_penalty += penalty_value
                penalties.append({
                    "type": "allergy",
                    "allergy": allergy_key,
                    "allergen": allergen,
                    "penalty": penalty_value
                })
                warnings.append(f"⚠ ALLERGY ALERT: Contains {allergen}")
    
    return {
        "personalized_penalties": penalties,
        "personalized_warnings": list(set(warnings)),
        "total_personalized_penalty": total_penalty
    }


def calculate_unified_score(product_data: Dict[str, Any], user_profile: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Main unified scoring function
    Combines ML analysis + nutrition scoring + personalization
    
    Returns comprehensive score with detailed breakdown
    """
    if user_profile is None:
        user_profile = {"conditions": [], "allergies": []}
    
    # Extract nutrients
    nutrients = product_data.get("nutriments", {}) or product_data.get("nutrition", {})
    
    # Step 1: ML Analysis (ingredient detection, claim validation, synergies)
    ml_results = ml_analyze_product(product_data)
    
    # Step 2: Base nutrition score
    nutrition_score = calculate_base_nutrition_score(nutrients)
    
    # Step 3: Personalized penalties
    personalization = apply_personalized_penalties(ml_results, nutrients, user_profile)
    
    # Step 4: Calculate final score
    base_score = nutrition_score["base_score"]
    ml_penalty = ml_results.get("total_ml_penalty", 0)
    personalized_penalty = personalization["total_personalized_penalty"]
    
    # Convert penalties to 0-10 scale (ML penalties are already in points)
    final_score_10 = max(1, base_score - ml_penalty - personalized_penalty)
    final_score_100 = final_score_10 * 10
    
    # Determine tier
    if final_score_10 >= 8:
        tier = "Daily"
        tier_description = "Suitable for regular consumption"
    elif final_score_10 >= 5:
        tier = "Moderate"
        tier_description = "Consume occasionally"
    else:
        tier = "Occasional"
        tier_description = "Limit consumption"
    
    # Combine all warnings
    all_warnings = (
        ml_results.get("ml_warnings", []) +
        personalization.get("personalized_warnings", [])
    )
    
    # Build comprehensive breakdown
    breakdown = {
        "nutrition_base": nutrition_score["breakdown"],
        "ml_analysis": {
            "false_claims": ml_results.get("false_claims", []),
            "claim_penalty": ml_results.get("false_claim_penalty", 0),
            "synergies": ml_results.get("synergies_detected", []),
            "synergy_penalty": ml_results.get("synergy_penalty", 0)
        },
        "personalization": {
            "penalties": personalization["personalized_penalties"],
            "penalty_points": personalized_penalty
        }
    }
    
    return {
        "score": int(final_score_100),
        "score10": round(final_score_10, 1),
        "Score": int(final_score_100),
        "Tier": tier,
        "tier_description": tier_description,
        "Confidence": "HIGH" if ml_results["ingredient_count"] > 5 else "MEDIUM",
        "explanation": f"Score: {round(final_score_10, 1)}/10 — {tier}. {tier_description}.",
        "warnings": all_warnings,
        "personalizedWarnings": all_warnings,
        "Warnings": all_warnings[:5],  # Top 5 warnings
        "breakdown": breakdown,
        "ml_insights": {
            "ingredients_found": ml_results["ingredient_count"],
            "categories_detected": list(ml_results.get("ingredient_categories", {}).keys()),
            "false_claims_detected": len(ml_results.get("false_claims", [])),
            "synergies_found": len(ml_results.get("synergies_detected", []))
        },
        "scoring_method": "ML_ENHANCED",
        "_source": "ml-unified"
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    # Test case 1: Sugar-free product with sucrose (false claim)
    test_product_1 = {
        "product_name": "Sugar-Free Energy Drink",
        "ingredients_text": "water, sucrose, dextrose, citric acid, caffeine, natural flavors",
        "nutriments": {
            "sugars_100g": 0.1,
            "energy_100g": 150,
            "salt_100g": 0.2
        }
    }
    
    user_with_diabetes = {
        "conditions": ["diabetes"],
        "allergies": []
    }
    
    result1 = calculate_unified_score(test_product_1, user_with_diabetes)
    print("=== Test 1: Sugar-Free with Sucrose (Diabetic User) ===")
    print(json.dumps(result1, indent=2))
    print()
    
    # Test case 2: Fat-free product with palm oil
    test_product_2 = {
        "product_name": "Fat-Free Cookies",
        "ingredients_text": "flour, sugar, palm oil, eggs, vanilla extract",
        "nutriments": {
            "sugars_100g": 25,
            "fat_100g": 0.3,
            "salt_100g": 0.5
        }
    }
    
    result2 = calculate_unified_score(test_product_2)
    print("=== Test 2: Fat-Free with Palm Oil ===")
    print(json.dumps(result2, indent=2))
