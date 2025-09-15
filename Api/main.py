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
    # Try v2 product endpoint first with locale/country and limited fields
    try:
        headers = {"User-Agent": "Mozilla/5.0 (+ingredient-analyzer)"}
        fields = (
            "product_name,product_name_en,generic_name,generic_name_en,"
            "ingredients_text,ingredients_text_en,ingredients,"
            "nutriments,allergens_tags,brands,categories,categories_en"
        )
        v2p = requests.get(
            f"https://world.openfoodfacts.org/api/v2/product/{barcode}",
            params={"lc": "en", "cc": "in", "fields": fields},
            headers=headers,
            timeout=5,
        )
        if v2p.status_code == 200:
            vd = v2p.json() or {}
            vp = vd.get("product")
            if vp:
                name = (
                    vp.get("product_name") or vp.get("product_name_en")
                    or vp.get("generic_name_en") or vp.get("generic_name")
                    or vp.get("brands") or "Unknown Product"
                )
                ingredients = []
                raw = vp.get("ingredients", [])
                if raw:
                    for i in raw:
                        ing_name = i.get("text", "Unknown")
                        safety, reason = tag_ingredient_safety(ing_name)
                        common_name, description = normalize_ingredient_name(ing_name)
                        ingredients.append(Ingredient(
                            name=ing_name,
                            safety=safety,
                            reason=reason,
                            common_name=common_name,
                            description=description
                        ))
                else:
                    ingredients_text = (
                        vp.get("ingredients_text_en") or vp.get("ingredients_text")
                    )
                    if ingredients_text:
                        import re
                        tokens = [t.strip() for t in re.split(r"[;,]", ingredients_text) if t.strip()]
                        for token in tokens:
                            safety, reason = tag_ingredient_safety(token)
                            common_name, description = normalize_ingredient_name(token)
                            ingredients.append(Ingredient(
                                name=token,
                                safety=safety,
                                reason=reason,
                                common_name=common_name,
                                description=description
                            ))
                nutrients = {k: str(v) for k, v in (vp.get("nutriments") or {}).items()}
                allergens = vp.get("allergens_tags", []) or vp.get("allergens", [])
                health_score = calculate_health_score(ingredients, allergens, nutrients)
                rating = "Safe" if health_score >= 8 else ("Moderate" if health_score >= 5 else "Harmful")
                alternatives = suggest_alternatives(name) if rating == "Harmful" else []
                status_val = "partial_off" if (not ingredients and not nutrients and not allergens) else "found_off"
                return ProductResponse(
                    barcode=barcode,
                    product_name=name,
                    ingredients=ingredients,
                    nutrients=nutrients,
                    allergens=allergens,
                    health_score=health_score,
                    rating=rating,
                    source="openfoodfacts",
                    status=status_val,
                    alternatives=alternatives
                )
    except Exception:
        pass

    # Try world and a few regional endpoints
    hosts = [
        "https://world.openfoodfacts.org",
        "https://in.openfoodfacts.org",
        "https://fr.openfoodfacts.org",
    ]
    data = None
    try:
        for host in hosts:
            try:
                resp = requests.get(f"{host}/api/v0/product/{barcode}.json", timeout=5)
                if resp.status_code == 200:
                    d = resp.json() or {}
                    if d.get("status") == 1:
                        data = d
                        break
            except Exception:
                continue
        if not data:
            logging.info(f"OFF: Product {barcode} not found on product endpoint. Trying search fallback.")
            # v2 product
            try:
                v2p = requests.get(f"https://world.openfoodfacts.org/api/v2/product/{barcode}", timeout=5)
                if v2p.status_code == 200:
                    vd = v2p.json() or {}
                    if vd.get("product"):
                        data = {"product": vd["product"], "status": 1}
            except Exception:
                pass
            # v1 search by code
            if not data:
                try:
                    sresp = requests.get(f"https://world.openfoodfacts.org/cgi/search.pl?search_terms={barcode}&search_simple=1&action=process&json=1&page_size=10", timeout=5)
                    if sresp.status_code == 200:
                        sdata = sresp.json() or {}
                        products = sdata.get("products") or []
                        products.sort(key=lambda p: (0 if (str(p.get('code') or '') == str(barcode)) else 1))
                        if products:
                            data = {"product": products[0], "status": 1}
                except Exception:
                    pass
            # v2 search by code
            if not data:
                try:
                    # Try both code and codes query params
                    v2s = requests.get(f"https://world.openfoodfacts.org/api/v2/search?code={barcode}&page_size=5", timeout=5)
                    if v2s.status_code == 200:
                        v2d = v2s.json() or {}
                        v2products = v2d.get("products") or []
                        if v2products:
                            data = {"product": v2products[0], "status": 1}
                    if not data:
                        v2s2 = requests.get(f"https://world.openfoodfacts.org/api/v2/search?codes={barcode}&page_size=5", timeout=5)
                        if v2s2.status_code == 200:
                            v2d2 = v2s2.json() or {}
                            v2products2 = v2d2.get("products") or []
                            if v2products2:
                                data = {"product": v2products2[0], "status": 1}
                except Exception:
                    pass
        if not data:
            # Last resort: fetch the HTML page to derive a name, then search by that name
            try:
                headers = {"User-Agent": "Mozilla/5.0 (+OFF-helper)"}
                html_resp = requests.get(f"https://world.openfoodfacts.org/product/{barcode}", timeout=8, headers=headers)
                if html_resp.status_code == 200 and html_resp.text:
                    import re as _re
                    html = html_resp.text
                    # Try to extract the product title from <title> or main heading
                    m_og = _re.search(r"<meta[^>]+property=['\"]og:title['\"][^>]+content=['\"](.*?)['\"]", html, flags=_re.IGNORECASE)
                    m = _re.search(r"<title>\\s*(.*?)\\s*</title>", html, flags=_re.IGNORECASE|_re.DOTALL)
                    fallback_name = None
                    if m_og:
                        fallback_name = m_og.group(1).strip()
                    elif m:
                        # Clean title: remove trailing ' - Open Food Facts' if present
                        t = _re.sub(r"\\s*-\\s*Open Food Facts.*$", "", m.group(1)).strip()
                        fallback_name = t
                    if not fallback_name:
                        m2 = _re.search(r"<h1[^>]*>\\s*(.*?)\\s*</h1>", html, flags=_re.IGNORECASE|_re.DOTALL)
                        if m2:
                            fallback_name = _re.sub(r"<[^>]+>", "", m2.group(1)).strip()
                    if fallback_name:
                        try:
                            import urllib.parse as _urllib_parse
                            name_q = _urllib_parse.quote_plus(fallback_name)
                            name_url = f"https://world.openfoodfacts.org/cgi/search.pl?search_terms={name_q}&search_simple=1&action=process&json=1&page_size=10"
                            nresp2 = requests.get(name_url, timeout=5)
                            if nresp2.status_code == 200:
                                ndata2 = nresp2.json() or {}
                                nproducts2 = ndata2.get("products") or []
                                # Build from the first product that has data
                                for np2 in nproducts2:
                                    ingredients = []
                                    raw = np2.get("ingredients", [])
                                    if raw:
                                        for i in raw:
                                            ing_name = i.get("text", "Unknown")
                                            safety, reason = tag_ingredient_safety(ing_name)
                                            common_name, description = normalize_ingredient_name(ing_name)
                                            ingredients.append(Ingredient(
                                                name=ing_name,
                                                safety=safety,
                                                reason=reason,
                                                common_name=common_name,
                                                description=description
                                            ))
                                    else:
                                        ingredients_text = (
                                            np2.get("ingredients_text_en") or np2.get("ingredients_text")
                                        )
                                        if ingredients_text:
                                            import re
                                            tokens = [t.strip() for t in re.split(r"[;,]", ingredients_text) if t.strip()]
                                            for token in tokens:
                                                safety, reason = tag_ingredient_safety(token)
                                                common_name, description = normalize_ingredient_name(token)
                                                ingredients.append(Ingredient(
                                                    name=token,
                                                    safety=safety,
                                                    reason=reason,
                                                    common_name=common_name,
                                                    description=description
                                                ))
                                    nutrients = {k: str(v) for k, v in (np2.get("nutriments") or {}).items()}
                                    allergens = np2.get("allergens_tags", []) or np2.get("allergens", [])
                                    if ingredients or nutrients or allergens:
                                        final_name = (
                                            np2.get("product_name") or np2.get("product_name_en")
                                            or np2.get("generic_name_en") or np2.get("generic_name")
                                            or fallback_name
                                        )
                                        health_score = calculate_health_score(ingredients, allergens, nutrients)
                                        rating = "Safe" if health_score >= 8 else ("Moderate" if health_score >= 5 else "Harmful")
                                        alternatives = suggest_alternatives(final_name) if rating == "Harmful" else []
                                        return ProductResponse(
                                            barcode=barcode,
                                            product_name=final_name,
                                            ingredients=ingredients,
                                            nutrients=nutrients,
                                            allergens=allergens,
                                            health_score=health_score,
                                            rating=rating,
                                            source="openfoodfacts",
                                            status="partial_off",
                                            alternatives=alternatives
                                        )
                        except Exception:
                            pass
                    # If we only have a name, return minimal response
                    if fallback_name:
                        return ProductResponse(
                            barcode=barcode,
                            product_name=fallback_name,
                            ingredients=[],
                            nutrients={},
                            allergens=[],
                            health_score=10,
                            rating="Safe",
                            source="openfoodfacts",
                            status="name_only_off",
                            alternatives=[]
                        )
            except Exception:
                pass
            return None
        product = data["product"]
        if data.get("status") != 1:
            logging.info(f"OFF: Product {barcode} not found on product endpoint. Trying search fallback.")
            # Fallback: try search API which sometimes has sparse entries
            try:
                search_url = f"https://world.openfoodfacts.org/cgi/search.pl?search_terms={barcode}&search_simple=1&action=process&json=1&page_size=1"
                sresp = requests.get(search_url, timeout=5)
                if sresp.status_code == 200:
                    sdata = sresp.json() or {}
                    products = sdata.get("products") or []
                    if products:
                        product = products[0]
                        # Derive a working name from barcode search
                        name = (
                            product.get("product_name")
                            or product.get("product_name_en")
                            or product.get("generic_name_en")
                            or product.get("generic_name")
                            or product.get("brands")
                            or "Unknown Product"
                        )

                        def build_from_product(p):
                            built_ingredients = []
                            raw = p.get("ingredients", [])
                            if raw:
                                for i in raw:
                                    ing_name = i.get("text", "Unknown")
                                    safety, reason = tag_ingredient_safety(ing_name)
                                    common_name, description = normalize_ingredient_name(ing_name)
                                    built_ingredients.append(Ingredient(
                                        name=ing_name,
                                        safety=safety,
                                        reason=reason,
                                        common_name=common_name,
                                        description=description
                                    ))
                            else:
                                ingredients_text2 = (
                                    p.get("ingredients_text_en")
                                    or p.get("ingredients_text")
                                )
                                if ingredients_text2:
                                    import re
                                    tokens2 = [t.strip() for t in re.split(r"[;,]", ingredients_text2) if t.strip()]
                                    for token2 in tokens2:
                                        safety, reason = tag_ingredient_safety(token2)
                                        common_name, description = normalize_ingredient_name(token2)
                                        built_ingredients.append(Ingredient(
                                            name=token2,
                                            safety=safety,
                                            reason=reason,
                                            common_name=common_name,
                                            description=description
                                        ))
                            built_nutrients = {k: str(v) for k, v in (p.get("nutriments") or {}).items()}
                            built_allergens = p.get("allergens_tags", []) or p.get("allergens", [])
                            return built_ingredients, built_nutrients, built_allergens

                        # First, use the product from barcode search
                        ingredients, nutrients, allergens = build_from_product(product)

                        # If sparse, try name-based search for a richer entry
                        if name and not ingredients and not nutrients:
                            try:
                                import urllib.parse as _urllib_parse
                                name_q = _urllib_parse.quote_plus(name)
                                name_url = f"https://world.openfoodfacts.org/cgi/search.pl?search_terms={name_q}&search_simple=1&action=process&json=1&page_size=5"
                                nresp = requests.get(name_url, timeout=5)
                                if nresp.status_code == 200:
                                    ndata = nresp.json() or {}
                                    nproducts = ndata.get("products") or []
                                    # Pick the first product that has ingredients or nutrients
                                    for np in nproducts:
                                        cand_ing, cand_nut, cand_all = build_from_product(np)
                                        if cand_ing or cand_nut:
                                            ingredients, nutrients, allergens = cand_ing, cand_nut, cand_all
                                            # Prefer a better name if available
                                            name2 = (
                                                np.get("product_name") or np.get("product_name_en")
                                                or np.get("generic_name_en") or np.get("generic_name") or name
                                            )
                                            name = name2
                                            break
                            except Exception:
                                pass

                        health_score = calculate_health_score(ingredients, allergens, nutrients)
                        rating = "Safe" if health_score >= 8 else ("Moderate" if health_score >= 5 else "Harmful")
                        alternatives = suggest_alternatives(name) if rating == "Harmful" else []
                        status_val = "partial_off" if (not ingredients and not nutrients and not allergens) else "found_off"
                        return ProductResponse(
                            barcode=barcode,
                            product_name=name,
                            ingredients=ingredients,
                            nutrients=nutrients,
                            allergens=allergens,
                            health_score=health_score,
                            rating=rating,
                            source="openfoodfacts",
                            status=status_val,
                            alternatives=alternatives
                        )
            except Exception as e2:
                logging.warning(f"OFF search fallback failed for {barcode}: {e2}")
            return None
        product = data["product"]
        # Prefer better product names if available; compose from available parts without 'None'
        name = (
            product.get("product_name")
            or product.get("product_name_en")
            or product.get("generic_name_en")
            or product.get("generic_name")
        )
        if not name:
            parts = [product.get("brands"), product.get("categories_en") or product.get("categories")]
            parts = [p for p in parts if p]
            if parts:
                name = " ".join(parts)
        if not name:
            name = "Unknown Product"

        # Build ingredients list; fall back to parsing ingredients_text if needed
        ingredients = []
        raw_ingredients = product.get("ingredients", [])
        if raw_ingredients:
            for i in raw_ingredients:
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
        else:
            # Try language-specific ingredients_text fields
            ingredients_text = (
                product.get("ingredients_text_en")
                or product.get("ingredients_text")
                or product.get("ingredients_text_fr")
                or product.get("ingredients_text_es")
                or product.get("ingredients_text_de")
            )
            if ingredients_text:
                # Split on commas or semicolons
                import re
                tokens = [t.strip() for t in re.split(r"[;,]", ingredients_text) if t.strip()]
                for token in tokens:
                    safety, reason = tag_ingredient_safety(token)
                    common_name, description = normalize_ingredient_name(token)
                    ingredients.append(Ingredient(
                        name=token,
                        type=None,
                        safety=safety,
                        reason=reason,
                        common_name=common_name,
                        description=description
                    ))
        nutrients = {k: str(v)
                     for k, v in product.get("nutriments", {}).items()}
        allergens = product.get("allergens_tags", []) or product.get("allergens", [])
        health_score = calculate_health_score(
            ingredients, allergens, nutrients)
        rating = "Safe" if health_score >= 8 else (
            "Moderate" if health_score >= 5 else "Harmful")
        alternatives = suggest_alternatives(
            name) if rating == "Harmful" else []
        status_value = "found_off"
        if not ingredients and not nutrients and not allergens:
            status_value = "partial_off"
        return ProductResponse(
            barcode=barcode,
            product_name=name,
            ingredients=ingredients,
            nutrients=nutrients,
            allergens=allergens,
            health_score=health_score,
            rating=rating,
            source="openfoodfacts",
            status=status_value,
            alternatives=alternatives
        )
    except Exception as e:
        logging.error(f"Error fetching from OFF: {e}")
        return None


