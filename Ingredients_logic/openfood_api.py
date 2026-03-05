# import requests

# def fetch_ingredient_info(ingredient_name):
#     query = ingredient_name.lower().strip().replace(' ', '+')
#     url = f"https://world.openfoodfacts.org/cgi/search.pl?search_terms={query}&search_simple=1&action=process&json=1"

#     try:
#         res = requests.get(url, timeout=5)
#         if res.status_code == 200:
#             data = res.json()
#             products = data.get("products", [])
#             if products:
#                 product = products[0]
#                 product_name = product.get("product_name", "a product")
#                 ingredients_text = product.get("ingredients_text", "No details available.")

#                 return {
#                     "common_name": ingredient_name.upper(),
#                     "description": f"Commonly found in products like '{product_name}'. Example ingredients: {ingredients_text[:100]}...",
#                     "found_in": [],
#                     "risk_level": "unknown",
#                     "also_used_in": []
#                 }
#         return None
#     except Exception as e:
#         print(f"[API ERROR] {ingredient_name}: {e}")
#         return None





# Here’s your upgraded fetch_ingredient_info() that:

# ✅ Uses the API →
# 🧼 Cleans response text →
# 📘 Falls back to Wikipedia if API response is empty or vague →
# 📦 Returns structured output.



import requests
import re
import wikipedia

def clean_text(text):
    """Remove unwanted patterns and standardize text."""
    if not text:
        return ""

    # Remove HTML tags, excessive whitespace, strange chars
    text = re.sub(r"<.*?>", "", text)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\[\d+\]", "", text)
    return text.strip()

def fetch_from_wikipedia(query):
    """Fallback to Wikipedia summary if API fails or is vague."""
    try:
        print(f"📖 Fetching from Wikipedia: {query}")
        # Try different search terms if the first fails
        search_terms = [
            query,
            f"{query} food additive",
            f"{query} preservative",
            f"{query} ingredient"
        ]
        
        for term in search_terms:
            try:
                summary = wikipedia.summary(term, sentences=2, auto_suggest=True, redirect=True)
                if summary and len(summary.strip()) > 20:  # Ensure meaningful content
                    return clean_text(summary)
            except wikipedia.exceptions.DisambiguationError as e:
                # Try the first option from disambiguation
                if e.options:
                    summary = wikipedia.summary(e.options[0], sentences=2)
                    if summary:
                        return clean_text(summary)
            except wikipedia.exceptions.PageError:
                continue  # Try next search term
            except:
                continue
                
        return None
    except Exception as e:
        print(f"📖 Wikipedia fallback failed: {e}")
        return None

def is_vague_or_missing(desc):
    """Check if description is missing or non-informative."""
    vague_terms = {"no data", "n/a", "not available", "unknown", ""}
    return desc.lower().strip() in vague_terms

def fetch_ingredient_info(ingredient_name):
    """
    Fetch ingredient information with aggressive timeout and offline-first approach.
    If network fails, returns basic structured data for unknown ingredients.
    """
    
    # First try Wikipedia (usually faster and more reliable)
    print(f"📘 Trying Wikipedia first for: {ingredient_name}")
    wiki_result = fetch_from_wikipedia(ingredient_name)
    if wiki_result:
        return {
            "common_name": ingredient_name.title(),
            "description": wiki_result,
            "risk_level": "unknown",
            "found_in": [],
            "also_used_in": [],
            "source": "Wikipedia"
        }
    
    # Then try OpenFoodFacts with very short timeout
    try:
        search_term = ingredient_name.lower().strip().replace(' ', '+')
        url = f"https://world.openfoodfacts.org/cgi/search.pl?search_terms={search_term}&search_simple=1&action=process&json=1&page_size=2"
        
        headers = {
            'User-Agent': 'IngreScan/1.0',
            'Accept': 'application/json'
        }
        
        print(f"🌐 Quick API try for: {ingredient_name}")
        response = requests.get(url, headers=headers, timeout=2)  # Very short timeout
        
        if response.status_code == 200:
            data = response.json()
            products = data.get("products", [])
            
            if products:
                product = products[0]
                product_name = product.get("product_name", "")
                
                if product_name:
                    description = f"Found in products like: {product_name}."
                    return {
                        "common_name": ingredient_name.title(),
                        "description": clean_text(description),
                        "risk_level": "unknown",
                        "found_in": ["processed foods"],
                        "also_used_in": [],
                        "source": "OpenFoodFacts"
                    }
    
    except Exception as e:
        print(f"⚡ API skipped ({e.__class__.__name__})")
    
    # Return structured "unknown" result instead of None
    print(f"🏠 Using offline fallback for: {ingredient_name}")
    return {
        "common_name": ingredient_name.title(),
        "description": f"{ingredient_name.title()} is a food ingredient. Detailed information not available offline. Consider checking food safety databases for more details.",
        "risk_level": "unknown",
        "found_in": ["various food products"],
        "also_used_in": [],
        "source": "Offline Fallback"
    }

def extract_ingredient_context(ingredients_text, ingredient_name):
    """Extract context around ingredient mention."""
    try:
        text_lower = ingredients_text.lower()
        ingredient_lower = ingredient_name.lower()
        
        index = text_lower.find(ingredient_lower)
        if index != -1:
            # Get 50 characters before and after
            start = max(0, index - 50)
            end = min(len(ingredients_text), index + len(ingredient_name) + 50)
            return ingredients_text[start:end].strip()
    except:
        pass
    return None

def extract_food_categories(categories_str, product_names):
    """Extract likely food categories from OpenFoodFacts data."""
    found_in = []
    
    # Common category mappings
    category_map = {
        "beverage": ["soft drinks", "beverages"],
        "dairy": ["dairy products", "cheese", "yogurt"],
        "meat": ["processed meats", "sausages"],
        "snack": ["snacks", "chips"],
        "bread": ["baked goods", "bread"],
        "dessert": ["desserts", "sweets"],
        "sauce": ["sauces", "condiments"]
    }
    
    categories_lower = categories_str.lower()
    for key, values in category_map.items():
        if key in categories_lower:
            found_in.extend(values[:1])  # Add first value
    
    # If no categories found, infer from product names
    if not found_in and product_names:
        for product in product_names[:2]:
            product_lower = product.lower()
            if any(word in product_lower for word in ["drink", "soda", "juice"]):
                found_in.append("beverages")
            elif any(word in product_lower for word in ["bread", "cake", "cookie"]):
                found_in.append("baked goods")
            elif any(word in product_lower for word in ["chip", "snack"]):
                found_in.append("snacks")
    
    return found_in[:3]  # Return max 3 categories

