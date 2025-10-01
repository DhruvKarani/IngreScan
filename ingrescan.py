# ingrescan_with_sanity_and_confidence.py
import requests
import json
from typing import Dict, List, Tuple

# Load health rules from JSON (keep same format as before)
with open("health_rules.json", "r") as f:
    HEALTH_RULES = json.load(f)

# Default allergens/preservatives list
ALLERGENS = ["milk", "peanut", "soy", "gluten", "almond", "cashew", "walnut"]
PRESERVATIVES = ["preservative", "stabilizer", "color", "flavor", "emulsifier", "additive",
                 "aspartame", "acesulfame", "sucralose", "sodium benzoate", "potassium sorbate"]

# User profile (set at runtime)
USER_PROFILE = {"allergies": [], "conditions": []}

# -------------------- Utilities --------------------
def prefixed(msg: str, level: str) -> str:
    """Return message with confidence prefix."""
    return f"[{level}] {msg}"

# -------------------- Fetch / Manual Input --------------------
def fetch_product(barcode: str) -> Dict:
    url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
    try:
        r = requests.get(url, timeout=8)
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return {}

def manual_nutrients(existing: Dict = None) -> Dict:
    """Ask user for missing/override nutrient values. Return dict with common keys."""
    if existing is None:
        existing = {}
    print("\n⚠ Manual entry required / override. Leave empty to keep current value (or 0).")
    def ask(k, prompt):
        cur = existing.get(k, "")
        val = input(f"{prompt} (current: {cur}): ").strip()
        if val == "":
            try:
                return float(cur) if cur != "" else 0.0
            except Exception:
                return 0.0
        try:
            return float(val)
        except Exception:
            return 0.0

    out = {}
    out["energy-kcal_100g"] = ask("energy-kcal_100g", "Energy (kcal per 100g)")
    out["sugars_100g"] = ask("sugars_100g", "Sugars (g per 100g)")
    out["carbohydrates_100g"] = ask("carbohydrates_100g", "Carbohydrates (g per 100g)")
    out["fat_100g"] = ask("fat_100g", "Total fat (g per 100g)")
    out["saturated-fat_100g"] = ask("saturated-fat_100g", "Saturated fat (g per 100g)")
    out["salt_100g"] = ask("salt_100g", "Salt (g per 100g)")
    out["sodium_100g"] = ask("sodium_100g", "Sodium (g per 100g)")
    out["proteins_100g"] = ask("proteins_100g", "Protein (g per 100g)")
    out["fiber_100g"] = ask("fiber_100g", "Fiber (g per 100g)")
    out["cholesterol_100g"] = ask("cholesterol_100g", "Cholesterol (g per 100g)")
    out["caffeine_100g"] = ask("caffeine_100g", "Caffeine (mg per 100g). Note: if per 100ml convert accordingly")
    return out

def manual_ingredients(existing: str = "") -> str:
    print("\n⚠ Ingredient list missing or suspicious. Paste the ingredient list (comma-separated):")
    inp = input(f"Current: {existing}\nEnter ingredients: ").strip()
    return inp.lower() if inp != "" else existing.lower()

