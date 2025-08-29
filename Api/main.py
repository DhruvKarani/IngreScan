import logging
from fastapi import FastAPI, HTTPException
import requests
from fastapi import Query
from typing import List
from fastapi import UploadFile, File, Form, Query, Body
from db import fetch_from_local_db
from utils import tag_ingredient_safety, calculate_health_score, suggest_alternatives, normalize_ingredient_name
from allergens import match_allergens, get_allergen_info
from models import Ingredient, ProductResponse
from pydantic import BaseModel
# Request model for /scan/ingredients


class ScanIngredientsRequest(BaseModel):
    ingredients: list[str]
    product_name: str = "Manual Entry"
    user_allergens: list[str] = None


def fetch_from_openfoodfacts(barcode: str):
    url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
    try:
        resp = requests.get(url, timeout=5)
        if resp.status_code != 200:
            logging.warning(f"OFF API error for {barcode}: {resp.status_code}")
            return None
        data = resp.json()
        if data.get("status") != 1:
            logging.info(f"OFF: Product {barcode} not found.")
            return None
        product = data["product"]
        name = product.get("product_name", "Unknown Product")
        ingredients = []
        for i in product.get("ingredients", []):
            ing_name = i.get("text", "Unknown")
            ing_type = i.get("vegetarian", None)
            safety, reason = tag_ingredient_safety(ing_name)
            common_name, description = normalize_ingredient_name(ing_name)
            ingredients.append(Ingredient(
                name=ing_name,
                type=ing_type,
                safety=safety,
                reason=reason,
                common_name=common_name,
                description=description
            ))
        nutrients = {k: str(v)
                     for k, v in product.get("nutriments", {}).items()}
        allergens = product.get("allergens_tags", [])
        health_score = calculate_health_score(
            ingredients, allergens, nutrients)
        rating = "Safe" if health_score >= 8 else (
            "Moderate" if health_score >= 5 else "Harmful")
        alternatives = suggest_alternatives(
            name) if rating == "Harmful" else []
        return ProductResponse(
            barcode=barcode,
            product_name=name,
            ingredients=ingredients,
            nutrients=nutrients,
            allergens=allergens,
            health_score=health_score,
            rating=rating,
            source="openfoodfacts",
            status="found_off",
            alternatives=alternatives
        )
    except Exception as e:
        logging.error(f"Error fetching from OFF: {e}")
        return None


# Now using Firebase Firestore for DB lookups

app = FastAPI()


@app.post("/scan/ingredients", response_model=ProductResponse)
def scan_ingredients(request: ScanIngredientsRequest = Body(...)):
    tagged_ingredients = []
    off_cache = {}
    all_off_allergens = set()
    for ing_name in request.ingredients:
        ing_key = ing_name.lower().strip()
        safety, reason = tag_ingredient_safety(ing_name)
        common_name, description = normalize_ingredient_name(ing_name)
        allergen_info = get_allergen_info(ing_name)
        # Query Open Food Facts for allergen tags for this ingredient (cache per request)
        if ing_key in off_cache:
            off_allergens = off_cache[ing_key]
        else:
            off_url = f"https://world.openfoodfacts.org/cgi/search.pl?search_terms={ing_name}&search_simple=1&action=process&json=1&page_size=1"
            off_allergens = []
            try:
                resp = requests.get(off_url, timeout=5)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("products"):
                        product = data["products"][0]
                        off_allergens = product.get("allergens_tags", [])
            except Exception:
                pass
            off_cache[ing_key] = off_allergens
        if off_allergens:
            description = (description + "\n" if description else "") + \
                f"OpenFoodFacts Allergens: {', '.join(off_allergens)}"
            # Collect normalized allergen tags for warning logic
            all_off_allergens.update(
                [tag.lower().replace('en:', '') for tag in off_allergens])
        # Add allergen info to description if available
        if allergen_info:
            description = (description + "\n" if description else "") + \
                f"Allergen: {allergen_info['allergen']}. Info: {allergen_info['info']}"
        tagged_ingredients.append(Ingredient(
            name=ing_name,
            safety=safety,
            reason=reason,
            common_name=common_name,
            description=description
        ))
    nutrients = {}
    allergens = []
    allergen_warning = None
    if request.user_allergens:
        ingredient_names = [i.name for i in tagged_ingredients] + \
            [i.common_name for i in tagged_ingredients if i.common_name]
        matched_custom = set(match_allergens(
            ingredient_names, request.user_allergens))
        user_allergens_lower = set([a.lower() for a in request.user_allergens])
        matched_off = user_allergens_lower & all_off_allergens
        matched = matched_custom | matched_off
        if matched:
            allergen_warning = f"Warning: Product contains your allergens: {', '.join(matched)}"
    health_score = calculate_health_score(
        tagged_ingredients, allergens, nutrients)
    rating = "Safe" if health_score >= 8 else (
        "Moderate" if health_score >= 5 else "Harmful")
    alternatives = suggest_alternatives(
        request.product_name) if rating == "Harmful" else []
    return ProductResponse(
        barcode="manual",
        product_name=request.product_name,
        ingredients=tagged_ingredients,
        nutrients=nutrients,
        allergens=allergens,
        health_score=health_score,
        rating=rating,
        source="manual_entry",
        status="manual_entry",
        alternatives=alternatives,
        allergen_warning=allergen_warning
    )


