"""
ML Engine for Intelligent Food Ingredient Analysis
Uses Hugging Face transformers for:
- Named Entity Recognition (NER) to extract ingredients
- Zero-shot classification for ingredient categorization
- Semantic similarity for alias matching
- Claim validation
"""

import json
import os
import logging
from typing import List, Dict, Any, Tuple
import re

# Lazy imports to avoid loading heavy libraries unless needed
_transformers_loaded = False
_models_cache = {}

def _load_transformers():
    """Lazy load transformers and models"""
    global _transformers_loaded, _models_cache
    if _transformers_loaded:
        return
    
    try:
        from transformers import pipeline
        from sentence_transformers import SentenceTransformer, util
        
        logging.info("Loading ML models (this may take a minute on first run)...")
        
        # Zero-shot classification for ingredient categorization
        _models_cache['zero_shot'] = pipeline(
            "zero-shot-classification",
            model="facebook/bart-large-mnli",
            device=-1  # CPU
        )
        
        # Sentence similarity for alias matching
        _models_cache['similarity'] = SentenceTransformer('all-MiniLM-L6-v2')
        
        _transformers_loaded = True
        logging.info("ML models loaded successfully")
        
    except Exception as e:
        logging.error(f"Failed to load ML models: {e}")
        logging.warning("Falling back to rule-based matching")
        _transformers_loaded = False


# Load ingredient database
DB_PATH = os.path.join(os.path.dirname(__file__), "ingredient_database.json")
UNKNOWN_CACHE_PATH = os.path.join(os.path.dirname(__file__), "unknown_ingredients_cache.json")
HARM_LEVELS_PATH = os.path.join(os.path.dirname(__file__), "ingredient_harm_levels.json")

try:
    with open(DB_PATH, 'r', encoding='utf-8') as f:
        INGREDIENT_DB = json.load(f)
    logging.info(f"Loaded ingredient database from {DB_PATH}")
except FileNotFoundError:
    logging.error(f"ingredient_database.json not found at {DB_PATH}")
    INGREDIENT_DB = {}

# Load harm levels and food categories
try:
    with open(HARM_LEVELS_PATH, 'r', encoding='utf-8') as f:
        HARM_LEVELS = json.load(f)
    logging.info(f"Loaded harm levels from {HARM_LEVELS_PATH}")
except:
    HARM_LEVELS = {}

# Load unknown ingredients cache
try:
    with open(UNKNOWN_CACHE_PATH, 'r', encoding='utf-8') as f:
        UNKNOWN_CACHE = json.load(f)
except:
    UNKNOWN_CACHE = {"learned_ingredients": {}, "last_updated": None, "version": "1.0"}


def extract_ingredients(ingredients_text: str) -> List[str]:
    """
    Extract clean ingredient list from messy text
    Handles comma-separated, semicolon-separated, and line-separated lists
    """
    if not ingredients_text:
        return []
    
    # Clean the text
    text = ingredients_text.lower().strip()
    
    # Remove common non-ingredient phrases
    remove_patterns = [
        r'ingredients?:',
        r'contains?:',
        r'may contain:',
        r'allergen info:',
        r'manufactured in',
        r'processed in',
        r'packaged in',
        r'\([^)]*facility[^)]*\)',
        r'e\.g\.',
        r'i\.e\.',
    ]
    
    for pattern in remove_patterns:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)
    
    # Split by common separators
    separators = r'[,;.\n]'
    ingredients = re.split(separators, text)
    
    # Clean each ingredient
    cleaned = []
    for ing in ingredients:
        ing = ing.strip()
        # Remove parenthetical notes
        ing = re.sub(r'\([^)]*\)', '', ing).strip()
        # Remove percentage indicators
        ing = re.sub(r'\d+\.?\d*\s*%', '', ing).strip()
        # Remove empty or too short items
        if ing and len(ing) > 2:
            cleaned.append(ing)
    
    return cleaned


