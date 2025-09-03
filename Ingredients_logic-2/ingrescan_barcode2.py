import requests
import json

# ---- USER PROFILE ----
user_profile = {
    "allergens": ["milk", "peanuts"],
    "conditions": ["diabetes"]  # can be empty if none
}

# ---- PRESERVATIVE / ADDITIVE LIST ----
preservatives = ["sodium benzoate", "potassium sorbate", "emulsifier", "stabilizer", "flavoring", "color"]

# ---- HEALTH SCORING FUNCTION ----
def health_score(nutrients):
    score = 10
    sugars = nutrients.get("sugars_100g", 0)
    sat_fat = nutrients.get("saturated-fat_100g", 0)
    protein = nutrients.get("proteins_100g", 0)
    fiber = nutrients.get("fiber_100g", 0)

    if sugars > 40:
        score -= 4
    elif sugars > 20:
        score -= 2

    if sat_fat > 8:
        score -= 2

    if protein >= 20:
        score += 2
    elif protein >= 10:
        score += 1

    if fiber >= 10:
        score += 2
    elif fiber >= 5:
        score += 1

    return max(1, min(score, 10))  # clamp between 1 and 10

# ---- TIER BASED ON SCORE ----
def get_tier(score):
    if score >= 8:
        return "Daily"
    elif score >= 6:
        return "Weekly"
    elif score >= 4:
        return "Occasional"
    else:
        return "Avoid"

# ---- FLAGGING INGREDIENTS ----
def check_flags(product, profile):
    warnings = []
    ingredients = [i.get("text", "").lower() for i in product.get("ingredients", [])]

    flagged_preservatives = [i for i in ingredients if any(p in i for p in preservatives)]
    if flagged_preservatives:
        warnings.append(f"Contains additives/preservatives: {', '.join(flagged_preservatives)}")

    flagged_allergens = [i for i in ingredients if i in profile["allergens"]]
    if flagged_allergens:
        warnings.append(f"⚠ Allergen risk: {', '.join(flagged_allergens)}")

    if "diabetes" in profile["conditions"]:
        sugars = product.get("nutriments", {}).get("sugars_100g", 0)
        if sugars > 10:
            warnings.append("⚠ High sugar content - not suitable for diabetes")

    return warnings

# ---- MAIN ----
def analyze_barcode(barcode):
    url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
    response = requests.get(url)
    data = response.json()

    if data.get("status") != 1:
        print("❌ Product not found in Open Food Facts")
        return

    product = data["product"]
    nutrients = product.get("nutriments", {})

    score = health_score(nutrients)
    tier = get_tier(score)
    warnings = check_flags(product, user_profile)

    output = {
        "Product": product.get("product_name", "Unknown"),
        "Score": score,
        "Tier": tier,
        "Warnings": warnings
    }

    print(json.dumps(output, indent=2))


# ---- RUN ----
if __name__ == "__main__":
    barcode = input("Enter product barcode: ")
    analyze_barcode(barcode)


#	0038527014033 
#   6001069206581
#   070847811169
#   049000000450