"""
API Fetchers Package

Multi-source product data fetchers with waterfall fallback logic.
Supports Firebase, OpenFoodFacts, Edamam, and FatSecret APIs.
"""

from .firebase_fetcher import fetch_from_firebase
from .off_fetcher import fetch_from_off
from .edamam_fetcher import fetch_from_edamam
from .fatsecret_fetcher import fetch_from_fatsecret

__all__ = [
    'fetch_from_firebase',
    'fetch_from_off',
    'fetch_from_edamam',
    'fetch_from_fatsecret'
]