def detect_ingredient_category(ingredient: str, category: str, threshold: float = 0.7) -> Tuple[bool, float, str, str]:
    """
    Detect if an ingredient belongs to a category using semantic matching
    Returns (is_match, confidence_score, ingredient_type, harm_level)
    ingredient_type: "natural", "artificial", "processed", or "unknown"
    harm_level: "VERY_LOW", "LOW", "MEDIUM", "HIGH", "VERY_HIGH", or "UNKNOWN"
    """
    category_key = f"{category}_aliases"
    if category_key not in INGREDIENT_DB:
        return False, 0.0, "unknown", "UNKNOWN"
    
    aliases = INGREDIENT_DB[category_key].get("aliases", [])
    ingredient_type = INGREDIENT_DB[category_key].get("type", "unknown")
    harm_level = INGREDIENT_DB[category_key].get("harm_level", "UNKNOWN")
    ingredient_lower = ingredient.lower().strip()
    
    # First try exact matching (fast)
    for alias in aliases:
        if alias in ingredient_lower or ingredient_lower in alias:
            return True, 1.0, ingredient_type, harm_level
    
    # If transformers available, use semantic matching
    if _transformers_loaded and 'similarity' in _models_cache:
        try:
            model = _models_cache['similarity']
            ing_embedding = model.encode(ingredient_lower, convert_to_tensor=True)
            
            max_similarity = 0.0
            for alias in aliases[:20]:  # Limit for performance
                alias_embedding = model.encode(alias, convert_to_tensor=True)
                similarity = util.cos_sim(ing_embedding, alias_embedding).item()
                max_similarity = max(max_similarity, similarity)
                
                if similarity >= threshold:
                    return True, similarity, ingredient_type, harm_level
            
            return False, max_similarity, ingredient_type, harm_level
            
        except Exception as e:
            logging.warning(f"Semantic matching failed: {e}, using rule-based")
            return False, 0.0, ingredient_type, harm_level
    
    return False, 0.0, ingredient_type, harm_level


def classify_unknown_ingredient(ingredient: str) -> Dict[str, Any]:
    """
    Classify an unknown ingredient using ML and cache the result
    Uses zero-shot classification to determine category
    """
    ingredient_lower = ingredient.lower().strip()
    
    # Check cache first
    if ingredient_lower in UNKNOWN_CACHE.get("learned_ingredients", {}):
        cached = UNKNOWN_CACHE["learned_ingredients"][ingredient_lower]
        logging.info(f"Found cached classification for '{ingredient}': {cached['category']}")
        return cached
    
    # Use zero-shot classification if available
    if _transformers_loaded and 'zero_shot' in _models_cache:
        try:
            classifier = _models_cache['zero_shot']
            
            # Categories to classify into
            candidate_labels = [
                "natural sweetener",
                "artificial sweetener", 
                "refined sugar",
                "natural food ingredient",
                "preservative",
                "artificial additive",
                "healthy ingredient",
                "unhealthy ingredient"
            ]
            
            result = classifier(ingredient, candidate_labels)
            
            top_category = result['labels'][0]
            confidence = result['scores'][0]
            
            classification = {
                "name": ingredient,
                "category": top_category,
                "confidence": confidence,
                "type": "natural" if "natural" in top_category else "artificial" if "artificial" in top_category else "processed",
                "detected_by": "ml_zero_shot"
            }
            
            # Cache if confidence is high
            if confidence > 0.6:
                UNKNOWN_CACHE["learned_ingredients"][ingredient_lower] = classification
                save_unknown_cache()
                logging.info(f"Learned new ingredient '{ingredient}' as '{top_category}' (confidence: {confidence:.2f})")
            
            return classification
            
        except Exception as e:
            logging.warning(f"Zero-shot classification failed for '{ingredient}': {e}")
    
    # Fallback: basic heuristic classification
    return classify_ingredient_heuristic(ingredient)