# Now using Firebase Firestore for DB lookups

app = FastAPI()


@app.post("/scan/ingredients", response_model=ProductResponse)
def scan_ingredients(request: ScanIngredientsRequest = Body(...)):
    from utils import fetch_wikipedia_summary, fetch_off_ingredient_info
    tagged_ingredients = []
    off_cache = {}
    all_off_allergens = set()
    collected_allergen_tags = set()

    # Only show allergens when user provided a non-empty list
    show_allergens = bool(request.user_allergens and any(a.strip() for a in request.user_allergens))

    def layman_explanation(ingredient_name, common_name):
        explanations = {
            "salt": "Salt is a mineral composed primarily of sodium chloride. It is commonly used to season and preserve food.",
            "sodium chloride": "Sodium chloride is the chemical name for table salt, which is used to add flavor to food.",
            "sucrose": "Sucrose is the scientific name for table sugar, a sweetener used in many foods.",
            "glucose": "Glucose is a simple sugar that is an important energy source in living organisms.",
            "citric acid": "Citric acid is a natural acid found in citrus fruits, often used as a preservative and flavoring agent."
            # Add more common ingredients as needed
        }
        key = ingredient_name.lower().strip()
        if key in explanations:
            return explanations[key]
        key2 = common_name.lower().strip() if common_name else ""
        if key2 in explanations:
            return explanations[key2]
        return ""

    # Prepare allergens and nutrients as empty for manual entry
    allergens = []
    nutrients = {}
    matched = []
    for ing_name in request.ingredients:
        ing_key = ing_name.lower().strip()
        # Normalize to singular for API queries

        def singular(word):
            if word.endswith('es') and not word.endswith('ses'):
                return word[:-2]
            elif word.endswith('s') and not word.endswith('ss'):
                return word[:-1]
            return word
        singular_name = singular(ing_name.lower())
        safety, reason = tag_ingredient_safety(ing_name)
        common_name, description = normalize_ingredient_name(ing_name)
        allergen_info = get_allergen_info(ing_name)
        # Query Open Food Facts for allergen tags for this ingredient (cache per request)
        off_info = ""
        off_desc = None
        if ing_key in off_cache:
            off_allergens = off_cache[ing_key]
        else:
            off_url = f"https://world.openfoodfacts.org/cgi/search.pl?search_terms={singular_name}&search_simple=1&action=process&json=1&page_size=1"
            off_allergens = []
            try:
                resp = requests.get(off_url, timeout=5)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("products"):
                        product = data["products"][0]
                        off_allergens = product.get("allergens_tags", [])
                        # Do not include random product ingredients text in description
            except Exception:
                pass
            off_cache[ing_key] = off_allergens
        # Prefer OFF ingredient taxonomy description
        off_meta = fetch_off_ingredient_info(singular_name)
        if off_meta and (off_meta.get("description") or off_meta.get("wikipedia")):
            if off_meta.get("description"):
                off_desc = off_meta["description"]
            elif off_meta.get("wikipedia"):
                off_desc = f"Wikipedia: {off_meta['wikipedia']}"
        # Filter out irrelevant allergen tags (e.g., soybeans for salt)
        filtered_allergens = [
            tag for tag in off_allergens if ing_key not in tag.lower()]
        if filtered_allergens and show_allergens:
            off_info = f"OpenFoodFacts Allergens: {', '.join(filtered_allergens)}"
            # Collect normalized allergen tags for warning logic
            normalized = [tag.lower().replace('en:', '') for tag in filtered_allergens]
            all_off_allergens.update(normalized)
            for t in normalized:
                collected_allergen_tags.add(t)
        # Add allergen info to OFF info if available
        if allergen_info:
            off_info = (off_info + "\n" if off_info else "") + \
                f"Allergen: {allergen_info['allergen']}. Info: {allergen_info['info']}"
            allergens.append(allergen_info['allergen'])
        # Fallback to Wikipedia summary only if OFF has no description
        wiki_info = None
        if not off_desc:
            wiki_summary = fetch_wikipedia_summary(singular_name)
            wiki_info = wiki_summary if wiki_summary else "No Wikipedia info available for this ingredient."
        # Always add layman explanation if available
        layman = layman_explanation(ing_name, common_name)
        layman_info = layman if layman else "No layman explanation available."
        # Combine OFF and Wikipedia info
        description_parts = []
        if off_desc:
            description_parts.append(str(off_desc))
        if off_info:
            description_parts.append(off_info)
        if wiki_info:
            description_parts.append(wiki_info)
        if layman_info:
            description_parts.append(layman_info)
        description = "\n".join(description_parts)
        # Final fallback if description is still empty
        if not description.strip():
            description = "No information available for this ingredient."
        tagged_ingredients.append(Ingredient(
            name=ing_name,
            safety=safety,
            reason=reason,
            common_name=common_name,
            description=description
        ))
    # Prepare final allergens list (only if show_allergens)
    def pretty_tag(tag: str) -> str:
        return tag.replace('-', ' ').title()

    if show_allergens and collected_allergen_tags:
        allergens = [pretty_tag(t) for t in sorted(collected_allergen_tags)]
        allergen_warning = f"Warning: Product contains your allergens: {', '.join(allergens)}"
    else:
        allergens = []
        allergen_warning = ""
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

    # Only show allergens if product_name is not just whitespace and user_allergens contains at least one non-empty string
    user_allergens_nonempty = any(
        a.strip() for a in request.user_allergens) if request.user_allergens else False
    product_name_nonempty = bool(
        request.product_name and request.product_name.strip())
    show_allergens = user_allergens_nonempty or product_name_nonempty


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
def scan_barcode(barcode: str, user_allergens: List[str] = Query(None)):
    # 1. Try Open Food Facts
    result = fetch_from_openfoodfacts(barcode)
    if result:
        result.status = "found_off"
        # Build allergen warning if user allergens provided
        allergen_warning = None
        if user_allergens:
            ingredient_names = [i.name for i in result.ingredients] + [
                i.common_name for i in result.ingredients if i.common_name
            ]
            matched_custom = match_allergens(ingredient_names, user_allergens) or []
            off_tags = set([tag.lower().replace('en:', '') for tag in result.allergens])
            matched_off = [a for a in (user_allergens or []) if a.lower() in off_tags]
            matched = sorted(set([*matched_custom, *matched_off]))
            if matched:
                allergen_warning = f"Warning: Product contains your allergens: {', '.join(matched)}"
        result.allergen_warning = allergen_warning
        return result

    # 2. Try local database
    local = fetch_from_local_db(barcode)
    if local:
        return local

    # 3. Not found: return minimal response instead of 404
    return ProductResponse(
        barcode=barcode,
        product_name="Unknown Product",
        ingredients=[],
        nutrients={},
        allergens=[],
        health_score=10,
        rating="Safe",
        source="openfoodfacts",
        status="not_found",
        alternatives=[],
        allergen_warning=None
    )
