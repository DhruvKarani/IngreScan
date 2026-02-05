import requests
import json
import time
import re
import urllib.parse as _urllib_parse
import logging
# Set up logging to avoid errors if not configured externally
logging.basicConfig(level=logging.INFO)

# --- START: Custom Scoring Engine Data & Rules ---

# Load health rules from JSON
try:
    import os
    health_rules_path = os.path.join(
        os.path.dirname(__file__), "health_rules.json")
    with open(health_rules_path, "r", encoding="utf-8") as f:
        HEALTH_RULES = json.load(f)
    print(f"Successfully loaded health rules from {health_rules_path}")
except FileNotFoundError:
    print(f"Error: health_rules.json not found at expected path.")
    HEALTH_RULES = {}
except json.JSONDecodeError as e:
    print(f"Error parsing health_rules.json: {e}")
    print("Attempting to strip comments and retry...")
    try:
        with open(health_rules_path, "r", encoding="utf-8") as f:
            content = f.read()
            # Remove line comments and multiline comments
            content = re.sub(r'//.*', '', content)
            content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
            HEALTH_RULES = json.loads(content)
            print("Successfully loaded health rules after stripping comments")
    except Exception as e2:
        print(
            f"Failed to parse health_rules.json even after stripping comments: {e2}")
        HEALTH_RULES = {}

# Default allergens/preservatives list
ALLERGENS = ["milk", "peanut", "soy", "gluten", "almond", "cashew", "walnut"]
PRESERVATIVES = ["preservative", "stabilizer",
                 "color", "flavor", "emulsifier", "additive"]

# User profile (set once at start)
USER_PROFILE = {"allergies": [], "conditions": []}

# Placeholder functions needed by the robust fetch but defined in external modules
# We define minimal, non-functional placeholders here to allow the robust logic to run.


def tag_ingredient_safety(
    ing_name): return "Unknown", "No external safety data"
def normalize_ingredient_name(
    ing_name): return ing_name, "No external description"


def suggest_alternatives(name): return []
# Always max score, as the real logic is in this file
def calculate_health_score(ingredients, allergens, nutrients): return 10

# --- END: Custom Scoring Engine Data & Rules ---


# --- START: Robust OFF Fetch Logic (from main.py, adapted to return raw data) ---

# NOTE: This function is adapted to return the raw OFF product dictionary and
# ingredient text, which the scoring engine needs, instead of complex pydantic models.
def robust_fetch_from_openfoodfacts(barcode: str):
    """
    Robustly fetches product data from Open Food Facts using v2/search fallbacks.
    Returns: (product_dict, ingredients_text, nutrients_dict) or (None, None, None)
    """

    # Simple placeholder class for data structuring, replaces Pydantic model usage for minimal setup
    class Ingredient:
        def __init__(self, name):
            self.name = name

    # Try v2 product endpoint first
    try:
        headers = {"User-Agent": "Mozilla/5.0 (+ingredient-analyzer)"}
        fields = (
            # Added last_modified_t for reliability check
            "product_name,product_name_en,generic_name,generic_name_en,last_modified_t,"
            "ingredients_text,ingredients_text_en,ingredients,nutriments,allergens_tags,brands,categories,categories_en,additives_tags"
        )
        v2p = requests.get(
            f"https://world.openfoodfacts.org/api/v2/product/{barcode}",
            params={"lc": "en", "cc": "in", "fields": fields},
            headers=headers,
            timeout=5,
        )
        if v2p.status_code == 200:
            vd = v2p.json() or {}
            vp = vd.get("product")
            if vp:
                # Use v2 product data directly
                ingredients_text = vp.get("ingredients_text_en") or vp.get(
                    "ingredients_text") or ""
                nutrients = {k: str(v) for k, v in (
                    vp.get("nutriments") or {}).items()}
                return vp, ingredients_text.lower(), nutrients
    except Exception as e:
        logging.info(f"V2 product endpoint failed: {e}")
        pass

    # Fallback logic (using v0/search endpoints)
    hosts = ["https://world.openfoodfacts.org", "https://in.openfoodfacts.org"]
    data = None

    # Try V0/search endpoints
    for host in hosts:
        try:
            resp = requests.get(
                f"{host}/api/v0/product/{barcode}.json", timeout=5)
            if resp.status_code == 200:
                d = resp.json() or {}
                if d.get("status") == 1:
                    data = d
                    break
        except Exception:
            continue

    if data:
        product = data["product"]
        ingredients_text = product.get(
            "ingredients_text_en") or product.get("ingredients_text") or ""
        nutrients = {k: str(v)
                     for k, v in product.get("nutriments", {}).items()}
        return product, ingredients_text.lower(), nutrients

    # If not found after fallbacks
    logging.warning(f"Product {barcode} not found on any OFF endpoint.")
    return None, None, None

