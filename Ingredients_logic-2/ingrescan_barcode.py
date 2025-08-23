# ingrescan_barcode.py
import requests
from typing import Dict, Tuple, Any, Optional, List

# ---------- Nutri-Score ----------
def _points_from_thresholds(value: float, thresholds: List[float]) -> int:
    return sum(value > t for t in thresholds)

def nutri_score_full(energy_kj: float, sugars_g: float, sat_fat_g: float, sodium_mg: float,
                     fruit_pct: float, fiber_g: float, protein_g: float) -> Dict[str, Any]:
    # Negative points
    energy_pts = _points_from_thresholds(energy_kj, [335,670,1005,1340,1675,2010,2345,2680,3015,3350])
    sugar_pts  = _points_from_thresholds(sugars_g, [4.5,9,13.5,18,22.5,27,31,36,40,45])
    satfat_pts = _points_from_thresholds(sat_fat_g, [1,2,3,4,5,6,7,8,9,10])
    sodium_pts = _points_from_thresholds(sodium_mg, [90,180,270,360,450,540,630,720,810,900])

    # Positive points
    if   fruit_pct < 40: fruit_pts = 0
    elif fruit_pct < 60: fruit_pts = 1
    elif fruit_pct < 80: fruit_pts = 2
    else:                fruit_pts = 5

    fiber_pts   = _points_from_thresholds(fiber_g,   [0.9,1.9,2.8,3.7,4.7])
    protein_pts = _points_from_thresholds(protein_g, [1.6,3.2,4.8,6.4,8])

    neg = energy_pts + sugar_pts + satfat_pts + sodium_pts
    pos = fruit_pts + fiber_pts + protein_pts
    score = neg - pos

    # Map to Nutri-Score grade
    if score <= -1: grade = "A"
    elif score <= 2: grade = "B"
    elif score <= 10: grade = "C"
    elif score <= 18: grade = "D"
    else: grade = "E"

    return {
        "score": score, "grade": grade,
        "breakdown": {
            "negative": {"energy": energy_pts, "sugars": sugar_pts, "sat_fat": satfat_pts, "sodium": sodium_pts, "total": neg},
            "positive": {"fruit_pct": fruit_pts, "fiber": fiber_pts, "protein": protein_pts, "total": pos},
        }
    }

# ---------- OpenFoodFacts ----------
def fetch_off_product(barcode: str) -> Optional[Dict[str, Any]]:
    url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
    r = requests.get(url, timeout=10)
    if r.status_code != 200: return None
    data = r.json()
    if data.get("status") != 1: return None
    return data["product"]

def _salt_to_sodium_mg(salt_g_per_100g: float) -> float:
    return salt_g_per_100g * 0.393 * 1000.0  # convert salt → sodium mg

def extract_for_nutriscore(p: Dict[str, Any]) -> Tuple[float,float,float,float,float,float,float]:
    n = p.get("nutriments", {})
    energy_kj = n.get("energy-kj_100g") or n.get("energy_100g") or 0.0
    sugars_g  = n.get("sugars_100g") or 0.0
    sat_g     = n.get("saturated-fat_100g") or 0.0
    sodium_mg = (n.get("sodium_100g") or 0.0) * 1000.0
    if not sodium_mg and n.get("salt_100g") is not None:
        sodium_mg = _salt_to_sodium_mg(n["salt_100g"])
    fiber_g   = n.get("fiber_100g") or 0.0
    protein_g = n.get("proteins_100g") or 0.0
    fruit_pct = p.get("fruits-vegetables-nuts_100g") or p.get("fruits-vegetables-nuts-estimate_100g") or 0.0
    return energy_kj, sugars_g, sat_g, sodium_mg, float(fruit_pct), fiber_g, protein_g

def ingredient_explainability(p: Dict[str, Any]) -> Dict[str, Any]:
    ingredients_text = p.get("ingredients_text") or p.get("ingredients_text_en") or ""
    allergens = [t.replace("en:", "").replace("_", " ").title() for t in p.get("allergens_tags", [])]
    additives = [t.replace("en:", "").upper() for t in p.get("additives_tags", [])]
    return {"ingredients_text": ingredients_text, "allergens": allergens, "additives": additives}

def nutrition_warnings(nutrients: Dict[str, float]) -> List[str]:
    warnings = []
    if nutrients["sugars_g"] > 22.5: warnings.append("High sugar content")
    if nutrients["sat_fat_g"] > 5:   warnings.append("High saturated fat")
    if nutrients["sodium_mg"] > 600: warnings.append("High sodium")
    return warnings

# ---------- Wrapper ----------
def score_from_barcode(barcode: str) -> Dict[str, Any]:
    prod = fetch_off_product(barcode)
    if not prod:
        return {"error": "Product not found on OpenFoodFacts"}

    energy_kj, sugars_g, sat_g, sodium_mg, fruit_pct, fiber_g, protein_g = extract_for_nutriscore(prod)
    ns = nutri_score_full(energy_kj, sugars_g, sat_g, sodium_mg, fruit_pct, fiber_g, protein_g)
    explain = ingredient_explainability(prod)

    return {
        "barcode": barcode,
        "product_name": prod.get("product_name") or prod.get("generic_name") or "Unknown",
        "nutri_score": ns,
        "nutrition_inputs": {
            "energy_kj": energy_kj, "sugars_g": sugars_g, "sat_fat_g": sat_g,
            "sodium_mg": sodium_mg, "fruit_pct": fruit_pct, "fiber_g": fiber_g, "protein_g": protein_g
        },
        "ingredients": explain
    }

# ---------- Example Run ----------
# ---------- Example Run ----------
if __name__ == "__main__":
    result = score_from_barcode("5449000000996")  # Coca-Cola

    grade_meaning = {
        "A": "Excellent (Highest)",
        "B": "Good",
        "C": "Average",
        "D": "Poor",
        "E": "Very Poor (Lowest)"
    }

# Mapping Nutri-Score grade to fixed numeric range
    grade_to_score = {
        "A": 10,
        "B": 8,
        "C": 6,
        "D": 4,
        "E": 2
    }

    print("\n--- Product Info ---")
    print(f"Barcode: {result['barcode']}")
    print(f"Product Name: {result['product_name']}")

    # Get remapped score
    grade = result['nutri_score']['grade']
    mapped_score = grade_to_score.get(grade, "?")

    print(f"Nutri-Score: {grade} ({mapped_score}/10)")

    print("\n--- Nutrition Inputs ---")
    for k, v in result['nutrition_inputs'].items():
        print(f"{k}: {v}")

    print("\n--- Ingredients ---")
    print(f"List: {result['ingredients']['ingredients_text']}")
    print(f"Additives: {', '.join(result['ingredients']['additives']) if result['ingredients']['additives'] else 'None'}")


    # 🔔 Health Warnings
    print("\n--- Health Warnings ---")
    warnings = nutrition_warnings(result["nutrition_inputs"])
    if warnings:
        for w in warnings:
            print(f"- {w}")
    else:
        print("No major warnings")
