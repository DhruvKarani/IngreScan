import wikipedia
import requests
from allergens import match_allergens
import pytesseract
from PIL import Image


def extract_text_from_image(image_path: str) -> str:
    """
    Uses OCR to extract text from an image file.
    Requires pytesseract and Pillow.
    """
    try:
        img = Image.open(image_path)
        text = pytesseract.image_to_string(img)
        return text
    except Exception as e:
        return f"OCR extraction failed: {e}"


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


# Wikipedia info fetcher for ingredient fallback


def fetch_wikipedia_summary(ingredient_name: str) -> str:
    """
    Fetches a summary for the ingredient from Wikipedia using the wikipedia library.
    Tries singular form if plural doesn't return a result.
    Handles any lettercase for the ingredient name.
    Loosened filter: accepts if ingredient name or any food keyword appears in summary.
    """
    key = ingredient_name.lower().strip()
    queries_to_try = [ingredient_name, ingredient_name.lower(
    ), ingredient_name.capitalize(), ingredient_name.title()]

    def is_food_summary(text, ingredient):
        # Stricter filter: require ingredient name or food keywords, and reject common non-food topics
        food_keywords = [
            "food", "ingredient", "edible", "cooking", "cuisine", "culinary", "consumed", "nutrition",
            "vegetable", "fruit", "spice", "herb", "dairy", "meat", "grain", "legume", "nut",
            "flavor", "seasoning", "used in cooking", "used as food"
        ]
        negative_keywords = [
            "board game", "game", "video game", "software", "building", "floor", "storey",
            "band", "album", "company", "corporation", "film", "movie", "tv series"
        ]
        text_lower = text.lower()
        ingredient_lower = ingredient.lower()
        if any(nk in text_lower for nk in negative_keywords):
            return False
        return ingredient_lower in text_lower or any(word in text_lower for word in food_keywords)

    # Bias queries toward food context to avoid disambiguation like Cheese/Chess, Flour/Floor
    contextual_queries = []
    base = ingredient_name.strip()
    contextual_queries.extend([
        f"{base} (food)", f"{base} (ingredient)", f"{base} food", f"{base} ingredient"
    ])
    queries_to_try = contextual_queries + queries_to_try

    for q in queries_to_try:
        try:
            summary = wikipedia.summary(
                q, sentences=6, auto_suggest=True, redirect=True)
            if is_food_summary(summary, q):
                return summary
        except wikipedia.DisambiguationError as e:
            # Prefer options with food context first
            preferred = [opt for opt in e.options if any(k in opt.lower() for k in ["food", "ingredient"])]
            rest = [opt for opt in e.options if opt not in preferred]
            for option in preferred + rest:
                try:
                    summary = wikipedia.summary(
                        option, sentences=6, auto_suggest=True, redirect=True)
                    if is_food_summary(summary, option):
                        return summary
                except Exception:
                    continue
        except wikipedia.PageError:
            continue
        except Exception:
            continue
    # Try singular form if plural fails
    if key.endswith('s'):
        singular = key[:-1]
        singular_queries = [singular, singular.lower(
        ), singular.capitalize(), singular.title()]
        # Add food-biased variants for singular too
        singular_contextual = [f"{singular} (food)", f"{singular} (ingredient)", f"{singular} food", f"{singular} ingredient"]
        for sq in singular_contextual + singular_queries:
            try:
                summary = wikipedia.summary(
                    sq, sentences=6, auto_suggest=True, redirect=True)
                if is_food_summary(summary, sq):
                    return summary
            except Exception:
                continue
    return "No Wikipedia food info available for this ingredient."


def fetch_off_ingredient_info(ingredient_name: str) -> dict:
    """
    Fetch ingredient information from Open Food Facts ingredient endpoint.
    Tries multiple slug variants and singular form. Returns a dict with keys:
    - description: best human-readable description if available
    - wikipedia: wikipedia page title or url if available
    """
    def to_slug(name: str) -> str:
        return name.strip().lower().replace(" ", "-")

    def to_singular(name: str) -> str:
        key = name.strip().lower()
        if key.endswith("es") and not key.endswith("ses"):
            return key[:-2]
        if key.endswith("s") and not key.endswith("ss"):
            return key[:-1]
        return key

    candidates = []
    # original
    candidates.append(ingredient_name)
    # singular
    candidates.append(to_singular(ingredient_name))
    # common casing variants
    candidates.extend([
        ingredient_name.lower(),
        ingredient_name.title(),
        ingredient_name.capitalize(),
    ])

    seen = set()
    for cand in candidates:
        slug = to_slug(cand)
        if slug in seen:
            continue
        seen.add(slug)
        url = f"https://world.openfoodfacts.org/ingredient/{slug}.json"
        try:
            resp = requests.get(url, timeout=5)
            if resp.status_code != 200:
                continue
            data = resp.json() or {}
            # OFF returns fields per language under keys like 'name', 'wikidata', 'wiki', 'description'
            description = None
            # Try direct description
            raw_desc = data.get("description") or data.get("text")
            if isinstance(raw_desc, dict):
                # prefer English if present, else first value
                description = raw_desc.get("en") or next(iter(raw_desc.values()), None)
            elif isinstance(raw_desc, str):
                description = raw_desc

            # Some entries keep summary under "wikidata"/"wikipedia" fields
            wikipedia_field = None
            wiki_obj = data.get("wikipedia") or data.get("wiki")
            if isinstance(wiki_obj, dict):
                wikipedia_field = wiki_obj.get("en") or next(iter(wiki_obj.values()), None)
            elif isinstance(wiki_obj, str):
                wikipedia_field = wiki_obj

            # If still no description, try short name variants
            if not description:
                name_obj = data.get("name")
                if isinstance(name_obj, dict):
                    description = name_obj.get("en") or next(iter(name_obj.values()), None)
                elif isinstance(name_obj, str):
                    description = name_obj

            if description or wikipedia_field:
                return {
                    "description": description,
                    "wikipedia": wikipedia_field,
                }
        except Exception:
            continue
    return {"description": None, "wikipedia": None}