# --- END: Robust OFF Fetch Logic ---


# --- START: Scoring Logic (Original functions from ingrescan_with_sanity_and_confidence(main).py) ---

def score_nutrients(nutrients):
    """Calculates baseline score, handles missing keys gracefully."""
    # Ensure nutrients are float/int for comparison
    def safe_get(key):
        try:
            return float(nutrients.get(key, 0))
        except (ValueError, TypeError):
            return 0.0

    sugar = safe_get("sugars_100g")
    fat = safe_get("fat_100g")
    salt = safe_get("salt_100g")

    score = 10
    warnings = []

    if sugar > 10:
        score -= 3
        warnings.append("High sugar content")
    if fat > 15:
        score -= 2
        warnings.append("High fat content")
    if salt > 1.5:
        score -= 2
        warnings.append("High salt content")

    return max(score, 1), warnings


def assign_tier(score):
    if score >= 8:
        return "Daily"
    elif score >= 5:
        return "Moderate"
    else:
        return "Occasional"


def check_warnings(ingredients_lower):
    warnings = []
    # Allergen check (specific to this function in the original file, uses global USER_PROFILE)
    for allergen in USER_PROFILE["allergies"]:
        if allergen in ingredients_lower:
            warnings.append(f"[HIGH] Contains allergen: {allergen}")

    # Preservative check
    for additive in PRESERVATIVES:
        if additive in ingredients_lower:
            warnings.append(
                f"[MEDIUM] Contains additive/preservative: {additive}")

    return warnings


def apply_health_rules(nutrients, ingredients_lower):
    """Applies condition-specific penalties, handles missing keys gracefully."""
    warnings = []
    score_penalty = 0

    for condition in USER_PROFILE["conditions"]:
        condition = condition.strip().lower()
        if condition in HEALTH_RULES:
            rules = HEALTH_RULES[condition]

            # Nutrient-based penalties
            for nutrient, limits in rules.get("nutrients", {}).items():
                # Safe key retrieval and conversion to float
                try:
                    nutrient_val = float(nutrients.get(nutrient, 0))
                except (ValueError, TypeError):
                    nutrient_val = 0.0

                if nutrient_val > limits["max"]:
                    score_penalty -= limits["penalty"]
                    warnings.extend(rules.get("warnings", []))

            # Ingredient-based penalties
            for bad in rules.get("ingredients", []):
                if bad in ingredients_lower:
                    penalty_points = rules.get("penalty_points", 3)
                    score_penalty -= penalty_points
                    warnings.extend(rules.get("warnings", []))

    return score_penalty, list(set(warnings))


def apply_synergy_rules(nutrients):
    """Applies synergy penalties, handles missing keys gracefully."""
    synergy_penalty = 0
    synergy_warnings = []

    def safe_get(key):
        try:
            return float(nutrients.get(key, 0))
        except (ValueError, TypeError):
            return 0.0

    for rule in HEALTH_RULES.get("synergy_rules", []):
        n1, n2 = rule["nutrient1"], rule["nutrient2"]
        th1, th2 = rule["thresholds"]

        n1_val = safe_get(n1)
        n2_val = safe_get(n2)

        if n1_val > th1 and n2_val > th2:
            synergy_penalty -= rule["penalty"]
            synergy_warnings.append(f"[HIGH] {rule['warning']}")

    return synergy_penalty, synergy_warnings


