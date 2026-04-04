import logging
import os
import sys
from typing import Any, Dict, List, Optional, Tuple

ROOT = os.path.dirname(os.path.dirname(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

try:
    import scoring_engine as engine
except Exception as exc:
    raise RuntimeError(f"Failed to import scoring_engine: {exc}")

try:
    from unified_scoring import calculate_unified_score
    ML_AVAILABLE = True
    logging.info("ML-enhanced scoring system loaded")
except Exception as exc:
    ML_AVAILABLE = False
    logging.warning("ML scoring not available, falling back to legacy: %s", exc)

try:
    from ml_engine import ml_analyze_product
    from personalized_scoring import calculate_personalized_score
    PERSONALIZED_SCORING_AVAILABLE = True
    logging.info("Personalized scoring system loaded (0-100 scale)")
except Exception as exc:
    PERSONALIZED_SCORING_AVAILABLE = False
    logging.warning("Personalized scoring not available: %s", exc)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _apply_user_profile(user_profile: Optional[Dict[str, Any]]) -> None:
    profile = user_profile or {}

    try:
        allergies = profile.get("allergies") or profile.get("allergens") or []
        conditions = profile.get("conditions") or profile.get("healthConditions") or []

        engine.USER_PROFILE["allergies"] = [str(item).lower() for item in allergies]
        engine.USER_PROFILE["conditions"] = [str(item).lower() for item in conditions]
    except Exception:
        engine.USER_PROFILE["allergies"] = []
        engine.USER_PROFILE["conditions"] = []


def analyze_legacy_product(payload: Dict[str, Any]) -> Dict[str, Any]:
    barcode = payload.get("barcode")
    user_profile = payload.get("userProfile") or {}

    if not barcode:
        raise ValueError("barcode required")

    _apply_user_profile(user_profile)

    product, ingredients_text, nutrients = engine.robust_fetch_from_openfoodfacts(barcode)
    if not product:
        raise LookupError("product_not_found")

    try:
        result = engine.analyze_product_engine(product, ingredients_text or "", nutrients or {})
        ingredients, additives = engine.extract_ingredients_and_additives(product, ingredients_text or "")
        result["ingredients"] = ingredients
        result["additives"] = additives
        return result
    except Exception as exc:
        logger.exception("Scoring failed")
        raise RuntimeError(str(exc)) from exc


def calculate_ml_score_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not ML_AVAILABLE:
        raise RuntimeError("ML scoring not available")

    product_data = payload.get("product")
    user_profile = payload.get("userProfile") or payload.get("user_profile") or {}

    if not product_data:
        raise ValueError("product data required")

    try:
        return calculate_unified_score(product_data, user_profile)
    except Exception as exc:
        logger.exception("ML scoring failed")
        raise RuntimeError(str(exc)) from exc


def calculate_personalized_score_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not PERSONALIZED_SCORING_AVAILABLE:
        raise RuntimeError("Personalized scoring not available")

    product_data = payload.get("product")
    user_profile = payload.get("userProfile") or payload.get("user_profile") or {"conditions": [], "allergies": []}

    if not product_data:
        raise ValueError("product data required")

    try:
        ml_results = ml_analyze_product(product_data)

        nutrients = product_data.get("nutriments", {}) or product_data.get("nutritional_info", {})

        ingredients_raw = product_data.get("ingredients_text", "") or product_data.get("ingredients", "")
        if isinstance(ingredients_raw, list):
            ingredients_list = [ing.strip() for ing in ingredients_raw if str(ing).strip()]
        elif isinstance(ingredients_raw, str) and ingredients_raw:
            ingredients_list = [ing.strip() for ing in ingredients_raw.split(",") if ing.strip()]
        else:
            ingredients_list = None

        result = calculate_personalized_score(
            ml_results,
            nutrients,
            ingredients_list,
            user_profile,
        )

        result["product_name"] = product_data.get("product_name", "Unknown")
        result["barcode"] = product_data.get("code", "")
        result["label"] = result.get("score_label", result.get("label", ""))
        result["color"] = result.get("score_color", result.get("color", ""))

        return result
    except Exception as exc:
        logger.exception("Personalized scoring failed")
        raise RuntimeError(str(exc)) from exc


def get_scoring_health() -> Dict[str, Any]:
    return {
        "ml_available": ML_AVAILABLE,
        "personalized_scoring_available": PERSONALIZED_SCORING_AVAILABLE,
        "version": "3.0-personalized-scoring",
        "endpoints": {
            "/analyze": "Legacy scoring (0-10 scale)",
            "/ml-score": "ML-enhanced scoring",
            "/personalized-score": "Personalized scoring (0-100 scale with user profiles)",
        },
    }