def classify_ingredient_heuristic(ingredient: str) -> Dict[str, Any]:
    """
    Enhanced heuristic-based classification for unknown ingredients
    Now includes whole food categories and harm levels
    """
    ingredient_lower = ingredient.lower().strip()
    
    # Check whole food categories first (HEALTHY)
    if HARM_LEVELS and "whole_food_categories" in HARM_LEVELS:
        for food_type, data in HARM_LEVELS["whole_food_categories"].items():
            keywords = data.get("keywords", [])
            if any(keyword in ingredient_lower for keyword in keywords):
                return {
                    "name": ingredient,
                    "category": f"whole_food_{food_type}",
                    "confidence": 0.9,
                    "type": data.get("type", "natural"),
                    "harm_level": data.get("harm_level", "VERY_LOW"),
                    "score_impact": data.get("score_boost", 2),
                    "detected_by": "heuristic_whole_food"
                }
    
    # Check processed food indicators (UNHEALTHY)
    if HARM_LEVELS and "processed_food_indicators" in HARM_LEVELS:
        for food_type, data in HARM_LEVELS["processed_food_indicators"].items():
            keywords = data.get("keywords", [])
            if any(keyword in ingredient_lower for keyword in keywords):
                return {
                    "name": ingredient,
                    "category": f"processed_{food_type}",
                    "confidence": 0.85,
                    "type": data.get("type", "processed"),
                    "harm_level": data.get("harm_level", "MEDIUM"),
                    "score_impact": -data.get("penalty", 5),
                    "detected_by": "heuristic_processed_food"
                }
    
    # Check for E-numbers (ADDITIVES)
    if re.match(r'e\d{3,4}', ingredient_lower):
        return {
            "name": ingredient,
            "category": "artificial additive",
            "confidence": 0.9,
            "type": "artificial",
            "harm_level": "HIGH",
            "score_impact": -10,
            "detected_by": "heuristic_e_number"
        }
    
    # Check for common natural food words
    natural_keywords = ['fruit', 'vegetable', 'grain', 'flour', 'oil', 'extract', 'seed', 'nut', 'bean', 'herb', 'spice']
    if any(kw in ingredient_lower for kw in natural_keywords):
        return {
            "name": ingredient,
            "category": "natural food ingredient",
            "confidence": 0.7,
            "type": "natural",
            "harm_level": "LOW",
            "score_impact": 1,
            "detected_by": "heuristic_keywords"
        }
    
    # Check for harmful markers
    harmful_keywords = {
        'artificial': ('HIGH', -8),
        'synthetic': ('HIGH', -8),
        'modified': ('MEDIUM', -5),
        'hydrogenated': ('VERY_HIGH', -12),
        'hydrolyzed': ('MEDIUM', -6),
        'mechanically separated': ('HIGH', -10)
    }
    
    for keyword, (harm, penalty) in harmful_keywords.items():
        if keyword in ingredient_lower:
            return {
                "name": ingredient,
                "category": "processed additive",
                "confidence": 0.8,
                "type": "artificial" if harm in ["HIGH", "VERY_HIGH"] else "processed",
                "harm_level": harm,
                "score_impact": penalty,
                "detected_by": "heuristic_keywords"
            }
    
    # Unknown
    return {
        "name": ingredient,
        "category": "unknown",
        "confidence": 0.3,
        "type": "unknown",
        "harm_level": "UNKNOWN",
        "score_impact": 0,
        "detected_by": "fallback"
    }


def save_unknown_cache():
    """Save unknown ingredients cache to disk"""
    try:
        import datetime
        UNKNOWN_CACHE["last_updated"] = datetime.datetime.now().isoformat()
        with open(UNKNOWN_CACHE_PATH, 'w', encoding='utf-8') as f:
            json.dump(UNKNOWN_CACHE, f, indent=2)
        logging.info(f"Saved {len(UNKNOWN_CACHE['learned_ingredients'])} learned ingredients to cache")
    except Exception as e:
        logging.warning(f"Failed to save unknown cache: {e}")


def detect_all_forms(ingredients_list: List[str], category: str) -> Dict[str, Any]:
    """
    Detect all forms of a specific category (e.g., all sugar forms)
    Returns dict with detected items, types (natural/artificial), harm levels, and confidence scores
    """
    detected = []
    unknown_ingredients = []
    
    for ingredient in ingredients_list:
        is_match, confidence, ing_type, harm_level = detect_ingredient_category(ingredient, category)
        if is_match:
            detected.append({
                "name": ingredient,
                "confidence": confidence,
                "category": category,
                "type": ing_type,  # natural, artificial, processed
                "harm_level": harm_level  # VERY_LOW, LOW, MEDIUM, HIGH, VERY_HIGH
            })
        else:
            # Track unknown ingredients for learning
            unknown_ingredients.append(ingredient)
    
    # Try to classify unknown ingredients if high confidence needed
    if unknown_ingredients and category in ["sugar", "sweetener"]:
        for unknown in unknown_ingredients:
            classification = classify_unknown_ingredient(unknown)
            if classification["confidence"] > 0.6:
                # Check if it matches our category
                if category in classification["category"] or "sweetener" in classification["category"]:
                    detected.append({
                        "name": unknown,
                        "confidence": classification["confidence"],
                        "category": classification["category"],
                        "type": classification["type"],
                        "harm_level": classification.get("harm_level", "UNKNOWN")
                    })
    
    # Separate by type
    natural = [d for d in detected if d.get("type") == "natural"]
    artificial = [d for d in detected if d.get("type") == "artificial"]
    processed = [d for d in detected if d.get("type") == "processed"]
    unknown = [d for d in detected if d.get("type") == "unknown"]
    
    return {
        "category": category,
        "detected_count": len(detected),
        "detected_items": detected,
        "has_any": len(detected) > 0,
        "breakdown": {
            "natural": natural,
            "artificial": artificial,
            "processed": processed,
            "unknown": unknown
        },
        "unknown_ingredients": unknown_ingredients
    }


