# ingrescan_barcode.py
import re
import requests
from typing import Dict, Tuple, Any, Optional, List

# ---------- Nutri-Score (kept for inputs & compatibility) ----------
def _points_from_thresholds(value: float, thresholds: List[float]) -> int:
    return sum(value > t for t in thresholds)

def nutri_score_full(energy_kj: float, sugars_g: float, sat_fat_g: float, sodium_mg: float,
                     fruit_pct: float, fiber_g: float, protein_g: float) -> Dict[str, Any]:
    energy_pts = _points_from_thresholds(energy_kj, [335,670,1005,1340,1675,2010,2345,2680,3015,3350])
    sugar_pts  = _points_from_thresholds(sugars_g, [4.5,9,13.5,18,22.5,27,31,36,40,45])
    satfat_pts = _points_from_thresholds(sat_fat_g, [1,2,3,4,5,6,7,8,9,10])
    sodium_pts = _points_from_thresholds(sodium_mg, [90,180,270,360,450,540,630,720,810,900])

    if   fruit_pct < 40: fruit_pts = 0
    elif fruit_pct < 60: fruit_pts = 1
    elif fruit_pct < 80: fruit_pts = 2
    else:                fruit_pts = 5

    fiber_pts   = _points_from_thresholds(fiber_g,   [0.9,1.9,2.8,3.7,4.7])
    protein_pts = _points_from_thresholds(protein_g, [1.6,3.2,4.8,6.4,8])

    neg = energy_pts + sugar_pts + satfat_pts + sodium_pts
    pos = fruit_pts + fiber_pts + protein_pts
    score = neg - pos

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
    ingredients_text = (
        p.get("ingredients_text")
        or p.get("ingredients_text_en")
        or p.get("ingredients_text_in")  # sometimes Indian entries
        or ""
    )
    allergens = [t.replace("en:", "").replace("_", " ").title() for t in p.get("allergens_tags", [])]
    additives = [t.replace("en:", "").upper() for t in p.get("additives_tags", [])]
    return {"ingredients_text": ingredients_text, "allergens": allergens, "additives": additives}

# ---------- Warnings on nutrients ----------
def nutrition_warnings(nutrients: Dict[str, float]) -> List[str]:
    warnings = []
    if nutrients["sugars_g"] > 22.5: warnings.append("High sugar content")
    if nutrients["sat_fat_g"] > 5:   warnings.append("High saturated fat")
    if nutrients["sodium_mg"] > 600: warnings.append("High sodium")
    return warnings

# ---------- Custom Health Score (nutrient-based 0–10) ----------
def custom_health_score(nutrients: Dict[str, float]) -> float:
    sugars_g, sat_fat_g, sodium_mg = nutrients["sugars_g"], nutrients["sat_fat_g"], nutrients["sodium_mg"]
    fiber_g, protein_g = nutrients["fiber_g"], nutrients["protein_g"]

    penalties = (sugars_g / 50.0) * 3 + (sat_fat_g / 20.0) * 2 + (sodium_mg / 2000.0) * 2
    rewards   = (fiber_g / 10.0) * 2.5 + (protein_g / 20.0) * 1.5  # fiber slightly > protein
    raw_score = 5.0 + rewards - penalties
    return max(0, min(10, round(raw_score, 1)))

# ---------- Ingredient Flagging (rule-based v1, AI-ready) ----------
SEED_PATTERNS = [
    # (regex pattern, label, consumption, reason)
    (r"\b(hydrogenated|partially hydrogenated|trans[- ]?fat)\b", "Trans fats", "occasional", "Associated with CVD risk"),
    (r"\b(palm oil|palmolein)\b", "Palm oil", "weekly", "High saturated fat; sustainability concerns"),
    (r"\b(sodium benzoate|potassium benzoate|e2?11)\b", "Benzoates (preservatives)", "weekly", "Linked to hyperactivity concerns in some studies"),
    (r"\b(sodium nitrite|potassium nitrite|sodium nitrate|e2?(49|50))\b", "Nitrites/Nitrates", "occasional", "Processed meat preservative; nitrosamine risk"),
    (r"\b(aspartame|acesulfame ?k|acesulfame potassium|sucralose|saccharin|cyclamate)\b", "Artificial sweeteners", "weekly", "Mixed evidence on metabolic effects"),
    (r"\b(hfcs|high[- ]fructose corn syrup|glucose[- ]fructose syrup|fructose[- ]glucose syrup)\b", "HFCS/Glucose-Fructose syrup", "weekly", "Highly refined sugar source"),
    (r"\b(monosodium glutamate|msg|e6?21)\b", "MSG", "weekly", "Flavor enhancer; okay for most, sensitive individuals may react"),
    (r"\b(artificial (colour|color)s?|e1?(0[1-9]|1[0-9]|2[0-9]))\b", "Artificial colors", "weekly", "Synthetic dyes; caution for kids"),
    (r"\b(bht|bha|butylated hydroxyanisole|butylated hydroxytoluene)\b", "BHA/BHT", "occasional", "Synthetic antioxidants; controversy on safety"),
    (r"\b(propyl gallate)\b", "Propyl gallate", "occasional", "Synthetic antioxidant"),
    (r"\b(tbhq)\b", "TBHQ", "occasional", "Synthetic antioxidant; limit intake"),
    (r"\b(carrageenan)\b", "Carrageenan", "weekly", "Thickener; GI concerns in some"),
    (r"\b(polysorbate ?80|polysorbate ?60)\b", "Polysorbates", "weekly", "Emulsifier; gut concerns debated"),
]

