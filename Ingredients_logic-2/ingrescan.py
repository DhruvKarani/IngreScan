import requests
import json

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
    for allergen in ALLERGENS:
        if allergen in ingredients:
            warnings.append(f"⚠ Contains allergen: {allergen}")

    # Preservative check
    for additive in PRESERVATIVES:
        if additive in ingredients:
            warnings.append(f"Contains additive/preservative: {additive}")

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

            # Ingredient-based warnings
            for bad in rules.get("ingredients", []):
                if bad in ingredients:
                    warnings.extend(rules.get("warnings", []))

    return score_penalty, list(set(warnings))  # remove duplicates


def analyze_product(barcode):
    data = fetch_product(barcode)

    if not data or data.get("status") == 0:
        print("\n❌ Product not found in OFF database.")
        name = "Unknown"
        nutrients = manual_nutrients()
        ingredients = manual_ingredients()
    else:
        product = data.get("product", {})
        name = product.get("product_name", "Unknown")

        nutrients = product.get("nutriments", {})
        if not nutrients:
            nutrients = manual_nutrients()

        ingredients = product.get("ingredients_text", "")
        if not ingredients:
            ingredients = manual_ingredients()

    # Baseline score
    score = score_nutrients(nutrients)

    # Apply health penalties
    penalty, health_warnings = apply_health_rules(nutrients, ingredients.lower())
    score = max(score + penalty, 1)

    # General + personalized warnings
    warnings = check_warnings(ingredients.lower()) + health_warnings

    return {
        "Product": name,
        "Score": score,
        "Tier": assign_tier(score),
        "Warnings": warnings
    }


if __name__ == "__main__":
    # Step 1: Set user profile
    print("Setup your health profile:")
    USER_PROFILE["conditions"] = input("Enter conditions (comma separated, e.g. diabetes, high_bp, pregnant): ").lower().split(",")
    USER_PROFILE["allergies"] = input("Enter allergies (comma separated, e.g. milk, gluten): ").lower().split(",")

    # Step 2: Analyze product
    barcode = input("\nEnter product barcode: ").strip()
    result = analyze_product(barcode)
    print(result)

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
