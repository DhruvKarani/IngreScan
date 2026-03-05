from fuzzywuzzy import fuzz
from fuzzywuzzy import process
import json
import os

# Get the directory of the current script
script_dir = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(script_dir, 'ingredient_db.json')
synonym_path = os.path.join(script_dir, 'synonym_map.json')

with open(db_path, "r") as f:
    ING_DB = json.load(f)

with open(synonym_path, "r") as f:
    SYNONYM_MAP = json.load(f)

def get_best_match(ingredient):
    ing = ingredient.lower().strip()

    # Synonym map first
    if ing in SYNONYM_MAP:
        ing = SYNONYM_MAP[ing]

    # Exact match in DB
    if ing in ING_DB:
        return ing

    # Fuzzy match
    all_keys = list(ING_DB.keys())
    match, score = process.extractOne(ing, all_keys)
    if score >= 85:
        return match

    return None  # Not found

# 🔍 Example
if __name__ == '__main__':
    sample_input = ["E621", "MSG", "Sodum Benzoate", "CMC", "Sodiym Benzzoate"]
    for ing in sample_input:
        print(f"{ing} → {get_best_match(ing)}")
