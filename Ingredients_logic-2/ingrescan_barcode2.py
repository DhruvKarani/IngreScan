# # import requests
# # import json

# # # ---- USER PROFILE ----
# # user_profile = {
# #     "allergens": ["milk", "peanuts"],   # Example allergens
# #     "conditions": ["diabetes"]          # Example condition
# # }

# # # ---- PRESERVATIVE / ADDITIVE LIST ----
# # preservatives = [
# #     "sodium benzoate", "potassium sorbate", "emulsifier",
# #     "stabilizer", "flavoring", "color"
# # ]

# # # ---- MANUAL INPUT FUNCTION ----
# # def ask_manual_input(existing_nutrients=None):
# #     """
# #     Ask user for missing nutrition values if product data is missing/incomplete.
# #     If existing_nutrients dict is passed, only ask for missing ones.
# #     """
# #     if existing_nutrients is None:
# #         existing_nutrients = {}

# #     def ask_value(field, prompt):
# #         if field not in existing_nutrients or existing_nutrients[field] is None:
# #             val = input(f"{prompt} (per 100g, leave empty if unknown): ")
# #             if val.strip() != "":
# #                 try:
# #                     existing_nutrients[field] = float(val)
# #                 except ValueError:
# #                     existing_nutrients[field] = 0.0
# #             else:
# #                 existing_nutrients[field] = 0.0
# #         return existing_nutrients[field]

# #     ask_value("sugars_100g", "Sugars (g)")
# #     ask_value("saturated-fat_100g", "Saturated fat (g)")
# #     ask_value("proteins_100g", "Proteins (g)")
# #     ask_value("fiber_100g", "Fiber (g)")
# #     ask_value("energy-kj_100g", "Energy (kJ)")
# #     return existing_nutrients


# # # ---- HEALTH SCORING FUNCTION ----
# # def health_score(nutrients):
# #     score = 10
# #     sugars = nutrients.get("sugars_100g", 0)
# #     sat_fat = nutrients.get("saturated-fat_100g", 0)
# #     protein = nutrients.get("proteins_100g", 0)
# #     fiber = nutrients.get("fiber_100g", 0)

# #     # Penalize high sugar
# #     if sugars > 40:
# #         score -= 5
# #     elif sugars > 20:
# #         score -= 3
# #     elif sugars > 10:
# #         score -= 1

# #     # Penalize high saturated fat
# #     if sat_fat > 10:
# #         score -= 3
# #     elif sat_fat > 5:
# #         score -= 2

# #     # Reward protein
# #     if protein >= 20:
# #         score += 2
# #     elif protein >= 10:
# #         score += 1

# #     # Reward fiber (higher weight than protein)
# #     if fiber >= 10:
# #         score += 3
# #     elif fiber >= 5:
# #         score += 2
# #     elif fiber >= 2:
# #         score += 1

# #     return max(1, min(score, 10))


# # # ---- TIER BASED ON SCORE ----
# # def get_tier(score):
# #     if score >= 8:
# #         return "Daily"
# #     elif score >= 6:
# #         return "Weekly"
# #     elif score >= 4:
# #         return "Occasional"
# #     else:
# #         return "Avoid"


# # # ---- FLAGGING INGREDIENTS ----
# # def check_flags(product, profile):
# #     warnings = []
# #     ingredients = [i.get("text", "").lower() for i in product.get("ingredients", [])]

# #     # Preservatives
# #     flagged_preservatives = [i for i in ingredients if any(p in i for p in preservatives)]
# #     if flagged_preservatives:
# #         warnings.append(f"Contains additives/preservatives: {', '.join(flagged_preservatives)}")

# #     # Allergens
# #     flagged_allergens = [i for i in ingredients if i in profile["allergens"]]
# #     if flagged_allergens:
# #         warnings.append(f"⚠ Allergen risk: {', '.join(flagged_allergens)}")

# #     # Condition: diabetes → sugar check
# #     if "diabetes" in profile["conditions"]:
# #         sugars = product.get("nutriments", {}).get("sugars_100g", 0)
# #         if sugars > 10:
# #             warnings.append("⚠ High sugar content - not suitable for diabetes")

# #     return warnings


# # # ---- MAIN FUNCTION ----
# # def analyze_barcode(barcode):
# #     url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
# #     response = requests.get(url)
# #     data = response.json()

# #     if data.get("status") != 1:
# #         print("❌ Product not found in Open Food Facts. Please enter values manually.")
# #         nutrients = ask_manual_input()
# #         product = {"product_name": "Manual Entry", "nutriments": nutrients, "ingredients": []}
# #     else:
# #         product = data["product"]
# #         nutrients = product.get("nutriments", {})
# #         nutrients = ask_manual_input(nutrients)  # Fill missing fields

# #     # Score + Tier
# #     score = health_score(nutrients)
# #     tier = get_tier(score)
# #     warnings = check_flags(product, user_profile)

# #     # Output
# #     output = {
# #         "Product": product.get("product_name", "Unknown"),
# #         "Score": score,
# #         "Tier": tier,
# #         "Warnings": warnings
# #     }

# #     print(json.dumps(output, indent=2))


# # # ---- RUN SCRIPT ----
# # if __name__ == "__main__":
# #     barcode = input("Enter product barcode: ")
# #     analyze_barcode(barcode)





# import requests
# import re

