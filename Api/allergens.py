# allergen synonyms mapping and matching logic

ALLERGEN_SYNONYMS = {
    "lactose": ["milk", "whey", "casein", "lactose"],
    "peanut": ["peanut", "groundnut", "goober"],
    "gluten": ["wheat", "barley", "rye", "gluten"],
    "soy": ["soy", "soya", "soybean"],
    "egg": ["egg", "albumin", "ovalbumin"],
    "tree nut": ["almond", "cashew", "walnut", "hazelnut", "pecan", "pistachio", "macadamia", "brazil nut", "tree nut"],
    "fish": ["fish", "anchovy", "bass", "catfish", "cod", "flounder", "grouper", "haddock", "hake", "halibut", "herring", "mahi mahi", "perch", "pike", "pollock", "salmon", "sardine", "snapper", "sole", "tilapia", "trout", "tuna"],
    "shellfish": ["shrimp", "prawn", "crab", "lobster", "scallop", "clam", "oyster", "mussel", "shellfish"],
    "sesame": ["sesame", "sesame seed"],
    "mustard": ["mustard", "mustard seed"],
    "sulfite": ["sulfite", "sulphite", "sulfur dioxide"],
}

ALLERGEN_INFO = {
    "milk": {
        "allergen": "lactose",
        "info": "Milk contains lactose, which can cause issues for lactose intolerant individuals."
    },
    "whey": {
        "allergen": "lactose",
        "info": "Whey is a milk protein and contains lactose."
    },
    "casein": {
        "allergen": "lactose",
        "info": "Casein is a milk protein and contains lactose."
    },
    "cheese": {
        "allergen": "lactose",
        "info": "Cheese is made from milk and may contain lactose."
    },
    "ricotta cheese": {
        "allergen": "lactose",
        "info": "Ricotta cheese is made from milk and contains lactose."
    },
    "parmesan cheese": {
        "allergen": "lactose",
        "info": "Parmesan cheese is made from milk and contains lactose."
    },
    "mozzarella cheese": {
        "allergen": "lactose",
        "info": "Mozzarella cheese is made from milk and contains lactose."
    },
    "egg": {
        "allergen": "egg",
        "info": "Eggs are a common allergen, especially in children."
    },
    "eggs": {
        "allergen": "egg",
        "info": "Eggs are a common allergen, especially in children."
    },
    "peanut": {
        "allergen": "peanut",
        "info": "Peanuts are a common allergen and can cause severe reactions."
    },
    "wheat": {
        "allergen": "gluten",
        "info": "Wheat contains gluten, which can cause issues for people with gluten intolerance or celiac disease."
    },
    "soy": {
        "allergen": "soy",
        "info": "Soy is a common allergen found in many processed foods."
    },
    "almond": {
        "allergen": "tree nut",
        "info": "Almonds are tree nuts and can cause allergic reactions."
    },
    "shrimp": {
        "allergen": "shellfish",
        "info": "Shrimp is a shellfish and a common allergen."
    },
    # Add more items as needed
}


def get_allergen_info(ingredient: str) -> dict:
    """
    Returns allergen info for a given ingredient if available.
    """
    key = ingredient.lower().strip()
    return ALLERGEN_INFO.get(key)


def match_allergens(ingredients: list, user_allergens: list) -> list:
    """
    Returns a list of matched allergens based on synonyms mapping.
    """
    matched = set()
    ingredients_lower = set([i.lower() for i in ingredients])
    for allergen in user_allergens:
        allergen_lower = allergen.lower()
        synonyms = ALLERGEN_SYNONYMS.get(allergen_lower, [allergen_lower])
        for syn in synonyms:
            if syn in ingredients_lower:
                matched.add(allergen)
                break
    return list(matched)