def normalize_ingredients_text(text: str) -> List[str]:
    # Split on commas/semicolons, clean whitespace & lowercase
    parts = re.split(r"[;,]", text or "")
    cleaned = []
    for p in parts:
        s = p.strip().lower()
        if not s: 
            continue
        # remove brackets content to reduce noise
        s = re.sub(r"\(.*?\)", "", s).strip()
        cleaned.append(s)
    return cleaned

def flag_ingredients(ingredients_text: str) -> List[Dict[str, str]]:
    flags = []
    text = (ingredients_text or "").lower()
    for pat, label, consumption, reason in SEED_PATTERNS:
        if re.search(pat, text):
            flags.append({
                "label": label,
                "consumption": consumption,   # daily / weekly / occasional
                "reason": reason
            })
    # Deduplicate by label
    seen = set()
    deduped = []
    for f in flags:
        if f["label"] in seen: 
            continue
        seen.add(f["label"])
        deduped.append(f)
    return deduped

# ---------- Manual Input Fallback ----------
def manual_input() -> Tuple[Dict[str, float], str]:
    print("\n⚠️ Product not found or incomplete. Enter values manually per 100g:")
    energy_kj = float(input("Energy (kJ): ") or 0)
    sugars_g  = float(input("Sugars (g): ") or 0)
    sat_fat_g = float(input("Saturated Fat (g): ") or 0)
    sodium_mg = float(input("Sodium (mg): ") or 0)
    fruit_pct = float(input("Fruit/Vegetable/Nut %: ") or 0)
    fiber_g   = float(input("Fiber (g): ") or 0)
    protein_g = float(input("Protein (g): ") or 0)
    ingredients_text = input("Ingredients list (comma-separated): ") or ""
    nutrients = {
        "energy_kj": energy_kj, "sugars_g": sugars_g, "sat_fat_g": sat_fat_g,
        "sodium_mg": sodium_mg, "fruit_pct": fruit_pct, "fiber_g": fiber_g, "protein_g": protein_g
    }
    return nutrients, ingredients_text

# ---------- Verdict from score + flags ----------
def consumption_verdict(score: float, flags: List[Dict[str, str]], nutrient_warnings: List[str]) -> str:
    # Priority to flagged “occasional”
    if any(f["consumption"] == "occasional" for f in flags):
        return "Occasional only"
    # High sugar/sat fat/sodium pushes to weekly
    if nutrient_warnings or any(f["consumption"] == "weekly" for f in flags):
        return "Weekly consumable"
    # Otherwise depend on score
    if score >= 7.5:
        return "Daily consumable"
    elif score >= 5.0:
        return "Weekly consumable"
    return "Occasional only"

# ---------- Wrapper ----------
def score_from_barcode(barcode: str) -> Dict[str, Any]:
    prod = fetch_off_product(barcode)
    if not prod:
        nutrients, ing_text = manual_input()
        ns = nutri_score_full(**nutrients)
        health = custom_health_score(nutrients)
        flags = flag_ingredients(ing_text)
        warns = nutrition_warnings(nutrients)
        verdict = consumption_verdict(health, flags, warns)
        return {
            "barcode": barcode,
            "product_name": "Manual Entry",
            "nutri_score": ns,
            "nutrition_inputs": nutrients,
            "ingredients": {"ingredients_text": ing_text, "allergens": [], "additives": []},
            "custom_health_score": health,
            "ingredient_flags": flags,
            "nutrient_warnings": warns,
            "verdict": verdict
        }

    # Product found → extract
    energy_kj, sugars_g, sat_g, sodium_mg, fruit_pct, fiber_g, protein_g = extract_for_nutriscore(prod)
    nutrients = {
        "energy_kj": energy_kj, "sugars_g": sugars_g, "sat_fat_g": sat_g,
        "sodium_mg": sodium_mg, "fruit_pct": fruit_pct, "fiber_g": fiber_g, "protein_g": protein_g
    }
    ns = nutri_score_full(**nutrients)
    explain = ingredient_explainability(prod)
    health = custom_health_score(nutrients)
    flags = flag_ingredients(explain["ingredients_text"])
    warns = nutrition_warnings(nutrients)
    verdict = consumption_verdict(health, flags, warns)

    return {
        "barcode": barcode,
        "product_name": prod.get("product_name") or prod.get("generic_name") or "Unknown",
        "nutri_score": ns,
        "nutrition_inputs": nutrients,
        "ingredients": explain,
        "custom_health_score": health,
        "ingredient_flags": flags,
        "nutrient_warnings": warns,
        "verdict": verdict
    }

# ---------- Example Run ----------
if __name__ == "__main__":
    # Try a known EU barcode first; if missing, you'll be prompted for manual entry.
    code = input("Enter barcode (or press Enter to test manual): ").strip() or "0000000000000"
    result = score_from_barcode(code)

    print("\n--- Product Info ---")
    print(f"Barcode: {result['barcode']}")
    print(f"Product Name: {result['product_name']}")

    print("\n--- Scores ---")
    print(f"Custom Health Score: {result['custom_health_score']}/10")

    print("\n--- Nutrition Inputs ---")
    for k, v in result['nutrition_inputs'].items():
        print(f"{k}: {v}")

    print("\n--- Ingredient Flags ---")
    if result["ingredient_flags"]:
        for f in result["ingredient_flags"]:
            print(f"- {f['label']} → {f['consumption']} ({f['reason']})")
    else:
        print("None flagged")

    print("\n--- Nutrient Warnings ---")
    if result["nutrient_warnings"]:
        for w in result["nutrient_warnings"]:
            print(f"- {w}")
    else:
        print("No major warnings")

    print("\n--- Verdict ---")
    print(result["verdict"])