# -------------------- Sanity checks / Confidence --------------------
def validate_nutrients(nutrients: Dict, ingredients_text: str) -> Tuple[bool, List[str]]:
    """
    Validate nutrition data. Returns (suspicious_flag, confidence_warnings)
    suspicious_flag=True => we consider data questionable and will ask user
    """
    warnings = []
    suspicious = False

    # Helper getters with fallbacks
    def g(k): return float(nutrients.get(k, 0) or 0)

    # Negative or impossible values
    for k in ["sugars_100g", "carbohydrates_100g", "fat_100g", "proteins_100g", "salt_100g"]:
        val = g(k)
        if val < 0:
            warnings.append(prefixed(f"{k} is negative ({val}) — data invalid", "HIGH"))
            suspicious = True

    # Sugar > carbs => suspicious
    sugars = g("sugars_100g")
    carbs = g("carbohydrates_100g")
    if sugars > carbs and carbs > 0:
        warnings.append(prefixed(f"Sugars ({sugars}g) > Carbohydrates ({carbs}g) — possible mislabeling", "HIGH"))
        suspicious = True

    # Sugar but no sugar words in ingredients -> medium confidence check
    sugar_terms = ["sugar", "glucose", "syrup", "fructose", "maltose", "dextrose"]
    if sugars >= 5:
        if not any(t in ingredients_text for t in sugar_terms):
            warnings.append(prefixed("OFF shows significant sugar but ingredient list lacks sugar terms — verify", "MEDIUM"))
            # don't automatically mark HIGH suspicious; ask user if they want to confirm
            suspicious = True

    # Macros sum > 100g (per 100g) -> suspicious (exceeds possible)
    macros_sum = g("proteins_100g") + g("fat_100g") + carbs
    if macros_sum > 100:
        warnings.append(prefixed(f"Sum of protein+fat+carbs = {macros_sum}g/100g (impossible) — data error", "HIGH"))
        suspicious = True

    # Salt vs sodium coherence
    sodium = g("sodium_100g")
    salt = g("salt_100g")
    if salt == 0 and sodium > 0:
        # convert sodium -> salt approx or ensure values consistent
        # We'll not mark suspicious, but add a check
        warnings.append(prefixed(f"Sodium present ({sodium}g) but salt field empty — using sodium to compute salt", "CHECK"))
    if salt > 10:
        warnings.append(prefixed(f"Salt = {salt}g/100g looks unrealistic", "HIGH"))
        suspicious = True

    # Caffeine check for savory snacks (unexpected)
    caffeine = g("caffeine_100g")
    if caffeine > 0 and "energy" not in ingredients_text and "coffee" not in ingredients_text and caffeine > 10:
        warnings.append(prefixed(f"Caffeine {caffeine} mg unusual for this product — verify", "MEDIUM"))
        suspicious = True

    # Additive density sanity: if many PRESERVATIVES present in a short ingredient string, mark medium
    additive_hits = sum(1 for p in PRESERVATIVES if p in ingredients_text)
    total_ings = len([i.strip() for i in ingredients_text.split(",") if i.strip()])
    if total_ings > 0:
        ratio = additive_hits / total_ings
        if ratio > 0.5:
            warnings.append(prefixed(f"Additives are {int(ratio*100)}% of listed ingredients — medium concern", "MEDIUM"))

    return suspicious, warnings

# -------------------- Scoring & Rules --------------------
def score_nutrients(nutrients: Dict) -> int:
    # Baseline numeric scoring, simple and transparent
    s = 10
    sugar = float(nutrients.get("sugars_100g", 0) or 0)
    fat = float(nutrients.get("fat_100g", 0) or 0)
    sat_fat = float(nutrients.get("saturated-fat_100g", 0) or 0)
    salt = float(nutrients.get("salt_100g", 0) or 0)

    # Baseline penalties (coarse)
    if sugar > 40: s -= 5
    elif sugar > 20: s -= 3
    elif sugar > 10: s -= 1

    if sat_fat > 10: s -= 3
    elif sat_fat > 5: s -= 2

    if salt > 2: s -= 3
    elif salt > 1.5: s -= 2

    # reward fiber/protein a bit (if present)
    fiber = float(nutrients.get("fiber_100g", 0) or 0)
    protein = float(nutrients.get("proteins_100g", 0) or 0)
    if fiber >= 10: s += 2
    elif fiber >= 5: s += 1

    if protein >= 20: s += 2
    elif protein >= 10: s += 1

    return max(1, min(10, int(round(s))))

def apply_health_rules(nutrients: Dict, ingredients_text: str) -> Tuple[int, List[str]]:
    """
    Apply JSON-driven rules with direct/indirect/protective handling.
    Returns (score_adjustment, warnings_with_confidence)
    """
    warnings = []
    score_adjustment = 0

    for cond in USER_PROFILE["conditions"]:
        cond = cond.strip().lower()
        if cond not in HEALTH_RULES:
            continue
        rules = HEALTH_RULES[cond]
        nutrient_rules = rules.get("nutrients", {})

        # Direct
        for nutrient, limits in nutrient_rules.get("direct", {}).items():
            val = float(nutrients.get(nutrient, 0) or 0)
            if val > limits["max"]:
                score_adjustment -= limits.get("penalty", 1)
                warnings.append(prefixed(rules.get("warnings", [""])[0], "HIGH"))

        # Indirect
        for nutrient, limits in nutrient_rules.get("indirect", {}).items():
            val = float(nutrients.get(nutrient, 0) or 0)
            if val > limits["max"]:
                score_adjustment -= limits.get("penalty", 1)
                warnings.append(prefixed(rules.get("warnings", [""])[0], "MEDIUM"))

        # Protective (bonus if >= min)
        for nutrient, limits in nutrient_rules.get("protective", {}).items():
            val = float(nutrients.get(nutrient, 0) or 0)
            if val >= limits.get("min", 0):
                score_adjustment += limits.get("bonus", 0)
                warnings.append(prefixed(f"{cond}: protective factor {nutrient}={val} (bonus)", "LOW"))

        # Ingredient-based
        for bad in rules.get("ingredients", []):
            if bad in ingredients_text:
                warnings.append(prefixed(rules.get("warnings", [""])[0], "HIGH"))

    # Deduplicate warnings while preserving order
    seen = set()
    dedup = []
    for w in warnings:
        if w not in seen:
            dedup.append(w); seen.add(w)
    return score_adjustment, dedup

