from pydantic import BaseModel
from typing import Optional, List, Dict


class Ingredient(BaseModel):
    name: str
    type: Optional[str] = None
    safety: Optional[str] = None
    reason: Optional[str] = None
    common_name: Optional[str] = None
    description: Optional[str] = None


class ProductResponse(BaseModel):
    barcode: str
    product_name: str
    ingredients: List[Ingredient]
    nutrients: Dict[str, str]
    allergens: List[str]
    health_score: Optional[int] = None
    rating: Optional[str] = None
    source: str
    status: Optional[str] = None
    alternatives: Optional[List[str]] = None
    allergen_warning: Optional[str] = None
