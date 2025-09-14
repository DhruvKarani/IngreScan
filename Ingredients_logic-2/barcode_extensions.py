"""barcode_extensions.py

Non-intrusive extensions for ingrescan_barcode2.
Keeps the original file untouched. Import this module for advanced features.

Features implemented (chosen 2 core enhancements):
1. Product fetch caching (reduces repeated API calls)
2. Advanced report generator with: macro distribution + improvement suggestions

Optional extras also included (diet heuristic + JSON export) but isolated.
"""
from __future__ import annotations
import time
import json
import requests
from collections import OrderedDict
from typing import Dict, Any, Optional, List

# Import the original module to leverage existing scoring / flagging logic
import ingrescan_barcode2 as base

# ------------------ CACHING (Feature 1) ------------------
class _LRUCache:
    def __init__(self, maxsize: int = 32, ttl_seconds: int = 300):
        self.maxsize = maxsize
        self.ttl = ttl_seconds
        self._store: OrderedDict[str, tuple[float, dict]] = OrderedDict()

    def get(self, key: str) -> Optional[dict]:
        now = time.time()
        if key in self._store:
            ts, val = self._store[key]
            if now - ts < self.ttl:
                self._store.move_to_end(key)
                return val
            else:
                del self._store[key]
        return None

    def set(self, key: str, value: dict) -> None:
        if key in self._store:
            self._store.move_to_end(key)
        self._store[key] = (time.time(), value)
        if len(self._store) > self.maxsize:
            self._store.popitem(last=False)

_cache = _LRUCache()

API_BASE = "https://world.openfoodfacts.org/api/v0/product/{barcode}.json"

def fetch_product(barcode: str) -> Optional[dict]:
    """Fetch product JSON with caching and graceful failure."""
    cached = _cache.get(barcode)
    if cached is not None:
        return cached
    try:
        resp = requests.get(API_BASE.format(barcode=barcode), timeout=8)
        data = resp.json()
        if data.get("status") == 1:
            prod = data.get("product", {})
            _cache.set(barcode, prod)
            return prod
        return None
    except Exception:
        return None

# ------------------ MACRO DISTRIBUTION + SUGGESTIONS (Feature 2) ------------------
_DEFICITS = {"fiber_100g": 3, "proteins_100g": 5}

def macro_distribution(nutrients: dict) -> dict:
    """Return percentage distribution among sugar / protein / sat fat grams."""
    sugar = nutrients.get("sugars_100g", 0) or 0
    protein = nutrients.get("proteins_100g", 0) or 0
    sat = nutrients.get("saturated-fat_100g", 0) or 0
    total = sugar + protein + sat
    if total <= 0:
        return {"sugar_pct": 0, "protein_pct": 0, "sat_fat_pct": 0}
    return {
        "sugar_pct": round(sugar / total * 100, 1),
        "protein_pct": round(protein / total * 100, 1),
        "sat_fat_pct": round(sat / total * 100, 1)
    }

def generate_suggestions(nutrients: dict, warnings: List[str]) -> List[str]:
    """Provide actionable improvement tips based on nutrient profile."""
    suggestions: List[str] = []
    sugars = nutrients.get("sugars_100g", 0) or 0
    sat = nutrients.get("saturated-fat_100g", 0) or 0
    fiber = nutrients.get("fiber_100g", 0) or 0
    protein = nutrients.get("proteins_100g", 0) or 0

    if sugars > 20:
        suggestions.append("Consider a lower-sugar alternative or reduce portion size.")
    if sat > 8:
        suggestions.append("High saturated fat: choose options with more unsaturated fats.")
    if fiber < _DEFICITS["fiber_100g"]:
        suggestions.append("Increase fiber intake: prefer whole grain / higher fiber products.")
    if protein < _DEFICITS["proteins_100g"]:
        suggestions.append("Add a protein source to balance this product.")

    if not suggestions and not warnings:
        suggestions.append("No major concerns detected. Suitable within a balanced diet.")
    return suggestions