# # Allergen and preservative keywords
# ALLERGENS = ["milk", "peanut", "soy", "gluten", "almond", "cashew", "walnut"]
# PRESERVATIVES = ["preservative", "stabilizer", "color", "flavor", "emulsifier", "additive"]

# def fetch_product(barcode):
#     url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
#     res = requests.get(url)
#     if res.status_code == 200:
#         return res.json()
#     return None

# def manual_nutrients():
#     print("\n⚠ Nutrient data missing. Please enter manually:")
#     sugar = float(input("Sugar (per 100g): ") or 0)
#     fat = float(input("Fat (per 100g): ") or 0)
#     salt = float(input("Salt (per 100g): ") or 0)
#     return {"sugars_100g": sugar, "fat_100g": fat, "salt_100g": salt}

# def manual_ingredients():
#     print("\n⚠ Ingredient list missing. Please type/paste ingredients:")
#     return input("Ingredients: ").lower()

# def score_nutrients(nutrients):
#     sugar = nutrients.get("sugars_100g", 0)
#     fat = nutrients.get("fat_100g", 0)
#     salt = nutrients.get("salt_100g", 0)

#     # Simple scoring logic
#     score = 10
#     if sugar > 10: score -= 3
#     if fat > 15: score -= 2
#     if salt > 1.5: score -= 2
#     return max(score, 1)

# def assign_tier(score):
#     if score >= 8:
#         return "Daily"
#     elif score >= 5:
#         return "Moderate"
#     else:
#         return "Occasional"

# def check_warnings(ingredients):
#     warnings = []
#     for allergen in ALLERGENS:
#         if allergen in ingredients:
#             warnings.append(f"⚠ Contains allergen: {allergen}")
#     for additive in PRESERVATIVES:
#         if additive in ingredients:
#             warnings.append(f"Contains additive/preservative: {additive}")
#     return warnings

# def analyze_product(barcode):
#     data = fetch_product(barcode)

#     if not data or data.get("status") == 0:
#         print("\n❌ Product not found in OFF database.")
#         name = "Unknown"
#         nutrients = manual_nutrients()
#         ingredients = manual_ingredients()
#     else:
#         product = data.get("product", {})
#         name = product.get("product_name", "Unknown")

#         nutrients = product.get("nutriments", {})
#         if not nutrients:
#             nutrients = manual_nutrients()

#         ingredients = product.get("ingredients_text", "")
#         if not ingredients:
#             ingredients = manual_ingredients()

#     # Analysis
#     score = score_nutrients(nutrients)
#     tier = assign_tier(score)
#     warnings = check_warnings(ingredients.lower())

#     return {
#         "Product": name,
#         "Score": score,
#         "Tier": tier,
#         "Warnings": warnings
#     }

# if __name__ == "__main__":
#     barcode = input("Enter product barcode: ").strip()
#     result = analyze_product(barcode)
#     print(result)


import requests

# Default allergens/preservatives list
ALLERGENS = ["milk", "peanut", "soy", "gluten", "almond", "cashew", "walnut"]
PRESERVATIVES = ["preservative", "stabilizer", "color", "flavor", "emulsifier", "additive"]

# User profile (will be set once at start)
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
    return {"sugars_100g": sugar, "fat_100g": fat, "salt_100g": salt}


def manual_ingredients():
    print("\n⚠ Ingredient list missing. Please type/paste ingredients:")
    return input("Ingredients: ").lower()


def score_nutrients(nutrients):
    sugar = nutrients.get("sugars_100g", 0)
    fat = nutrients.get("fat_100g", 0)
    salt = nutrients.get("salt_100g", 0)

    # Simple scoring logic
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


def personalized_warnings(nutrients, ingredients):
    warnings = []

    # Diabetes → flag sugar
    if "diabetes" in USER_PROFILE["conditions"]:
        if nutrients.get("sugars_100g", 0) > 5:
            warnings.append("⚠ High sugar content - not suitable for diabetes")

    # High BP → flag salt
    if "high_bp" in USER_PROFILE["conditions"]:
        if nutrients.get("salt_100g", 0) > 1.5:
            warnings.append("⚠ High salt - not suitable for high blood pressure")

    # User allergies → match in ingredient list
    for allergy in USER_PROFILE["allergies"]:
        if allergy.lower() in ingredients:
            warnings.append(f"⚠ Avoids allergen (user profile): {allergy}")

    return warnings


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

    # Analysis
    score = score_nutrients(nutrients)
    tier = assign_tier(score)

    # General + personalized warnings
    warnings = check_warnings(ingredients.lower())
    warnings.extend(personalized_warnings(nutrients, ingredients.lower()))

    return {
        "Product": name,
        "Score": score,
        "Tier": tier,
        "Warnings": warnings
    }


if __name__ == "__main__":
    # Step 1: Set user profile
    print("Setup your health profile:")
    USER_PROFILE["conditions"] = input("Enter conditions (comma separated, e.g. diabetes, high_bp): ").lower().split(",")
    USER_PROFILE["allergies"] = input("Enter allergies (comma separated, e.g. milk, gluten): ").lower().split(",")

    # Step 2: Analyze product
    barcode = input("\nEnter product barcode: ").strip()
    result = analyze_product(barcode)
    print(result)
# Example barcodes for testing: # 0038527014033 # Milk # 6001069206581 # South African product # 070847811169 # US product # 049000000450 # Coca-Cola