def validate_claim(claim_type: str, ingredients_list: List[str], nutrients: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate a specific "free" claim against ingredients and nutrients
    Returns validation result with penalty if false
    """
    # Map claims to categories (can be multiple categories)
    claim_categories_map = {
        "sugar_free": ["natural_sugar", "refined_sugar", "natural_sweetener", "artificial_sweetener", "sugar_alcohol"],
        "fat_free": ["fat"],
        "gluten_free": ["gluten"],
        "dairy_free": ["dairy"],
        "preservative_free": ["natural_preservative", "moderate_preservative", "harmful_preservative", "very_harmful_preservative"],
        "artificial_free": ["artificial_sweetener", "artificial_flavor", "harmful_color", "harmful_preservative", "very_harmful_preservative"],
        "gmo_free": ["gmo"],
        "sodium_free": ["sodium"],
        "cholesterol_free": []  # Check nutrients only
    }
    
    if claim_type not in claim_categories_map:
        return {"valid": True, "reason": "Unknown claim type"}
    
    categories_to_check = claim_categories_map[claim_type]
    
    # Check all relevant categories
    all_detected = []
    all_breakdowns = {"natural": [], "artificial": [], "processed": [], "unknown": []}
    
    for category in categories_to_check:
        category_key = f"{category}_aliases"
        if category_key not in INGREDIENT_DB:
            continue
        
        detection_result = detect_all_forms(ingredients_list, category)
        if detection_result["has_any"]:
            all_detected.extend(detection_result["detected_items"])
            # Merge breakdowns
            for breakdown_type, items in detection_result.get("breakdown", {}).items():
                all_breakdowns[breakdown_type].extend(items)
    
    # Check nutrients for violations
    nutrient_violation = False
    nutrient_value = 0
    
    # Check any of the categories for nutrient data
    for category in categories_to_check:
        category_key = f"{category}_aliases"
        if category_key not in INGREDIENT_DB:
            continue
        category_data = INGREDIENT_DB[category_key]
        
        if "nutrient_keys" in category_data:
            threshold = category_data.get("threshold_free", 0.5)
            for key in category_data["nutrient_keys"]:
                value = nutrients.get(key, 0)
                if isinstance(value, (int, float)) and value > threshold:
                    nutrient_violation = True
                    nutrient_value = value
                    break
        if nutrient_violation:
            break
    
    # Determine if claim is false
    is_false = len(all_detected) > 0 or nutrient_violation
    
    # Enhanced penalty based on type (artificial sweeteners worse than natural)
    penalty = 0
    violation_details = []
    base_penalty = 15  # Default
    
    if is_false:
        # Add extra penalty for artificial ingredients in "natural" claims
        if claim_type == "artificial_free":
            artificial_count = len(all_breakdowns.get("artificial", []))
            penalty = base_penalty + (artificial_count * 5)
            violation_details = [f"Contains {artificial_count} artificial ingredient(s)"]
        
        # Sugar-free claims worse if refined sugar vs natural
        elif claim_type == "sugar_free":
            refined = all_breakdowns.get("processed", [])
            artificial_sw = all_breakdowns.get("artificial", [])
            
            if artificial_sw:
                penalty = base_penalty + 5  # Worse penalty for artificial sweeteners
                violation_details = [f"Contains artificial sweeteners: {', '.join([i['name'] for i in artificial_sw])}"]
            elif refined:
                penalty = base_penalty
                violation_details = [f"Contains refined sugars: {', '.join([i['name'] for i in refined[:3]])}"]
            else:
                penalty = base_penalty - 5  # Less penalty for natural sweeteners
                natural = all_breakdowns.get("natural", [])
                violation_details = [f"Contains natural sweeteners: {', '.join([i['name'] for i in natural[:3]])}"]
        else:
            penalty = base_penalty
            violation_details = [f"Contains {len(all_detected)} ingredient(s)"]
    
    return {
        "claim_type": claim_type,
        "valid": not is_false,
        "ingredient_violations": all_detected,
        "ingredient_breakdown": all_breakdowns,
        "nutrient_violation": nutrient_violation,
        "nutrient_value": nutrient_value,
        "penalty": penalty,
        "violation_details": violation_details,
        "severity": "HIGH" if penalty >= 20 else "MEDIUM" if penalty >= 10 else "LOW"
    }


def detect_product_claims(product_name: str, description: str = "") -> List[str]:
    """
    Detect claims made in product name/description
    Returns list of claim types detected
    """
    text = f"{product_name} {description}".lower()
    detected_claims = []
    
    if "claim_keywords" in INGREDIENT_DB:
        for claim_type, keywords in INGREDIENT_DB["claim_keywords"].items():
            for keyword in keywords:
                if keyword in text:
                    detected_claims.append(claim_type)
                    break
    
    return list(set(detected_claims))  # Remove duplicates


def analyze_ingredient_synergies(nutrients: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Detect harmful nutrient combinations
    Returns list of detected synergies with penalties
    """
    synergies = []
    
    # Sugar + Fat combination
    sugar = nutrients.get("sugars_100g", 0) or nutrients.get("sugars", 0)
    fat = nutrients.get("fat_100g", 0) or nutrients.get("fat", 0)
    if sugar > 15 and fat > 10:
        synergies.append({
            "type": "sugar_fat_combo",
            "warning": "High sugar + high fat combination increases metabolic risk",
            "penalty": 3,
            "values": {"sugar": sugar, "fat": fat}
        })
    
    # Trans fat + Cholesterol
    trans_fat = nutrients.get("trans-fat_100g", 0) or nutrients.get("trans_fat", 0)
    cholesterol = nutrients.get("cholesterol_100g", 0) or nutrients.get("cholesterol", 0)
    if trans_fat > 0.5 and cholesterol > 20:
        synergies.append({
            "type": "trans_fat_cholesterol",
            "warning": "Trans fat + cholesterol significantly increases cardiovascular risk",
            "penalty": 5,
            "values": {"trans_fat": trans_fat, "cholesterol": cholesterol}
        })
    
    # Saturated fat + Cholesterol
    sat_fat = nutrients.get("saturated-fat_100g", 0) or nutrients.get("saturated_fat", 0)
    if sat_fat > 5 and cholesterol > 25:
        synergies.append({
            "type": "sat_fat_cholesterol",
            "warning": "High saturated fat + cholesterol combination increases heart disease risk",
            "penalty": 3,
            "values": {"saturated_fat": sat_fat, "cholesterol": cholesterol}
        })
    
    # Sodium + Sugar
    sodium = nutrients.get("sodium_100g", 0) or nutrients.get("salt_100g", 0) * 0.4
    if sodium > 1.0 and sugar > 12:
        synergies.append({
            "type": "sodium_sugar",
            "warning": "High sodium + sugar combination stresses metabolic system",
            "penalty": 2,
            "values": {"sodium": sodium, "sugar": sugar}
        })
    
    return synergies

def ml_analyze_product(product):
    """
    Main ML analysis function with expanded categories
    """
    # Extract data first
    product_name = product.get("product_name", "") or product.get("name", "")
    ingredients_text = product.get("ingredients_text", "") or product.get("ingredients", "")
    nutrients = product.get("nutriments", {}) or product.get("nutrition", {})
    description = product.get("description", "")
    
    # Extract clean ingredients
    ingredients_list = extract_ingredients(ingredients_text)
    ingredients_analyzed = ingredients_list  # Store for later use
    
    # Initialize tracking
    ingredient_categories = {}
    all_unknown = []
    harm_summary = {"VERY_LOW": 0, "LOW": 0, "MEDIUM": 0, "HIGH": 0, "VERY_HIGH": 0}
    
    categories_to_check = [
        # Sweeteners
        "natural_sugar", "refined_sugar", "natural_sweetener", "artificial_sweetener", "sugar_alcohol",
        # Preservatives by harm level
        "natural_preservative", "moderate_preservative", "harmful_preservative", "very_harmful_preservative",
        # Colors by harm level
        "natural_color", "moderate_color", "harmful_color",
        # Flavors
        "natural_flavor", "artificial_flavor", "flavor_enhancer",
        # Textures
        "emulsifier_stabilizer",
        # Others
        "fat", "gluten", "dairy", "sodium", "gmo"
    ]
    
    for category in categories_to_check:
        result = detect_all_forms(ingredients_list, category)
        if result["has_any"]:
            ingredient_categories[category] = result
            
            # Track harm levels
            for item in result.get("detected_items", []):
                harm = item.get("harm_level", "UNKNOWN")
                if harm in harm_summary:
                    harm_summary[harm] += 1
        
        # Collect unknown ingredients
        all_unknown.extend(result.get("unknown_ingredients", []))
    
    # Remove duplicates from unknown list
    all_unknown = list(set(all_unknown))
    
    # Calculate harm score
    harm_score = (
        harm_summary.get("VERY_HIGH", 0) * 15 +
        harm_summary.get("HIGH", 0) * 10 +
        harm_summary.get("MEDIUM", 0) * 5 +
        harm_summary.get("LOW", 0) * 1
    )
    
    # Detect claims in product name/description
    detected_claims = detect_product_claims(product_name, description)
    
    # Validate all detected claims
    claim_validations = []
    total_claim_penalty = 0
    false_claims = []
    
    for claim in detected_claims:
        validation = validate_claim(claim, ingredients_list, nutrients)
        claim_validations.append(validation)
        if not validation["valid"]:
            false_claims.append(claim)
            total_claim_penalty += validation["penalty"]
    
    # Detect ingredient synergies
    synergies = analyze_ingredient_synergies(nutrients)
    synergy_penalty = sum(s["penalty"] for s in synergies)
    
    # Return comprehensive analysis
    return {
        "ingredient_categories": ingredient_categories,
        "ingredient_count": len(ingredients_list),
        "ingredients_analyzed": ingredients_analyzed,  # Add ingredients list
        "claim_validations": claim_validations,
        "false_claims": false_claims,  # List of false claim types
        "false_claim_penalty": total_claim_penalty,
        "synergies": synergies,
        "synergies_detected": synergies,  # Alias for compatibility
        "synergy_penalty": synergy_penalty,
        "harm_summary": harm_summary,
        "harm_score": harm_score,
        "total_ml_penalty": total_claim_penalty + synergy_penalty + harm_score,
        "ml_warnings": [s["warning"] for s in synergies] + 
                      [f"FALSE CLAIM: {c.replace('_', ' ').title()}" for c in false_claims] +
                      generate_harm_warnings(harm_summary),
        "unknown_ingredients": all_unknown,
        "learned_count": len(UNKNOWN_CACHE.get("learned_ingredients", {}))
    }


def generate_harm_warnings(harm_summary: Dict[str, int]) -> List[str]:
    """Generate warnings based on harm levels detected"""
    warnings = []
    
    if harm_summary.get("VERY_HIGH", 0) > 0:
        count = harm_summary["VERY_HIGH"]
        warnings.append(f"⚠️ ALERT: Contains {count} VERY HIGH risk ingredient(s) - Avoid frequent consumption")
    
    if harm_summary.get("HIGH", 0) > 0:
        count = harm_summary["HIGH"]
        warnings.append(f"⚠️ Contains {count} HIGH risk ingredient(s) - Limit consumption")
    
    if harm_summary.get("MEDIUM", 0) >= 3:
        count = harm_summary["MEDIUM"]
        warnings.append(f"⚠️ Contains {count} MEDIUM risk ingredients - Consume occasionally")
    
    return warnings


# For testing
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    # Test case: Sugar-free product with sucrose
    test_product = {
        "product_name": "Sugar-Free Energy Drink",
        "ingredients_text": "water, sucrose, dextrose, citric acid, natural flavors",
        "nutriments": {
            "sugars_100g": 0.1,
            "energy_100g": 150
        }
    }
    
    result = ml_analyze_product(test_product)
    print(json.dumps(result, indent=2))