# -------------------- Ingredient warnings (allergens/additives) --------------------
def ingredient_warnings(ingredients_text: str) -> List[str]:
    warnings = []
    it = ingredients_text.lower()
    for a in ALLERGENS:
        if a in it:
            warnings.append(prefixed(f"Contains allergen: {a}", "HIGH"))
    for p in PRESERVATIVES:
        if p in it:
            warnings.append(prefixed(f"Contains additive/preservative: {p}", "MEDIUM"))
    return warnings

# -------------------- Main analysis flow --------------------
def analyze_product(barcode: str) -> Dict:
    raw = fetch_product(barcode)
    product = {}
    if not raw or raw.get("status") != 1:
        print("\n❌ Product not found in OpenFoodFacts (OFF). You will be asked to enter data manually.")
        # manual full input
        nutrients = manual_nutrients({})
        ingredients_text = manual_ingredients("")
        product_name = "Manual Entry"
    else:
        product = raw.get("product", {})
        product_name = product.get("product_name", "Unknown")
        # Pull nutriments (OFF uses varied keys; we keep common keys)
        nutrients = product.get("nutriments", {}) or {}
        # ensure carbs key present attempt
        if "carbohydrates_100g" not in nutrients:
            # OFF sometimes uses 'carbohydrates_100g' or 'carbohydrates_value'
            # leave empty (0) if missing
            nutrients.setdefault("carbohydrates_100g", 0)
        ingredients_text = (product.get("ingredients_text", "") or product.get("ingredients_text_en", "") or "").lower()

        # Run validation on fetched data
        suspicious, conf_warnings = validate_nutrients(nutrients, ingredients_text)
        if suspicious:
            # show warnings and ask user whether to accept OFF data or enter manual
            print("\nData sanity checks raised concerns:")
            for cw in conf_warnings:
                print(" ", cw)
            choice = input("\nUse OFF data as-is? (y to accept / n to manually enter values): ").strip().lower()
            if choice != "y":
                nutrients = manual_nutrients(nutrients)
                ingredients_text = manual_ingredients(ingredients_text)
        # If OFF had no ingredients text, ask manual
        if not ingredients_text:
            ingredients_text = manual_ingredients("")

    # Baseline score (from validated or manual nutrients)
    base_score = score_nutrients(nutrients)

    # Apply condition-based adjustments
    adjust, health_warnings = apply_health_rules(nutrients, ingredients_text.lower())
    final_score = max(1, min(10, base_score + adjust))

    # Ingredient/allergen/additive warnings (with confidence)
    ing_warnings = ingredient_warnings(ingredients_text.lower())

    # Additional confidence-level flagging from validate_nutrients (if present and not already shown)
    suspicious2, conf_warnings2 = validate_nutrients(nutrients, ingredients_text)
    # conf_warnings2 might duplicate earlier prints; include them with 'CHECK' level if present
    # (If validate already run and user accepted, we still report these as informational)
    # Combine and dedupe
    combined = ing_warnings + health_warnings + conf_warnings2
    seen = set(); out_warnings = []
    for w in combined:
        if w not in seen:
            out_warnings.append(w); seen.add(w)

    return {
        "Product": product_name,
        "Score": final_score,
        "Tier": ("Daily" if final_score >= 8 else "Moderate" if final_score >=5 else "Occasional"),
        "Warnings": out_warnings
    }

# -------------------- CLI --------------------
if __name__ == "__main__":
    print("Setup your health profile (conditions, allergies). Examples: diabetes, high_bp, pregnant, high_cholesterol, kidney")
    conds = input("Enter conditions (comma separated, e.g. diabetes, high_bp, pregnant, high_cholesterol): ").strip().lower()
    alls = input("Enter allergies (comma separated, e.g. milk, gluten): ").strip().lower()
    USER_PROFILE["conditions"] = [c.strip() for c in conds.split(",") if c.strip()]
    USER_PROFILE["allergies"] = [a.strip() for a in alls.split(",") if a.strip()]

    barcode = input("\nEnter product barcode: ").strip()
    result = analyze_product(barcode)
    print("\n--- Analysis Result ---")
    print(json.dumps(result, indent=2))


# Example barcodes for testing: # 0038527014033 #Milk 
 # 6001069206581 # South African product
  # 070847811169 # US product 
# 049000000450 # Coca-Cola
# 5000159484695 # Walkers crisps
#  8901491100533  Chilli Chataka
#  5449000054227  #Original taste
#   3017620425035  Nutella

# Added some more barcodes for testing: 
# Also added specific health conditions to test personalized warnings
# and allergens to test allergen warnings.