@app.post("/scan/image", response_model=ProductResponse)
async def scan_image(file: UploadFile = File(...), user_allergens: List[str] = Form(None)):
    dummy_ingredients = ["Milk", "Salt"]
    tagged_ingredients = []
    for ing_name in dummy_ingredients:
        safety, reason = tag_ingredient_safety(ing_name)
        common_name, description = normalize_ingredient_name(ing_name)
        tagged_ingredients.append(Ingredient(
            name=ing_name,
            safety=safety,
            reason=reason,
            common_name=common_name,
            description=description
        ))
    nutrients = {}
    allergens = []
    # Allergen synonyms matching
    if user_allergens:
        ingredient_names = [i.name for i in tagged_ingredients] + \
            [i.common_name for i in tagged_ingredients if i.common_name]
        matched = match_allergens(ingredient_names, user_allergens)
        if matched:
            allergen_warning = f"Warning: Product contains your allergens: {', '.join(matched)}"
        else:
            allergen_warning = None
    else:
        allergen_warning = None
    health_score = calculate_health_score(
        tagged_ingredients, allergens, nutrients)
    rating = "Safe" if health_score >= 8 else (
        "Moderate" if health_score >= 5 else "Harmful")
    alternatives = suggest_alternatives(
        "Image Upload") if rating == "Harmful" else []
    return ProductResponse(
        barcode="image_upload",
        product_name="Image Upload",
        ingredients=tagged_ingredients,
        nutrients=nutrients,
        allergens=allergens,
        health_score=health_score,
        rating=rating,
        source="image_upload",
        status="image_upload",
        alternatives=alternatives,
        allergen_warning=allergen_warning
    )


@app.get("/scan/barcode/{barcode}", response_model=ProductResponse)
@app.get("/scan/barcode/{barcode}", response_model=ProductResponse)
def scan_barcode(barcode: str, user_allergens: List[str] = Query(None)):
    # 1. Try OpenFoodFacts
    result = fetch_from_openfoodfacts(barcode)
    if result:
        result.status = "found_off"
        allergen_warning = None
        if user_allergens:
            ingredient_names = [i.name for i in result.ingredients] + \
                [i.common_name for i in result.ingredients if i.common_name]
            # Custom allergen matching
            matched_custom = match_allergens(ingredient_names, user_allergens)
            # Open Food Facts allergen tags
            off_tags = set([tag.lower().replace('en:', '')
                           for tag in result.allergens])
            user_allergens_lower = set([a.lower() for a in user_allergens])
            matched_off = user_allergens_lower & off_tags
            matched = set(matched_custom) | matched_off
            if matched:
                allergen_warning = f"Warning: Product contains your allergens: {', '.join(matched)}"
        result.allergen_warning = allergen_warning
        return result
    # 2. Try Firebase DB
    result = fetch_from_local_db(barcode)
    if result:
        result.status = "found_firebase"
        allergen_warning = None
        if user_allergens:
            ingredient_names = [i.name for i in result.ingredients] + \
                [i.common_name for i in result.ingredients if i.common_name]
            matched = match_allergens(ingredient_names, user_allergens)
            if matched:
                allergen_warning = f"Warning: Product contains your allergens: {', '.join(matched)}"
        result.allergen_warning = allergen_warning
        return result
    # 3. Not found
    logging.info(f"Product {barcode} not found in OFF or Firebase DB.")
    raise HTTPException(
        status_code=404,
        detail=(
            f"Product {barcode} not found in OpenFoodFacts or Firebase DB. "
            "You can manually enter the ingredients or upload an image of the ingredients for analysis."
        )
    )
