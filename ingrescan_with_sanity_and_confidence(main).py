import requests
import json
import time

# Load health rules from JSON
with open("health_rules.json", "r") as f:
    HEALTH_RULES = json.load(f)

# Default allergens/preservatives list
ALLERGENS = ["milk", "peanut", "soy", "gluten", "almond", "cashew", "walnut"]
PRESERVATIVES = ["preservative", "stabilizer", "color", "flavor", "emulsifier", "additive"]

# User profile (set once at start)
USER_PROFILE = {"allergies": [], "conditions": []}


def fetch_product(barcode):
    url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
    res = requests.get(url)
    if res.status_code == 200:
        return res.json()
    return None


def manual_nutrients():
    print("\n⚠ Nutrient data missing. Please enter manually:")
    sugar = float(input("Sugar (per 100g): ") or 0)
    fat = float(input("Fat (per 100g): ") or 0)
    salt = float(input("Salt (per 100g): ") or 0)
    protein = float(input("Protein (per 100g): ") or 0)
    return {"sugars_100g": sugar, "fat_100g": fat, "salt_100g": salt, "proteins_100g": protein}


def manual_ingredients():
    print("\n⚠ Ingredient list missing. Please type/paste ingredients:")
    return input("Ingredients: ").lower()


def score_nutrients(nutrients):
    sugar = nutrients.get("sugars_100g", 0)
    fat = nutrients.get("fat_100g", 0)
    salt = nutrients.get("salt_100g", 0)

    # Simple baseline scoring
    score = 10
    if sugar > 10: score -= 3
    if fat > 15: score -= 2
    if salt > 1.5: score -= 2
    return max(score, 1)


def assign_tier(score):
    if score >= 8:
        return "Daily"
    elif score >= 5:
        return "Moderate"
    else:
        return "Occasional"


def check_warnings(ingredients):
    warnings = []

    # Allergen check
    for allergen in USER_PROFILE["allergies"]:
        if allergen in ingredients:
            warnings.append(f"[HIGH] Contains allergen: {allergen}")

    # Preservative check
    for additive in PRESERVATIVES:
        if additive in ingredients:
            warnings.append(f"[MEDIUM] Contains additive/preservative: {additive}")

    return warnings


def apply_health_rules(nutrients, ingredients):
    warnings = []
    score_penalty = 0

    for condition in USER_PROFILE["conditions"]:
        condition = condition.strip().lower()
        if condition in HEALTH_RULES:
            rules = HEALTH_RULES[condition]

            # Nutrient-based penalties
            for nutrient, limits in rules.get("nutrients", {}).items():
                if nutrients.get(nutrient, 0) > limits["max"]:
                    score_penalty -= limits["penalty"]
                    warnings.extend(rules.get("warnings", []))

            # Ingredient-based penalties
            for bad in rules.get("ingredients", []):
                if bad in ingredients:
                    # Apply a penalty if ingredient is present
                    penalty_points = rules.get("penalty_points", 3)  # default 3 if not specified
                    score_penalty -= penalty_points
                    warnings.extend(rules.get("warnings", []))

    return score_penalty, list(set(warnings))  # remove duplicates


def apply_synergy_rules(nutrients):
    synergy_penalty = 0
    synergy_warnings = []

    for rule in HEALTH_RULES.get("synergy_rules", []):
        n1, n2 = rule["nutrient1"], rule["nutrient2"]
        th1, th2 = rule["thresholds"]
        if nutrients.get(n1, 0) > th1 and nutrients.get(n2, 0) > th2:
            synergy_penalty -= rule["penalty"]
            synergy_warnings.append(f"[HIGH] {rule['warning']}")

    return synergy_penalty, synergy_warnings


def check_data_reliability(product):
    warnings = []
    confidence = "HIGH"

    last_mod = product.get("last_modified_t")
    if last_mod:
        years_old = (time.time() - last_mod) / (60 * 60 * 24 * 365)
        if years_old > 5:
            warnings.append(f"[CHECK] Data may be outdated (last updated {int(years_old)} years ago)")
            confidence = "MEDIUM"

    return confidence, warnings


def analyze_product(barcode):
    data = fetch_product(barcode)

    if not data or data.get("status") == 0:
        print("\n❌ Product not found in OFF database.")
        name = "Unknown"
        nutrients = manual_nutrients()
        ingredients = manual_ingredients()
        confidence = "LOW"
        extra_warnings = ["[CHECK] No OFF data available, fully manual input."]
    else:
        product = data.get("product", {})
        name = product.get("product_name", "Unknown")

        nutrients = product.get("nutriments", {})
        if not nutrients:
            nutrients = manual_nutrients()

        ingredients = product.get("ingredients_text", "")
        if not ingredients:
            ingredients = manual_ingredients()

        # Reliability check
        confidence, extra_warnings = check_data_reliability(product)

    ingredients_lower = ingredients.lower()

    # Baseline score
    score = score_nutrients(nutrients)

    # Apply health penalties
    penalty, health_warnings = apply_health_rules(nutrients, ingredients_lower)

    # Apply allergy penalties
    allergy_penalty = 0
    allergy_warnings = []
    for allergen in USER_PROFILE["allergies"]:
        if allergen in ingredients_lower:
            allergy_penalty -= 5  # fixed penalty for allergen
            allergy_warnings.append(f"[HIGH] Contains allergen: {allergen}")

    # Apply synergy penalties
    synergy_penalty, synergy_warnings = apply_synergy_rules(nutrients)

    # Combine all penalties and warnings
    total_penalty = penalty + allergy_penalty + synergy_penalty
    score = max(score + total_penalty, 0)  # score can't go below 0

    warnings = list(set(health_warnings + allergy_warnings + synergy_warnings + extra_warnings))

    return {
        "Product": name,
        "Score": score,
        "Tier": assign_tier(score),
        "Confidence": confidence,
        "Warnings": warnings
    }


if __name__ == "__main__":
    # Step 1: Set user profile
    print("Setup your health profile:")
    USER_PROFILE["conditions"] = input("Enter conditions (comma separated, e.g. diabetes, high_bp, pregnant, high_cholesterol): ").lower().split(",")
    USER_PROFILE["allergies"] = input("Enter allergies (comma separated, e.g. milk, gluten): ").lower().split(",")

    # Step 2: Analyze product
    barcode = input("\nEnter product barcode: ").strip()
    result = analyze_product(barcode)
    print(json.dumps(result, indent=2, ensure_ascii=False))


#Example barcodes for testing: # 0038527014033 #Milk 
 # 6001069206581 # South African product
  # 070847811169 # US product 
# 049000000450 # Coca-Cola
# 5000159484695 # Walkers crisps
#  8901491100533  Chilli Chataka
#  5449000054227  #Original taste
#   3017620425035  Nutella