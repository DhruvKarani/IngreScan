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

# ---------- Custom Health Score ----------
def custom_health_score(nutrients: Dict[str, float]) -> float:
    sugars_g, sat_fat_g, sodium_mg = nutrients["sugars_g"], nutrients["sat_fat_g"], nutrients["sodium_mg"]
    fiber_g, protein_g = nutrients["fiber_g"], nutrients["protein_g"]

    penalties = (sugars_g / 50.0) * 3 + (sat_fat_g / 20.0) * 2 + (sodium_mg / 2000.0) * 2
    rewards   = (fiber_g / 10.0) * 2 + (protein_g / 20.0) * 1.5

    raw_score = 5.0 + rewards - penalties
    return max(0, min(10, round(raw_score, 1)))

# ---------- Manual Input Fallback ----------
def manual_input() -> Dict[str, float]:
    print("\n⚠️ Product not found in OFF. Enter nutrition values manually:")
    energy_kj = float(input("Energy (kJ per 100g): ") or 0)
    sugars_g  = float(input("Sugars (g per 100g): ") or 0)
    sat_fat_g = float(input("Saturated Fat (g per 100g): ") or 0)
    sodium_mg = float(input("Sodium (mg per 100g): ") or 0)
    fruit_pct = float(input("Fruit/Vegetable/Nut %: ") or 0)
    fiber_g   = float(input("Fiber (g per 100g): ") or 0)
    protein_g = float(input("Protein (g per 100g): ") or 0)

    return {
        "energy_kj": energy_kj, "sugars_g": sugars_g, "sat_fat_g": sat_fat_g,
        "sodium_mg": sodium_mg, "fruit_pct": fruit_pct, "fiber_g": fiber_g, "protein_g": protein_g
    }

# ---------- Wrapper ----------
def score_from_barcode(barcode: str) -> Dict[str, Any]:
    prod = fetch_off_product(barcode)

    if not prod:
        nutrients = manual_input()
        ns = nutri_score_full(**nutrients)
        return {
            "barcode": barcode,
            "product_name": "Manual Entry",
            "nutri_score": ns,
            "nutrition_inputs": nutrients,
            "ingredients": {"ingredients_text": "Manual entry", "allergens": [], "additives": []}
        }

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

def nutrition_score(nutrients, liquid=False):
    """
    nutrients: dict with keys:
        energy_kj, sugars_g, sat_fat_g, sodium_mg,
        fruit_pct, fiber_g, protein_g
    liquid: bool → stricter sugar penalties for drinks
    
    Returns: score (0–10)
    """

    # --- Bonuses ---
    protein = nutrients.get("protein_g", 0.0)
    fiber   = nutrients.get("fiber_g", 0.0)
    fruit   = nutrients.get("fruit_pct", 0.0)

    bonus = 0
    bonus += min(protein, 20) / 20 * 2.5      # up to +2.5
    bonus += min(fiber, 10) / 10 * 3.0        # up to +3
    bonus += min(fruit, 60) / 60 * 2.0        # up to +2

    # --- Penalties ---
    sugar   = nutrients.get("sugars_g", 0.0)
    satfat  = nutrients.get("sat_fat_g", 0.0)
    sodium  = nutrients.get("sodium_mg", 0.0)
    energy  = nutrients.get("energy_kj", 0.0) / 4.184  # kcal approx

    penalty = 0

    # Sugar penalties
    if liquid:  # stricter thresholds
        if sugar > 5:  penalty += 1
        if sugar > 10: penalty += 2
        if sugar > 15: penalty += 3
    else:
        if sugar > 5:  penalty += 0.5
        if sugar > 10: penalty += 1
        if sugar > 20: penalty += 3

    # Sat fat penalties
    if satfat > 5:  penalty += 0.5
    if satfat > 10: penalty += 1.5
    if satfat > 20: penalty += 3

    # Sodium penalties
    if sodium > 400:  penalty += 0.5
    if sodium > 800:  penalty += 1.5
    if sodium > 1500: penalty += 3

    # Energy density penalty (optional)
    if energy > 450 and (protein + fiber) < 5:
        penalty += 1.5

    # --- Final Score ---
    score = 5 + bonus - penalty

    # Ceiling rule: unhealthy sugar/sat fat caps max score
    if sugar > 20 or satfat > 10:
        score = min(score, 8)

    return round(max(0, min(10, score)), 1)


# ---------- Example Run ----------
if __name__ == "__main__":
    result = score_from_barcode("0000000000000")  # Fake barcode for testing manual input

    print("\n--- Product Info ---")
    print(f"Barcode: {result['barcode']}")
    print(f"Product Name: {result['product_name']}")

    # Scores
    grade = result['nutri_score']['grade']
    health_score = custom_health_score(result["nutrition_inputs"])

    print("\n--- Scores ---")
    print(f"Custom Health Score: {health_score}/10")

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
nutrients = {
    "energy_kj": 1500,
    "sugars_g": 10,
    "sat_fat_g": 12,
    "sodium_mg": 11,
    "fruit_pct": 9,
    "fiber_g": 5,
    "protein_g": 25
}

print(nutrition_score(nutrients))  # Example