def _try_parse_float(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def simplify_nutrients(nutrients):
    """Return a simplified nutrients dict with one numeric value per nutrient (per 100g).

    Heuristics used:
    - Prefer the '<nutrient>_100g' key when available.
    - If unit keys indicate 'mg' and the numeric value looks like milligrams, convert to grams.
    - Skip per-serving or ambiguous keys that cannot be reliably converted to per-100g.
    - Returns keys as '<nutrient>_100g' with numeric values (floats).
    """
    if not nutrients:
        return {}

    canonical = [
        "sugars",
        "fat",
        "saturated-fat",
        "salt",
        "sodium",
        "proteins",
        "carbohydrates",
        "fiber",
        "energy-kcal",
        "alcohol",
    ]

    out = {}
    for name in canonical:
        # Prefer exact '<name>_100g'
        preferred_key = f"{name}_100g"
        value = None
        unit = None

        if preferred_key in nutrients:
            value = _try_parse_float(nutrients.get(preferred_key))
            # try to find a unit key for that specific variant, else fall back to generic
            unit = nutrients.get(
                f"{preferred_key}_unit") or nutrients.get(f"{name}_unit")

        # If not present, look for any key that ends with '_100g' and contains the nutrient name
        if value is None:
            for k in nutrients.keys():
                if k.endswith("_100g") and name in k:
                    value = _try_parse_float(nutrients.get(k))
                    unit = nutrients.get(
                        f"{k}_unit") or nutrients.get(f"{name}_unit")
                    if value is not None:
                        break

        # As a last fallback, accept a plain key only if it doesn't look like a per-serving/value key
        if value is None:
            plain = nutrients.get(name)
            if plain is not None:
                # avoid keys that are clearly per-serving/values (they usually have separate keys),
                # but if there is no other choice, try to parse the plain key
                parsed = _try_parse_float(plain)
                if parsed is not None:
                    value = parsed
                    unit = nutrients.get(f"{name}_unit")

        if value is None:
            continue

        # Normalize units: if unit mentions 'mg' and value looks large (>1), convert mg->g
        if unit and isinstance(unit, str) and 'mg' in unit.lower():
            # If value seems to be in milligrams (greater than 1), convert to grams
            if value > 1:
                value = value / 1000.0

        # Round to a reasonable precision
        try:
            out[f"{name}_100g"] = float(round(value, 6))
        except Exception:
            out[f"{name}_100g"] = value

    return out


def check_data_reliability(product):
    warnings = []
    confidence = "HIGH"

    # Check if this is manually entered data
    if product.get("manual_input", False):
        warnings.append(
            "[CHECK] This is manually entered data, accuracy depends on user input.")
        confidence = "MEDIUM"
        return confidence, warnings

    last_mod = product.get("last_modified_t")
    if last_mod:
        try:
            # Assuming last_modified_t is a Unix timestamp (seconds)
            years_old = (time.time() - float(last_mod)) / (60 * 60 * 24 * 365)
            if years_old > 5:
                warnings.append(
                    f"[CHECK] Data may be outdated (last updated {int(years_old)} years ago)")
                confidence = "MEDIUM"
        except (TypeError, ValueError):
            warnings.append(
                f"[CHECK] Cannot parse product modification timestamp.")
            confidence = "MEDIUM"
    else:
        warnings.append("[CHECK] No modification timestamp available.")
        confidence = "MEDIUM"

    # Check if the product dict itself is empty (i.e., data was manual)
    if not product:
        warnings.append(
            "[CHECK] No OFF data available, using manual/sparse input.")
        confidence = "LOW"

    # Check nutrient data availability
    nutrient_count = sum(1 for k in product.get(
        "nutriments", {}) if k.endswith("_100g"))
    if nutrient_count < 3:
        warnings.append("[CHECK] Limited nutrition data available.")
        confidence = min(confidence, "MEDIUM")

    # Check ingredients data availability
    if not product.get("ingredients_text") and not product.get("ingredients"):
        warnings.append("[CHECK] Missing ingredients information.")
        confidence = min(confidence, "MEDIUM")

    return confidence, warnings


def analyze_product_engine(product, ingredients_lower, nutrients):
    """
    Runs the custom scoring logic on the fetched/parsed data.
    """

    # Fallback name for output
    name = product.get("product_name") or product.get(
        "product_name_en") or "Unknown Product"

    # Reliability check
    confidence, extra_warnings = check_data_reliability(product)

    # Baseline score (use raw nutrients for scoring to preserve original logic)
    base_score, nutrient_warnings = score_nutrients(nutrients)

    # Apply health penalties
    penalty, health_warnings = apply_health_rules(nutrients, ingredients_lower)

    # Apply allergy penalties
    allergy_penalty = 0
    allergy_warnings = []
    for allergen in USER_PROFILE["allergies"]:
        if allergen in ingredients_lower:
            allergy_penalty -= 5
            allergy_warnings.append(f"[HIGH] Contains allergen: {allergen}")

    # Apply synergy penalties
    synergy_penalty, synergy_warnings = apply_synergy_rules(nutrients)

    # Combine all penalties and warnings
    total_penalty = penalty + allergy_penalty + synergy_penalty
    final_score = max(base_score + total_penalty, 0)

    # Use final score for tier, but original baseline score for reasoning text coherence
    final_tier = assign_tier(final_score)

    # Consolidate Reasoning/Warnings
    # 1. Base warnings (allergy check, preservatives)
    base_warnings = check_warnings(ingredients_lower)
    # 2. Score breakdown (simple text based on baseline score)
    score_reasons = []
    if base_score > 8:
        score_reasons.append(
            "Low overall risk based on baseline nutrient score.")
    elif base_score < 5:
        score_reasons.append(
            "High overall nutrient risk based on baseline score.")
    else:
        score_reasons.append(
            "Moderate overall nutrient risk based on baseline score.")

    all_warnings = list(set(
        base_warnings + health_warnings + allergy_warnings +
        synergy_warnings + extra_warnings + score_reasons + nutrient_warnings
    ))

    # Simplify nutrients for output (one value per nutrient, per 100g)
    simplified = simplify_nutrients(nutrients)

    return {
        "product_name": name,
        "nutrients": simplified,
        "raw_nutrients": nutrients,
        "score": float(f"{final_score:.1f}"),  # Format to one decimal place
        "tier": final_tier,
        "confidence": confidence,
        "reasoning": all_warnings
    }

# --- END: Scoring Logic ---


def get_manual_input():
    """Get manual product information when a barcode lookup fails."""
    print("\n📝 Product not found in database. Please enter details manually:")

    product_name = input("Product Name: ").strip()
    ingredients = input("Ingredients (comma separated): ").strip().lower()

    # Create a minimal product structure
    product_data = {
        "product_name": product_name,
        "last_modified_t": str(int(time.time())),  # Current time as timestamp
        "ingredients_text": ingredients,
        "manual_input": True  # Flag to indicate this is manual input
    }

    # Get basic nutritional info
    nutrients = {}
    print("\nPlease enter nutritional information per 100g/100ml (press Enter to skip any):")

    try:
        sugar = input("Sugar (g): ").strip()
        if sugar:
            nutrients["sugars_100g"] = float(sugar)
            # Add variant keys used in different API responses
            nutrients["sugars"] = sugar

        fat = input("Fat (g): ").strip()
        if fat:
            nutrients["fat_100g"] = float(fat)
            nutrients["fat"] = fat

        saturated_fat = input("Saturated Fat (g): ").strip()
        if saturated_fat:
            nutrients["saturated-fat_100g"] = float(saturated_fat)
            nutrients["saturated-fat"] = saturated_fat

        salt = input("Salt (g): ").strip()
        if salt:
            nutrients["salt_100g"] = float(salt)
            nutrients["salt"] = salt

        protein = input("Protein (g): ").strip()
        if protein:
            nutrients["proteins_100g"] = float(protein)
            nutrients["proteins"] = protein

        carbs = input("Carbohydrates (g): ").strip()
        if carbs:
            nutrients["carbohydrates_100g"] = float(carbs)
            nutrients["carbohydrates"] = carbs
    except ValueError:
        print("Warning: Some nutritional values were invalid and will be ignored.")

    return product_data, ingredients, nutrients


def extract_ingredients_and_additives(product, ingredients_text):
    """Return (ingredients_list, additives_list) extracted from structured product fields
    and free-form ingredients text. Tries multiple OFF fields and falls back to simple text parsing.
    """
    ingredients = []
    additives = []

    try:
        # Structured ingredients (list of dicts or strings)
        struct = product.get("ingredients") if product else None
        if isinstance(struct, list) and struct:
            for ing in struct:
                if isinstance(ing, dict):
                    text = ing.get("text") or ing.get("name") or ing.get("id")
                    if text:
                        ingredients.append(text.strip())
                elif isinstance(ing, str):
                    ingredients.append(ing.strip())

        # If no structured ingredients, try the ingredients_text
        if not ingredients and ingredients_text:
            parts = re.split(r"[;,/]|\\(|\\)", ingredients_text)
            for p in parts:
                p = p.strip()
                if p:
                    ingredients.append(p)

        # Additives from structured tags or lists
        if product:
            # additives_tags commonly contains values like 'en:e330' or 'en:citric-acid'
            atags = product.get("additives_tags")
            if isinstance(atags, list) and atags:
                for tag in atags:
                    if isinstance(tag, str):
                        name = tag.split(":", 1)[-1] if ":" in tag else tag
                        name = name.replace("-", " ").strip()
                        additives.append(name)
            else:
                # product.get('additives') can be a list of dicts
                a_field = product.get("additives")
                if isinstance(a_field, list) and a_field:
                    for a in a_field:
                        if isinstance(a, dict):
                            name = a.get("id") or a.get(
                                "name") or a.get("text")
                            if name:
                                additives.append(name.strip())
                        elif isinstance(a, str):
                            additives.append(a.strip())

        # Fallback: detect E-numbers and common preservative keywords in ingredients_text
        if ingredients_text:
            # find matches like E330 or E 330
            matches = re.findall(r"\b[eE][\s-]?\d{2,3}\b", ingredients_text)
            for m in matches:
                candidate = m.replace(" ", "").replace("-", "")
                if candidate and candidate not in additives:
                    additives.append(candidate)

            # Check for preservative keywords list
            for pres in PRESERVATIVES:
                if pres in ingredients_text.lower() and pres not in additives:
                    additives.append(pres)

    except Exception:
        # Best-effort: fall back to parsing ingredients_text only
        if ingredients_text:
            ingredients = [i.strip() for i in re.split(
                r"[;,/]|\\(|\\)", ingredients_text) if i.strip()]

    # Normalize and dedupe while preserving order
    def _uniq(seq):
        seen = set()
        out = []
        for s in seq:
            if not s:
                continue
            key = s.strip()
            if key.lower() not in seen:
                seen.add(key.lower())
                out.append(key)
        return out

    return _uniq(ingredients), _uniq(additives)


if __name__ == "__main__":
    # --- Step 1: Set user profile (as originally required) ---
    print("Setup your health profile:")

    conditions_input = input(
        "Enter conditions (comma separated, e.g. diabetes, high_bp, pregnant, high_cholesterol): ").lower()
    USER_PROFILE["conditions"] = [c.strip()
                                  for c in conditions_input.split(",") if c.strip()]

    allergies_input = input(
        "Enter allergies (comma separated, e.g. milk, gluten): ").lower()
    USER_PROFILE["allergies"] = [a.strip()
                                 for a in allergies_input.split(",") if a.strip()]

    # --- Step 2: Analyze product using the robust fetch ---
    barcode = input("\nEnter product barcode: ").strip()

    # Fetch data
    product_data, ingredients_text_lower, nutrients = robust_fetch_from_openfoodfacts(
        barcode)

    # If product not found, get manual input
    if not product_data or not nutrients or not product_data.get("product_name") or product_data.get("product_name") == "Unknown Product":
        print(
            f"\n❌ Product with barcode {barcode} could not be found via Open Food Facts API.")
        product_data, ingredients_text_lower, nutrients = get_manual_input()

    # Process the product data (whether from API or manual input)
    # Pass raw data to the analysis engine
    result = analyze_product_engine(
        product_data, ingredients_text_lower, nutrients)

    # Extract ingredients and additives reliably
    try:
        ingredients_list, additives_list = extract_ingredients_and_additives(
            product_data, ingredients_text_lower or "")
        if ingredients_list:
            result["ingredients"] = ingredients_list
        else:
            result["ingredients"] = ["No ingredients data available"]

        # Include additives in result
        result["additives"] = additives_list if additives_list else []
    except Exception:
        # Defensive fallback
        if ingredients_text_lower:
            result["ingredients"] = [i.strip()
                                     for i in ingredients_text_lower.split(',') if i.strip()]
        else:
            result["ingredients"] = ["No ingredients data available"]
        result["additives"] = []

    # --- Output in the requested format ---
    final_output = {
        "product_name": result["product_name"],
        "ingredients": result["ingredients"],
        "additives": result.get("additives", []),
        "nutrients": result["nutrients"],
        "score": result["score"],
        "reasoning": result["reasoning"]
    }

    print("\n--- Custom Health Analysis Results ---")
    print(json.dumps(final_output, indent=2, ensure_ascii=False))
    print(
        f"\nConsumption Tier: {result['tier']} | Confidence: {result['confidence']}")

    # If ingredients were not found, optionally ask the user to provide a photo path
    # This is non-blocking to scoring: scoring has already run and been printed above.
    try:
        missing_ingredients = (
            isinstance(result.get("ingredients"), list)
            and len(result.get("ingredients") or []) == 1
            and (result.get("ingredients")[0] or "").lower().startswith("no ingredients")
        )
    except Exception:
        missing_ingredients = False

    if missing_ingredients:
        try:
            photo_path = input(
                "\nIngredients not found. Optionally provide a path to a photo of the ingredients (press Enter to skip): "
            ).strip()
            if photo_path:
                # store the provided path for later review/processing, but do not re-run scoring
                final_output["ingredients_photo"] = photo_path
                if os.path.exists(photo_path):
                    print("Thanks — saved ingredients photo path in the result.")
                else:
                    print(
                        "Path provided does not currently exist; saved it anyway for later review.")

                # Print an updated summary (non-intrusive)
                print("\n--- Updated Result (ingredients photo added) ---")
                print(json.dumps(final_output, indent=2, ensure_ascii=False))
            else:
                print("No photo provided; continuing.")
        except Exception as e:
            # Do not block or crash the scoring flow if anything goes wrong here
            print(f"Could not record ingredients photo: {e}")