# ------------------ OPTIONAL DIET HEURISTIC ------------------
_ANIMAL_TERMS = ["milk", "egg", "honey", "gelatin", "fish", "pork", "beef", "chicken", "lard", "cheese", "butter", "casein", "whey"]
_PLANT_MARKERS = ["soy", "pea", "lentil", "bean", "almond", "oat", "coconut", "rice", "plant"]

def classify_diet(ingredients: List[str]) -> dict:
    lower = [i.lower() for i in ingredients]
    animal_hits = [t for t in _ANIMAL_TERMS if any(t in ing for ing in lower)]
    plant_hits = [t for t in _PLANT_MARKERS if any(t in ing for ing in lower)]
    if animal_hits:
        vegetarian = not any(x in animal_hits for x in ["gelatin", "fish", "pork", "beef", "chicken", "lard"])
        return {"vegan": False, "vegetarian": vegetarian, "evidence": animal_hits}
    return {"vegan": True, "vegetarian": True, "evidence": plant_hits}

# ------------------ ADVANCED REPORT ------------------

def advanced_report(barcode: str, include_raw: bool = False, profile: Optional[dict] = None) -> dict:
    """Produce an enriched report without altering original module behavior."""
    prod = fetch_product(barcode)
    if not prod:
        return {"error": "Product not found"}

    nutrients = prod.get("nutriments", {})
    # Re-use existing scoring + warnings
    score = base.health_score(nutrients)
    tier = base.get_tier(score)
    warnings = base.check_flags(prod, profile or base.user_profile)

    ingredients_objs = prod.get("ingredients", [])
    ingredient_texts = [i.get("text", "") for i in ingredients_objs if i.get("text")]
    diet = classify_diet(ingredient_texts)
    macros = macro_distribution(nutrients)
    sugg = generate_suggestions(nutrients, warnings)

    report = {
        "barcode": barcode,
        "product_name": prod.get("product_name") or prod.get("generic_name") or "Unknown",
        "score": score,
        "tier": tier,
        "warnings": warnings,
        "macros": macros,
        "diet": diet,
        "suggestions": sugg,
        "nutrients_used": {
            "sugars_100g": nutrients.get("sugars_100g"),
            "saturated-fat_100g": nutrients.get("saturated-fat_100g"),
            "fiber_100g": nutrients.get("fiber_100g"),
            "proteins_100g": nutrients.get("proteins_100g"),
        }
    }
    if include_raw:
        report["_raw_product"] = prod
    return report

# ------------------ PRETTY PRINT + EXPORT ------------------
_DEF_ICON = {True: "✅", False: "❌"}

def print_report(rep: dict) -> None:
    if "error" in rep:
        print("ERROR:", rep["error"])
        return
    print("\n=== ADVANCED REPORT ===")
    print(f"Name: {rep['product_name']}")
    print(f"Barcode: {rep['barcode']}")
    print(f"Score: {rep['score']} (Tier: {rep['tier']})")
    diet = rep['diet']
    print(f"Vegan: {_DEF_ICON[diet['vegan']]} | Vegetarian: {_DEF_ICON[diet['vegetarian']]} | Evidence: {', '.join(diet['evidence']) if diet['evidence'] else 'None'}")
    m = rep['macros']
    print(f"Macros % (sugar/protein/sat_fat): {m['sugar_pct']} / {m['protein_pct']} / {m['sat_fat_pct']}")
    if rep['warnings']:
        print("Warnings:")
        for w in rep['warnings']:
            print(f"  - {w}")
    else:
        print("Warnings: None")
    print("Suggestions:")
    for s in rep['suggestions']:
        print(f"  • {s}")
    print("=======================\n")

def export_report(rep: dict, path: str) -> bool:
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(rep, f, indent=2, ensure_ascii=False)
        return True
    except Exception:
        return False

# ------------------ CLI HOOK (Optional) ------------------
if __name__ == "__main__":
    code = input("Enter barcode for advanced report: ")
    r = advanced_report(code)
    print_report(r)
