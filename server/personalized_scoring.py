"""
Personalized Scoring System (0-100 scale)
Combines ML ingredient classification + nutritional data + user health profile
Evidence-based penalties using WHO/ADA/AHA guidelines
"""

import json
import os
import logging
from typing import Dict, List, Any, Tuple

# Load nutritional thresholds and evidence-based guidelines
THRESHOLDS_PATH = os.path.join(os.path.dirname(__file__), "nutritional_thresholds.json")
try:
    with open(THRESHOLDS_PATH, 'r', encoding='utf-8') as f:
        THRESHOLDS = json.load(f)
    logging.info("Loaded nutritional thresholds successfully")
except FileNotFoundError:
    logging.error("nutritional_thresholds.json not found")
    THRESHOLDS = {}

def calculate_position_weight(position: int) -> float:
    
    if position <= 3:
        return 1.5  # Top 3 ingredients (dominant)
    elif position <= 7:
        return 1.2  # Middle ingredients (moderate)
    else:
        return 1.0  # Minor/trace ingredients


def analyze_ingredient_positions(ingredients_list: List[str], ml_results: Dict[str, Any]) -> Dict[str, Dict]:
    """
    Map detected ingredients to their positions and calculate position weights.
    
    Args:
        ingredients_list: List of ingredient names in descending order
        ml_results: Results from ML classification containing detected categories
        
    Returns:
        Dict mapping ingredient name to {position, category, weight}
        
    Example:
        Input: 
            ingredients_list = ['wheat flour', 'sugar', 'palm oil', 'salt']
            ml_results with detected: sugar→'refined_sugar', palm oil→'fat'
        Output:
            {
                'sugar': {'position': 2, 'category': 'refined_sugar', 'weight': 1.5},
                'palm oil': {'position': 3, 'category': 'fat', 'weight': 1.5}
            }
    """
    position_map = {}
    
    # Normalize ingredients list for matching
    normalized_ingredients = [ing.lower().strip() for ing in ingredients_list]
    
    # Extract all detected ingredients from ML results
    detected_ingredients = {}
    
    # Check ingredient_categories structure
    if "ingredient_categories" in ml_results:
        for category, data in ml_results["ingredient_categories"].items():
            if "detected_items" in data:
                for item in data["detected_items"]:
                    ingredient_name = item.get("name", "").lower().strip()
                    if ingredient_name:
                        detected_ingredients[ingredient_name] = {
                            "category": category,
                            "harm_level": item.get("harm_level", "UNKNOWN"),
                            "detection_method": item.get("detected_by", "unknown")
                        }
    
    # Match detected ingredients to positions
    for ingredient_name, ingredient_data in detected_ingredients.items():
        # Find position in ingredient list (1-indexed)
        position = None
        for idx, norm_ing in enumerate(normalized_ingredients):
            # Check if detected ingredient matches or is contained in list ingredient
            if ingredient_name in norm_ing or norm_ing in ingredient_name:
                position = idx + 1  # 1-indexed
                break
        
        if position:
            position_map[ingredient_name] = {
                "position": position,
                "category": ingredient_data["category"],
                "weight": calculate_position_weight(position),
                "harm_level": ingredient_data["harm_level"]
            }
        else:
            # Ingredient detected but position unknown (default to middle)
            position_map[ingredient_name] = {
                "position": None,
                "category": ingredient_data["category"],
                "weight": 1.1,  # Slight penalty even if position unknown
                "harm_level": ingredient_data["harm_level"]
            }
    
    return position_map


