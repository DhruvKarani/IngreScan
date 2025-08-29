
# Firebase Firestore integration for product lookup
"""
import firebase_admin
from firebase_admin import credentials, firestore
import os

# Initialize Firebase app (only once)
if not firebase_admin._apps:
    cred_path = os.path.join(os.path.dirname(
        __file__), 'firebase_credentials.json')
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
db = firestore.client()
"""

from models import Ingredient, ProductResponse
from utils import tag_ingredient_safety, calculate_health_score, suggest_alternatives


def fetch_from_local_db(barcode: str):
    # Firebase is disabled for now; always return None
    return None
