from allergens import match_allergens
INGREDIENT_SYNONYMS = {
    "monosodium glutamate": {"common": "Ajinomoto (MSG)", "desc": "A flavor enhancer, also called MSG."},
    "ins 330": {"common": "Citric Acid", "desc": "A common food acidulant."},
    "e-150d": {"common": "Caramel Color", "desc": "A coloring agent used in colas and sauces."},
    "sodium chloride": {"common": "Salt", "desc": "Table salt."},
    "saccharose": {"common": "Sugar", "desc": "Table sugar."},
    "ajinomoto": {"common": "Ajinomoto (MSG)", "desc": "A brand name for MSG."}
}


def normalize_ingredient_name(name: str) -> tuple[str, str]:
    """
    Returns (common_name, description) for a given ingredient name.
    If not found, returns (original name, "").
    """
    key = name.lower().strip()
    if key in INGREDIENT_SYNONYMS:
        return INGREDIENT_SYNONYMS[key]["common"], INGREDIENT_SYNONYMS[key]["desc"]
    return name, ""


HARMFUL_INGREDIENTS = {
    "monosodium glutamate": "Linked to headaches and allergies in some people.",
    "ins 330": "Citric acid, safe in moderation.",
    "e-150d": "Caramel color, may be harmful in large amounts.",
    "preservative": "May be harmful if consumed regularly.",
    "emulsifier": "Some emulsifiers linked to gut issues.",
    "ajinomoto": "Another name for MSG, may cause reactions."
}

SAFE_INGREDIENTS = ["milk", "salt", "water", "sugar", "wheat", "rice"]


def tag_ingredient_safety(ingredient_name: str) -> tuple[str, str]:
    name_lower = ingredient_name.lower()
    for harmful, reason in HARMFUL_INGREDIENTS.items():
        if harmful in name_lower:
            return "harmful", reason
    if name_lower in SAFE_INGREDIENTS:
        return "safe", "Common food ingredient."
    return "moderate", "No specific safety info."


def calculate_health_score(ingredients, allergens, nutrients) -> int:
    score = 10
    for ing in ingredients:
        if ing.safety == "harmful":
            score -= 3
        elif ing.safety == "moderate":
            score -= 1
    if allergens:
        score -= 2
    fat = nutrients.get("fat")
    salt = nutrients.get("salt")
    if fat and "80g" in fat:
        score -= 2
    if salt and "2g" in salt:
        score -= 1
    return max(score, 0)


def suggest_alternatives(product_name: str) -> list[str]:
    if "butter" in product_name.lower():
        return ["Amul Lite Butter", "Nutralite Table Spread", "Ghee"]
    return []