def get_nutrient_penalty(nutrient: str, value: float) -> Tuple[float, str]:
    """
    Calculate penalty points for a nutrient based on evidence-based thresholds.
    Uses penalty_scales from nutritional_thresholds.json.
    
    Args:
        nutrient: Nutrient name (e.g., 'sugars', 'sodium', 'saturated_fat')
        value: Nutrient value per 100g
        
    Returns:
        Tuple of (penalty_points, threshold_label)
        
    Examples:
        get_nutrient_penalty('sugars', 8) → (3, "good-moderate")
        get_nutrient_penalty('sugars', 25) → (25, "poor-avoid")
        get_nutrient_penalty('sodium', 0.4) → (2, "good")
    """
    penalty_scales = THRESHOLDS.get("penalty_scales", {})
    
    if nutrient not in penalty_scales:
        logging.warning(f"No penalty scale found for nutrient: {nutrient}")
        return (0, "unknown")
    
    scales = penalty_scales[nutrient]
    
    # Parse threshold ranges and find matching penalty
    # Format: "0-5": 0, "5-10": 3, "10-15": 8, etc.
    for range_str, penalty in scales.items():
        if range_str.endswith('+'):
            # Handle "30+" format
            min_val = float(range_str.replace('+', ''))
            if value >= min_val:
                return (penalty, f"very-high (>{min_val})")
        else:
            # Handle "0-5" format
            try:
                min_val, max_val = range_str.split('-')
                min_val, max_val = float(min_val), float(max_val)
                if min_val <= value < max_val:
                    return (penalty, f"{range_str}")
            except ValueError:
                continue
    
    # Default to 0 if no range matches (should be lowest range)
    return (0, "excellent")


def get_bonus_points(nutrient: str, value: float) -> Tuple[float, str]:
    """
    Calculate bonus points for beneficial nutrients (fiber, protein).
    
    Args:
        nutrient: Nutrient name ('fiber' or 'protein')
        value: Nutrient value per 100g
        
    Returns:
        Tuple of (bonus_points, threshold_label)
        
    Examples:
        get_bonus_points('fiber', 5.5) → (5, "good-excellent")
        get_bonus_points('protein', 12) → (5, "good")
    """
    bonus_scales = THRESHOLDS.get("bonus_points", {})
    
    if nutrient not in bonus_scales:
        return (0, "none")
    
    scales = bonus_scales[nutrient]
    
    for range_str, bonus in scales.items():
        if range_str.endswith('+'):
            min_val = float(range_str.replace('+', ''))
            if value >= min_val:
                return (bonus, f"excellent (>{min_val})")
        else:
            try:
                min_val, max_val = range_str.split('-')
                min_val, max_val = float(min_val), float(max_val)
                if min_val <= value < max_val:
                    return (bonus, f"{range_str}")
            except ValueError:
                continue
    
    return (0, "minimal")


def calculate_ml_penalties(position_map: Dict[str, Dict], user_allergies: List[str] = None) -> Dict[str, Any]:
    """
    Calculate penalties from ML-classified ingredients with position weighting.
    Also checks for allergens regardless of category.
    
    Args:
        position_map: Output from analyze_ingredient_positions()
        user_allergies: List of allergens to check for (optional)
        
    Returns:
        Dict with penalty breakdown and total
        
    Example:
        {
            "penalties": [
                {"ingredient": "aspartame", "category": "artificial_sweetener",
                 "base_penalty": 7, "position": 4, "weight": 1.2, "final": 8.4}
            ],
            "total": 8.4
        }
    """
    ml_base_penalties = THRESHOLDS.get("ml_category_base_penalties", {})
    
    if user_allergies is None:
        user_allergies = []
    
    penalties = []
    total_penalty = 0
    
    for ingredient, data in position_map.items():
        category = data["category"]
        position = data["position"]
        weight = data["weight"]
        
        # Check for allergens FIRST - regardless of category
        is_allergen = any(allergen.lower() in ingredient.lower() for allergen in user_allergies)
        
        if is_allergen:
            # Allergen detected - apply severe flat penalty
            allergen_penalty = 50  # Severe base penalty
            total_penalty += allergen_penalty
            
            penalties.append({
                "ingredient": ingredient,
                "category": category + " (ALLERGEN)",
                "harm_level": "CRITICAL",
                "position": position,
                "base_penalty": allergen_penalty,
                "position_weight": 1.0,
                "final_penalty": allergen_penalty,
                "is_allergen": True
            })
            continue  # Skip normal penalty calculation for allergens
        
        # Normal penalty calculation
        base_penalty = ml_base_penalties.get(category, 0)
        
        # Skip if no penalty (or bonus)
        if base_penalty <= 0:
            continue
        
        final_penalty = base_penalty * weight
        total_penalty += final_penalty
        
        penalties.append({
            "ingredient": ingredient,
            "category": category,
            "harm_level": data["harm_level"],
            "position": position,
            "base_penalty": base_penalty,
            "position_weight": weight,
            "final_penalty": round(final_penalty, 2),
            "is_allergen": False
        })
    
    return {
        "penalties": penalties,
        "total": round(total_penalty, 2)
    }


# ==================== STEP 2: PERSONALIZED SCORING WITH USER PROFILE ====================

def apply_condition_multipliers(
    ml_penalties: Dict[str, Any],
    nutrition_penalties: Dict[str, Any],
    user_profile: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Apply health condition multipliers to penalties based on user profile.
    
    Args:
        ml_penalties: Output from calculate_ml_penalties()
        nutrition_penalties: Output from calculate_nutrition_penalties()
        user_profile: {
            "conditions": ["diabetes", "heart_disease"],
            "allergies": ["peanuts", "soy"]
        }
        
    Returns:
        Dict with adjusted penalties and multipliers applied
    """
    conditions = user_profile.get("conditions", [])
    allergies = user_profile.get("allergies", [])
    
    health_multipliers = THRESHOLDS.get("health_condition_multipliers", {})
    
    adjusted_ml_penalties = []
    adjusted_nutrition_penalties = []
    total_ml_penalty = 0
    total_nutrition_penalty = 0
    
    # Apply multipliers to ML-based penalties
    for penalty_item in ml_penalties.get("penalties", []):
        ingredient = penalty_item["ingredient"]
        category = penalty_item["category"]
        base_final = penalty_item["final_penalty"]
        is_allergen = penalty_item.get("is_allergen", False)
        
        # If already marked as allergen, don't multiply - just pass through
        if is_allergen:
            adjusted_ml_penalties.append({
                **penalty_item,
                "condition_multiplier": 1.0,
                "condition_reason": "⚠️ ALLERGEN - CRITICAL",
                "adjusted_penalty": base_final
            })
            total_ml_penalty += base_final
            continue
        
        # Find highest applicable multiplier for this category
        max_multiplier = 1.0
        applied_condition = None
        
        for condition in conditions:
            condition_key = condition.lower().strip()
            if condition_key in health_multipliers:
                category_mults = health_multipliers[condition_key].get("category_multipliers", {})
                if category in category_mults:
                    mult = category_mults[category]
                    if mult > max_multiplier:
                        max_multiplier = mult
                        applied_condition = condition_key
        
        adjusted_penalty = base_final * max_multiplier
        adjusted_ml_penalties.append({
            **penalty_item,
            "condition_multiplier": max_multiplier,
            "condition_reason": applied_condition or "none",
            "adjusted_penalty": round(adjusted_penalty, 2)
        })
        total_ml_penalty += adjusted_penalty
    
    # Apply multipliers to nutrition-based penalties
    for penalty_item in nutrition_penalties.get("penalties", []):
        nutrient = penalty_item["nutrient"]
        base_penalty = penalty_item["penalty"]
        
        # Find highest applicable multiplier for this nutrient
        max_multiplier = 1.0
        applied_condition = None
        
        for condition in conditions:
            condition_key = condition.lower().strip()
            if condition_key in health_multipliers:
                nutrient_mults = health_multipliers[condition_key].get("nutrient_multipliers", {})
                if nutrient in nutrient_mults:
                    mult = nutrient_mults[nutrient]
                    if mult > max_multiplier:
                        max_multiplier = mult
                        applied_condition = condition_key
        
        adjusted_penalty = base_penalty * max_multiplier
        adjusted_nutrition_penalties.append({
            **penalty_item,
            "condition_multiplier": max_multiplier,
            "condition_reason": applied_condition or "none",
            "adjusted_penalty": round(adjusted_penalty, 2)
        })
        total_nutrition_penalty += adjusted_penalty
    
    # Bonuses are also affected by conditions (inversely)
    adjusted_bonuses = []
    total_bonus = 0
    
    for bonus_item in nutrition_penalties.get("bonuses", []):
        nutrient = bonus_item["nutrient"]
        base_bonus = bonus_item["bonus"]
        
        # Find lowest applicable multiplier for bonuses (lower is better for good nutrients)
        min_multiplier = 1.0
        applied_condition = None
        
        for condition in conditions:
            condition_key = condition.lower().strip()
            if condition_key in health_multipliers:
                nutrient_mults = health_multipliers[condition_key].get("nutrient_multipliers", {})
                if nutrient in nutrient_mults:
                    mult = nutrient_mults[nutrient]  # This is < 1.0 for beneficial nutrients
                    if mult < min_multiplier:
                        min_multiplier = mult
                        applied_condition = condition_key
        
        # For bonuses, lower multiplier means MORE bonus (e.g., fiber 0.5× = double bonus)
        adjusted_bonus = base_bonus / min_multiplier if min_multiplier < 1.0 else base_bonus
        adjusted_bonuses.append({
            **bonus_item,
            "condition_multiplier": min_multiplier,
            "condition_reason": applied_condition or "none",
            "adjusted_bonus": round(adjusted_bonus, 2)
        })
        total_bonus += adjusted_bonus
    
    return {
        "ml_penalties": adjusted_ml_penalties,
        "nutrition_penalties": adjusted_nutrition_penalties,
        "bonuses": adjusted_bonuses,
        "total_ml_penalty": round(total_ml_penalty, 2),
        "total_nutrition_penalty": round(total_nutrition_penalty, 2),
        "total_bonus": round(total_bonus, 2),
        "total_penalty": round(total_ml_penalty + total_nutrition_penalty, 2),
        "net_penalty": round(total_ml_penalty + total_nutrition_penalty - total_bonus, 2),
        "conditions_applied": conditions,
        "allergens_detected": len([p for p in adjusted_ml_penalties if "ALLERGEN" in p.get("condition_reason", "")])
    }


def get_score_label_and_recommendation(score: float, was_capped: bool = False) -> Dict[str, str]:
    """
    Get label, color, emoji, and recommendation based on score.
    
    Args:
        score: Final score (10-100, capped at minimum 10)
        was_capped: Whether score was capped at minimum (indicates critical risk)
        
    Returns:
        Dict with label, color, emoji, recommendation, guideline
    """
    score_ranges = THRESHOLDS.get("score_ranges", {})
    
    # Determine which range the score falls into
    if score >= 90:
        range_key = "90-100"
    elif score >= 75:
        range_key = "75-89"
    elif score >= 60:
        range_key = "60-74"
    elif score >= 45:
        range_key = "45-59"
    elif score >= 30:
        range_key = "30-44"
    elif score >= 10:
        range_key = "10-29"
    else:
        range_key = "0-9"
    
    range_data = score_ranges.get(range_key, {
        "label": "Unknown",
        "color": "#808080",
        "emoji": "❓",
        "recommendation": "Unable to determine",
        "guideline": ""
    })
    
    result = {
        "label": range_data.get("label", "Unknown"),
        "color": range_data.get("color", "#808080"),
        "emoji": range_data.get("emoji", "❓"),
        "recommendation": range_data.get("recommendation", ""),
        "guideline": range_data.get("guideline", "")
    }
    
    # Add critical warning if score was capped
    if was_capped and score <= 15:
        result["critical_warning"] = True
        result["warning_message"] = "⚠️ This product significantly exceeds safe limits for your health condition."
    
    return result


def calculate_personalized_score(
    ml_results: Dict[str, Any],
    nutrients: Dict[str, float],
    ingredients_list: List[str] = None,
    user_profile: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Main function: Calculate personalized score (0-100) combining ML + nutrition + user profile.
    
    Args:
        ml_results: Results from ml_engine.ml_analyze_product()
        nutrients: Nutritional data per 100g {sugars_100g: 15, sodium_100g: 0.8, ...}
        ingredients_list: Ordered list of ingredients (optional, improves accuracy)
        user_profile: User health profile (optional, defaults to no conditions)
                     {conditions: ["diabetes"], allergies: ["peanuts"]}
        
    Returns:
        Complete scoring breakdown with final score, penalties, bonuses, recommendations
        
    Example:
        {
            "final_score": 73,
            "score_label": "Good",
            "score_color": "#84CC16",
            "emoji": "👍",
            "recommendation": "Good option for regular consumption",
            "breakdown": {...},
            "user_conditions": ["diabetes"]
        }
    """
    # Default empty profile if not provided
    if user_profile is None:
        user_profile = {"conditions": [], "allergies": []}
    
    # Step 1: Analyze ingredient positions
    position_map = {}
    if ingredients_list:
        position_map = analyze_ingredient_positions(ingredients_list, ml_results)
    else:
        # Fallback: create position map without position weighting
        logging.warning("No ingredients_list provided, position weighting disabled")
        if "ingredient_categories" in ml_results:
            for category, data in ml_results["ingredient_categories"].items():
                if "detected_items" in data:
                    for item in data["detected_items"]:
                        ingredient_name = item.get("name", "").lower().strip()
                        if ingredient_name:
                            position_map[ingredient_name] = {
                                "position": None,
                                "category": category,
                                "weight": 1.1,  # Slight penalty
                                "harm_level": item.get("harm_level", "UNKNOWN")
                            }
    
    # Step 2: Calculate base penalties
    ml_penalties = calculate_ml_penalties(position_map, user_profile.get("allergies", []))
    nutrition_penalties = calculate_nutrition_penalties(nutrients)
    
    # Step 3: Apply user profile multipliers
    adjusted_penalties = apply_condition_multipliers(
        ml_penalties,
        nutrition_penalties,
        user_profile
    )
    
    # Step 4: Calculate final score
    final_score = 100 - adjusted_penalties["net_penalty"]
    
    # Clamp score to 10-100 range (minimum 10 for user-friendly messaging)
    # Scores below 10 indicate severe health risk but we cap at 10 to avoid "absolute zero"
    final_score = max(10, min(100, final_score))
    final_score = round(final_score, 1)
    
    # Track if score was capped (important for critical risk warnings)
    was_capped = (100 - adjusted_penalties["net_penalty"]) < 10
    
    # Step 5: Get label and recommendation
    score_info = get_score_label_and_recommendation(final_score, was_capped)
    
    # Step 6: Build complete response
    return {
        "final_score": final_score,
        "score_label": score_info["label"],
        "score_color": score_info["color"],
        "emoji": score_info["emoji"],
        "recommendation": score_info["recommendation"],
        "guideline": score_info.get("guideline", ""),
        "critical_warning": score_info.get("critical_warning", False),
        "warning_message": score_info.get("warning_message", ""),
        
        "breakdown": {
            "ml_penalties": adjusted_penalties["ml_penalties"],
            "nutrition_penalties": adjusted_penalties["nutrition_penalties"],
            "bonuses": adjusted_penalties["bonuses"],
            
            "total_ml_penalty": adjusted_penalties["total_ml_penalty"],
            "total_nutrition_penalty": adjusted_penalties["total_nutrition_penalty"],
            "total_penalty": adjusted_penalties["total_penalty"],
            "total_bonus": adjusted_penalties["total_bonus"],
            "net_penalty": adjusted_penalties["net_penalty"]
        },
        
        "user_profile": {
            "conditions": adjusted_penalties["conditions_applied"],
            "allergens_detected": adjusted_penalties["allergens_detected"]
        },
        
        "metadata": {
            "scoring_version": "1.0",
            "has_position_data": bool(ingredients_list),
            "total_ingredients_analyzed": len(position_map)
        }
    }


def calculate_nutrition_penalties(nutrients: Dict[str, float]) -> Dict[str, Any]:
    """
    Calculate penalties from actual nutritional values (per 100g).
    
    Args:
        nutrients: Dict of nutrient values per 100g
                  {sugars_100g: 15, sodium_100g: 0.8, ...}
        
    Returns:
        Dict with penalty breakdown, bonuses, and total
        
    Example:
        {
            "penalties": [
                {"nutrient": "sugars", "value": 15, "penalty": 8, "threshold": "10-15"}
            ],
            "bonuses": [
                {"nutrient": "fiber", "value": 4.5, "bonus": 3, "threshold": "3-6"}
            ],
            "total_penalty": 8,
            "total_bonus": 3,
            "net": 5
        }
    """
    # Nutrient name mapping (handle both formats)
    nutrient_mapping = {
        "sugars_100g": "sugars",
        "sugars": "sugars",
        "sodium_100g": "sodium",
        "sodium": "sodium",
        "salt_100g": "sodium",  # Convert salt to sodium
        "saturated-fat_100g": "saturated_fat",
        "saturated_fat_100g": "saturated_fat",
        "saturated_fat": "saturated_fat",
        "trans-fat_100g": "trans_fat",
        "trans_fat_100g": "trans_fat",
        "trans_fat": "trans_fat",
        "fat_100g": "fat_total",
        "fat": "fat_total",
        "cholesterol_100g": "cholesterol",
        "cholesterol": "cholesterol",
        "fiber_100g": "fiber",
        "fiber": "fiber",
        "proteins_100g": "protein",
        "protein_100g": "protein",
        "protein": "protein"
    }
    
    def normalize_nutrient_value_for_penalty(
        nutrient_key: str,
        normalized_nutrient: str,
        raw_value: float
    ) -> float:
        """
        Normalize unit mismatches before applying penalty scales.

        Sodium scales are defined in g/100g, but some sources (and manual entry)
        provide sodium in mg/100g. We also convert salt->sodium when salt fields are used.
        """
        value = float(raw_value or 0)
        key = (nutrient_key or "").lower()

        if normalized_nutrient == "sodium":
            # Salt values are in g/100g salt; convert to sodium g/100g.
            if "salt" in key:
                return value * 0.393

            # If sodium looks like mg/100g (e.g., 130), convert mg->g.
            if value > 5:
                return value / 1000.0

        return value

    penalties = []
    bonuses = []
    total_penalty = 0
    total_bonus = 0
    
    # Track which normalized nutrients have been processed (prevent duplicates)
    processed_penalties = set()
    processed_bonuses = set()
    
    # Calculate penalties for harmful nutrients
    penalty_nutrients = ["sugars", "sodium", "saturated_fat", "trans_fat", "fat_total", "cholesterol"]
    for nutrient_key, value in nutrients.items():
        normalized_nutrient = nutrient_mapping.get(nutrient_key, nutrient_key)
        
        if normalized_nutrient in penalty_nutrients:
            # Skip if we've already processed this normalized nutrient
            if normalized_nutrient in processed_penalties:
                continue
            
            # Mark as processed immediately to prevent duplicates
            processed_penalties.add(normalized_nutrient)
            
            value_float = normalize_nutrient_value_for_penalty(
                nutrient_key,
                normalized_nutrient,
                value
            )
            penalty, threshold = get_nutrient_penalty(normalized_nutrient, value_float)
            
            if penalty > 0:
                total_penalty += penalty
                penalties.append({
                    "nutrient": normalized_nutrient,
                    "value": value_float,
                    "penalty": penalty,
                    "threshold": threshold
                })
    
    # Calculate bonuses for beneficial nutrients
    bonus_nutrients = ["fiber", "protein"]
    for nutrient_key, value in nutrients.items():
        normalized_nutrient = nutrient_mapping.get(nutrient_key, nutrient_key)
        
        if normalized_nutrient in bonus_nutrients:
            # Skip if we've already processed this normalized nutrient
            if normalized_nutrient in processed_bonuses:
                continue
            
            # Mark as processed immediately to prevent duplicates
            processed_bonuses.add(normalized_nutrient)
            
            value_float = float(value or 0)
            bonus, threshold = get_bonus_points(normalized_nutrient, value_float)
            
            if bonus > 0:
                total_bonus += bonus
                bonuses.append({
                    "nutrient": normalized_nutrient,
                    "value": value_float,
                    "bonus": bonus,
                    "threshold": threshold
                })
    
    return {
        "penalties": penalties,
        "bonuses": bonuses,
        "total_penalty": round(total_penalty, 2),
        "total_bonus": round(total_bonus, 2),
        "net": round(total_penalty - total_bonus, 2)
    }


# ==================== TESTING & EXAMPLES ====================

if __name__ == "__main__":
    # Test position weight calculation
    print("=== Position Weight Tests ===")
    for pos in [1, 3, 5, 8, 12]:
        weight = calculate_position_weight(pos)
        print(f"Position {pos}: weight = {weight}x")
    
    print("\n=== Nutrient Penalty Tests ===")
    test_nutrients = [
        ("sugars", 5),
        ("sugars", 15),
        ("sugars", 30),
        ("sodium", 0.4),
        ("sodium", 1.2),
        ("sodium", 2.5),
        ("saturated_fat", 2),
        ("saturated_fat", 6),
        ("saturated_fat", 12)
    ]
    
    for nutrient, value in test_nutrients:
        penalty, threshold = get_nutrient_penalty(nutrient, value)
        print(f"{nutrient} = {value}g/100g -> Penalty: {penalty} pts ({threshold})")
    
    print("\n=== Bonus Points Tests ===")
    test_bonuses = [
        ("fiber", 1),
        ("fiber", 4.5),
        ("fiber", 8),
        ("protein", 3),
        ("protein", 10),
        ("protein", 18)
    ]
    
    for nutrient, value in test_bonuses:
        bonus, threshold = get_bonus_points(nutrient, value)
        print(f"{nutrient} = {value}g/100g -> Bonus: +{bonus} pts ({threshold})")
    
    print("\n=== Nutrition Penalties Test ===")
    test_nutrition = {
        "sugars_100g": 15,
        "sodium_100g": 0.8,
        "saturated_fat_100g": 5.2,
        "fiber_100g": 4.5,
        "protein_100g": 8
    }
    
    result = calculate_nutrition_penalties(test_nutrition)
    print(f"Total penalties: {result['total_penalty']} pts")
    print(f"Total bonuses: +{result['total_bonus']} pts")
    print(f"Net: {result['net']} pts")
    print("\nBreakdown:")
    for p in result['penalties']:
        print(f"  - {p['nutrient']}: {p['value']}g -> -{p['penalty']} pts")
    for b in result['bonuses']:
        print(f"  + {b['nutrient']}: {b['value']}g -> +{b['bonus']} pts")
    
    print("\n=== ML Penalty Test ===")
    # Simulate position map
    test_position_map = {
        "sugar": {"position": 2, "category": "refined_sugar", "weight": 1.5, "harm_level": "MEDIUM"},
        "aspartame": {"position": 5, "category": "artificial_sweetener", "weight": 1.2, "harm_level": "MEDIUM"},
        "sodium benzoate": {"position": 9, "category": "harmful_preservative", "weight": 1.0, "harm_level": "HIGH"}
    }
    
    ml_result = calculate_ml_penalties(test_position_map, user_allergies=[])
    print(f"Total ML penalties: {ml_result['total']} pts")
    print("\nBreakdown:")
    for p in ml_result['penalties']:
        print(f"  - {p['ingredient']} (pos {p['position']}): {p['base_penalty']} × {p['position_weight']} = {p['final_penalty']} pts")
    
    print("\n" + "="*60)
    print("=== STEP 2: PERSONALIZED SCORING TESTS ===")
    print("="*60)
    
    # Test Case 1: Healthy user (no conditions)
    print("\n### Test Case 1: Healthy User ###")
    test_ml_results_1 = {
        "ingredient_categories": {
            "refined_sugar": {
                "detected_items": [{"name": "sugar", "harm_level": "MEDIUM", "detected_by": "ml"}]
            },
            "fat": {
                "detected_items": [{"name": "palm oil", "harm_level": "LOW", "detected_by": "ml"}]
            }
        }
    }
    test_nutrients_1 = {
        "sugars_100g": 12,
        "fat_100g": 18,
        "saturated_fat_100g": 4,
        "sodium_100g": 0.5,
        "fiber_100g": 3.5,
        "protein_100g": 6
    }
    test_ingredients_1 = ["wheat flour", "sugar", "palm oil", "salt"]
    
    result_1 = calculate_personalized_score(
        test_ml_results_1,
        test_nutrients_1,
        test_ingredients_1,
        user_profile={"conditions": [], "allergies": []}
    )
    
    print(f"\n🎯 Final Score: {result_1['final_score']}/100")
    print(f"📊 Label: {result_1['emoji']} {result_1['score_label']}")
    print(f"💡 Recommendation: {result_1['recommendation']}")
    print(f"\nPenalties: ML={result_1['breakdown']['total_ml_penalty']} + Nutrition={result_1['breakdown']['total_nutrition_penalty']}")
    print(f"Bonuses: +{result_1['breakdown']['total_bonus']}")
    print(f"Net: {result_1['breakdown']['net_penalty']} pts")
    
    # Test Case 2: Diabetic user (same product)
    print("\n\n### Test Case 2: Diabetic User (Same Product) ###")
    result_2 = calculate_personalized_score(
        test_ml_results_1,
        test_nutrients_1,
        test_ingredients_1,
        user_profile={"conditions": ["diabetes"], "allergies": []}
    )
    
    print(f"\n🎯 Final Score: {result_2['final_score']}/100")
    print(f"📊 Label: {result_2['emoji']} {result_2['score_label']}")
    print(f"💡 Recommendation: {result_2['recommendation']}")
    print(f"\nPenalties: ML={result_2['breakdown']['total_ml_penalty']} + Nutrition={result_2['breakdown']['total_nutrition_penalty']}")
    print(f"Bonuses: +{result_2['breakdown']['total_bonus']}")
    print(f"Net: {result_2['breakdown']['net_penalty']} pts")
    print(f"\n📈 Score difference: {result_1['final_score'] - result_2['final_score']} pts lower for diabetic user")
    
    # Test Case 3: Heart disease + High sodium product
    print("\n\n### Test Case 3: Heart Disease User + High Sodium Product ###")
    test_ml_results_3 = {
        "ingredient_categories": {
            "harmful_preservative": {
                "detected_items": [{"name": "sodium benzoate", "harm_level": "HIGH", "detected_by": "ml"}]
            },
            "fat": {
                "detected_items": [{"name": "vegetable oil", "harm_level": "LOW", "detected_by": "ml"}]
            }
        }
    }
    test_nutrients_3 = {
        "sugars_100g": 2,
        "fat_100g": 25,
        "saturated_fat_100g": 8,
        "sodium_100g": 1.8,
        "cholesterol_100g": 180,
        "fiber_100g": 1,
        "protein_100g": 12
    }
    test_ingredients_3 = ["chicken", "vegetable oil", "salt", "sodium benzoate", "spices"]
    
    result_3 = calculate_personalized_score(
        test_ml_results_3,
        test_nutrients_3,
        test_ingredients_3,
        user_profile={"conditions": ["heart_disease"], "allergies": []}
    )
    
    print(f"\n🎯 Final Score: {result_3['final_score']}/100")
    print(f"📊 Label: {result_3['emoji']} {result_3['score_label']}")
    print(f"💡 Recommendation: {result_3['recommendation']}")
    print(f"\nCondition-adjusted penalties:")
    for p in result_3['breakdown']['nutrition_penalties']:
        print(f"  - {p['nutrient']}: {p['penalty']} × {p['condition_multiplier']} = {p['adjusted_penalty']} pts ({p['condition_reason']})")
    
    # Test Case 4: Allergen detection
    print("\n\n### Test Case 4: Allergen Detection (Peanut Allergy) ###")
    test_ml_results_4 = {
        "ingredient_categories": {
            "other": {
                "detected_items": [
                    {"name": "peanuts", "harm_level": "LOW", "detected_by": "ml"},
                    {"name": "wheat flour", "harm_level": "LOW", "detected_by": "ml"}
                ]
            }
        }
    }
    test_nutrients_4 = {
        "sugars_100g": 5,
        "fat_100g": 22,
        "saturated_fat_100g": 3,
        "sodium_100g": 0.3,
        "fiber_100g": 8,
        "protein_100g": 15
    }
    test_ingredients_4 = ["peanuts", "wheat flour", "honey", "salt"]
    
    result_4 = calculate_personalized_score(
        test_ml_results_4,
        test_nutrients_4,
        test_ingredients_4,
        user_profile={"conditions": [], "allergies": ["peanuts"]}
    )
    
    print(f"\n🎯 Final Score: {result_4['final_score']}/100")
    print(f"📊 Label: {result_4['emoji']} {result_4['score_label']}")
    print(f"💡 Recommendation: {result_4['recommendation']}")
    print(f"⚠️ Allergens detected: {result_4['user_profile']['allergens_detected']}")
    if result_4['user_profile']['allergens_detected'] > 0:
        print("   🚨 SEVERE PENALTY APPLIED (5.0× multiplier)")
    
    print("\n" + "="*60)
    print("✅ All Step 2 tests completed!")
    print("="*60)
