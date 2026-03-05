"""
Step 4: Augment with Crowdsourced Firebase Data

Extracts ingredients from verified products in Firebase (verifiedCount >= 3)
and adds real-world ingredient names to our training dataset.

Input: ingredients_with_harm_levels.csv
Output: augmented_ingredients.csv
"""

import pandas as pd
import logging
import json
import sys
import os
import re
from typing import List, Dict, Set

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Firebase imports
try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    FIREBASE_AVAILABLE = True
except ImportError:
    logger.warning("⚠ firebase-admin not installed. Will skip Firebase data collection.")
    FIREBASE_AVAILABLE = False


class FirebaseIngredientExtractor:
    """Extract ingredients from verified Firebase products"""
    
    def __init__(self):
        self.db = None
        self.initialized = False
    
    def initialize_firebase(self) -> bool:
        """Initialize Firebase connection"""
        if not FIREBASE_AVAILABLE:
            return False
        
        try:
            # Check if already initialized
            if firebase_admin._apps:
                self.db = firestore.client()
                self.initialized = True
                logger.info("✓ Using existing Firebase connection")
                return True
            
            # Initialize new connection
            cred_path = '../firebase-credentials.json'
            if not os.path.exists(cred_path):
                logger.error(f"❌ Firebase credentials not found at {cred_path}")
                return False
            
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            self.db = firestore.client()
            self.initialized = True
            logger.info("✓ Firebase initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Firebase initialization failed: {e}")
            return False
    
    def extract_verified_ingredients(self, min_verified_count: int = 3) -> List[Dict]:
        """
        Extract ingredients from products with verifiedCount >= min_verified_count
        Returns list of {ingredient_name, source_product_id, verified_count}
        """
        if not self.initialized:
            logger.warning("Firebase not initialized, skipping extraction")
            return []
        
        try:
            logger.info(f"Querying Firebase for products with verifiedCount >= {min_verified_count}...")
            
            # Query verified products
            products_ref = self.db.collection('products')
            query = products_ref.where('verifiedCount', '>=', min_verified_count)
            
            verified_products = list(query.stream())
            logger.info(f"✓ Found {len(verified_products)} verified products")
            
            if len(verified_products) == 0:
                logger.warning("No verified products found. Database may be empty.")
                return []
            
            # Debug: Check product structure
            if len(verified_products) > 0:
                sample_product = verified_products[0].to_dict()
                logger.info(f"Sample product fields: {list(sample_product.keys())}")
                if 'ingredients' in sample_product:
                    logger.info(f"Sample ingredients field type: {type(sample_product['ingredients'])}")
                    logger.info(f"Sample ingredients value: {sample_product['ingredients']}")
            
            # Extract ingredients
            ingredient_instances = []
            products_with_ingredients = 0
            
            for doc in verified_products:
                product = doc.to_dict()
                product_id = doc.id
                verified_count = product.get('verifiedCount', 0)
                
                # Try to get ingredients from 'ingredients' array field
                ingredients_raw = product.get('ingredients', [])
                ingredients = []
                
                # Handle both string list and object list formats
                if ingredients_raw:
                    for ing in ingredients_raw:
                        if isinstance(ing, dict):
                            # Extract 'name' field from ingredient object
                            name = ing.get('name', '').strip()
                            if name:
                                ingredients.append(name)
                        elif isinstance(ing, str):
                            # Direct string format
                            if ing.strip():
                                ingredients.append(ing.strip())
                
                # If empty, try parsing 'ingredients_text'
                if not ingredients:
                    ing_text = product.get('ingredients_text', '')
                    if ing_text:
                        # Split by comma and clean
                        ingredients = [i.strip() for i in ing_text.split(',') if i.strip()]
                
                if not ingredients:
                    logger.debug(f"Product {product_id} has no ingredients")
                    continue
                
                products_with_ingredients += 1
                
                # Add each ingredient
                for ing in ingredients:
                    if isinstance(ing, str) and ing.strip():
                        ingredient_instances.append({
                            'ingredient_name': ing.strip(),
                            'source_product_id': product_id,
                            'verified_count': verified_count,
                            'product_name': product.get('product_name', 'Unknown')
                        })
            
            logger.info(f"✓ Extracted {len(ingredient_instances)} ingredient instances from {products_with_ingredients} products")
            return ingredient_instances
            
        except Exception as e:
            logger.error(f"❌ Error extracting Firebase data: {e}")
            return []
    
    def cleanup(self):
        """Cleanup Firebase connection"""
        if self.initialized:
            try:
                firebase_admin.delete_app(firebase_admin.get_app())
                logger.info("✓ Firebase connection closed")
            except:
                pass


class IngredientMatcher:
    """Match Firebase ingredients to authoritative database"""
    
    def __init__(self, authoritative_df: pd.DataFrame):
        self.authoritative_df = authoritative_df
        
        # Build lookup dictionaries
        self.exact_match = {}
        self.e_number_match = {}
        self.keyword_match = {}
        
        self._build_lookup_tables()
    
    def _build_lookup_tables(self):
        """Build fast lookup tables for matching"""
        for idx, row in self.authoritative_df.iterrows():
            name = row['ingredient_name'].lower()
            e_num = str(row['e_number']).upper() if pd.notna(row['e_number']) else ''
            
            # Exact match
            self.exact_match[name] = idx
            
            # E-number match
            if e_num and e_num.startswith('E'):
                self.e_number_match[e_num] = idx
                # Also match without 'E' prefix
                self.e_number_match[e_num[1:]] = idx
            
            # Keyword match (split words)
            words = re.findall(r'\w+', name)
            for word in words:
                if len(word) >= 4:  # Only meaningful words
                    if word not in self.keyword_match:
                        self.keyword_match[word] = []
                    self.keyword_match[word].append(idx)
    
    def match_ingredient(self, firebase_ingredient: str) -> tuple:
        """
        Try to match Firebase ingredient to authoritative database
        Returns: (matched_index, match_type, confidence)
        """
        fb_lower = firebase_ingredient.lower().strip()
        
        # 1. Exact match
        if fb_lower in self.exact_match:
            return (self.exact_match[fb_lower], 'exact', 1.0)
        
        # 2. E-number match (E951, E-951, 951)
        e_match = re.search(r'\b[Ee]-?(\d{3,4})\b', firebase_ingredient)
        if e_match:
            e_num = 'E' + e_match.group(1)
            if e_num in self.e_number_match:
                return (self.e_number_match[e_num], 'e_number', 0.95)
        
        # 3. Fuzzy keyword match
        words = re.findall(r'\w+', fb_lower)
        for word in words:
            if word in self.keyword_match:
                # Return first match (could be improved with scoring)
                return (self.keyword_match[word][0], 'keyword', 0.7)
        
        # No match found
        return (None, 'no_match', 0.0)
    
    def classify_unmatched(self, ingredient: str) -> Dict:
        """
        Try to classify unknown ingredient using simple heuristics
        Returns category guess and harm level
        """
        ing_lower = ingredient.lower()
        
        # Sweetener patterns
        if any(kw in ing_lower for kw in ['sugar', 'syrup', 'glucose', 'fructose', 'honey', 'sweet']):
            return {'our_category': 'refined_sugar', 'harm_level': 'MEDIUM', 'type': 'processed'}
        
        # Preservative patterns
        if any(kw in ing_lower for kw in ['acid', 'sorbate', 'benzoate', 'preserv']):
            return {'our_category': 'moderate_preservative', 'harm_level': 'MEDIUM', 'type': 'processed'}
        
        # Color patterns
        if any(kw in ing_lower for kw in ['color', 'colour', 'dye', 'caramel']):
            return {'our_category': 'moderate_color', 'harm_level': 'MEDIUM', 'type': 'processed'}
        
        # Fat patterns
        if any(kw in ing_lower for kw in ['oil', 'fat', 'butter', 'ghee']):
            return {'our_category': 'fat', 'harm_level': 'LOW', 'type': 'natural'}
        
        # Default: other
        return {'our_category': 'other', 'harm_level': 'UNKNOWN', 'type': 'unknown'}


def main():
    """Main execution function"""
    logger.info("=" * 60)
    logger.info("STEP 4: AUGMENT WITH CROWDSOURCED FIREBASE DATA")
    logger.info("=" * 60)
    
    # Load authoritative data from Step 3
    logger.info("\n[1/5] Loading authoritative ingredient data...")
    auth_df = pd.read_csv('ingredients_with_harm_levels.csv')
    logger.info(f"✓ Loaded {len(auth_df)} authoritative ingredients")
    
    # Initialize Firebase
    logger.info("\n[2/5] Connecting to Firebase...")
    extractor = FirebaseIngredientExtractor()
    
    if not extractor.initialize_firebase():
        logger.warning("⚠ Firebase unavailable. Skipping crowdsourced data augmentation.")
        logger.info("Copying authoritative data to augmented output...")
        auth_df.to_csv('augmented_ingredients.csv', index=False, encoding='utf-8')
        logger.info("✓ Step 4 skipped (no Firebase data)")
        return
    
    # Extract verified ingredients
    logger.info("\n[3/5] Extracting ingredients from verified products...")
    firebase_ingredients = extractor.extract_verified_ingredients(min_verified_count=3)
    extractor.cleanup()
    
    if not firebase_ingredients:
        logger.warning("⚠ No ingredients extracted from Firebase")
        logger.info("Copying authoritative data to augmented output...")
        auth_df.to_csv('augmented_ingredients.csv', index=False, encoding='utf-8')
        logger.info("✓ Step 4 complete (no new data added)")
        return
    
    # Match ingredients to authoritative database
    logger.info("\n[4/5] Matching Firebase ingredients to database...")
    matcher = IngredientMatcher(auth_df)
    
    match_stats = {'exact': 0, 'e_number': 0, 'keyword': 0, 'no_match': 0}
    new_ingredients = []
    
    # Deduplicate Firebase ingredients
    unique_fb_ingredients = {}
    for item in firebase_ingredients:
        name = item['ingredient_name']
        if name not in unique_fb_ingredients:
            unique_fb_ingredients[name] = item
        else:
            # Keep item with higher verification count
            if item['verified_count'] > unique_fb_ingredients[name]['verified_count']:
                unique_fb_ingredients[name] = item
    
    logger.info(f"✓ {len(unique_fb_ingredients)} unique ingredients from Firebase")
    
    for fb_ing_name, fb_item in unique_fb_ingredients.items():
        idx, match_type, confidence = matcher.match_ingredient(fb_ing_name)
        match_stats[match_type] += 1
        
        if match_type == 'no_match':
            # New ingredient - try to classify
            classification = matcher.classify_unmatched(fb_ing_name)
            new_ingredients.append({
                'ingredient_name': fb_ing_name,
                'e_number': '',
                'regulatory_category': 'Crowdsourced',
                'our_category': classification['our_category'],
                'type': classification['type'],
                'harm_level': classification['harm_level'],
                'harm_justification': f'Crowdsourced ingredient from verified products. Classified heuristically as {classification["our_category"]}. Needs expert review.',
                'scientific_references': 'Crowdsourced data, no official references',
                'regulatory_status': 'Unknown',
                'source': 'Firebase',
                'reference': f'Product: {fb_item["product_name"]}, Verified: {fb_item["verified_count"]} users'
            })
    
    # Combine datasets
    logger.info("\n[5/5] Combining authoritative and crowdsourced data...")
    new_df = pd.DataFrame(new_ingredients)
    
    if len(new_df) > 0:
        augmented_df = pd.concat([auth_df, new_df], ignore_index=True)
        logger.info(f"✓ Added {len(new_df)} new crowdsourced ingredients")
    else:
        augmented_df = auth_df
        logger.info("✓ No new ingredients added (all matched to existing database)")
    
    # Save
    output_path = 'augmented_ingredients.csv'
    augmented_df.to_csv(output_path, index=False, encoding='utf-8')
    
    # Print summary
    logger.info("\n" + "=" * 60)
    logger.info("CROWDSOURCED DATA AUGMENTATION COMPLETE")
    logger.info("=" * 60)
    logger.info(f"Total ingredients in augmented dataset: {len(augmented_df)}")
    logger.info(f"  - Authoritative (EFSA/FDA/FooDB): {len(auth_df)}")
    logger.info(f"  - New crowdsourced: {len(new_df)}")
    logger.info(f"Output saved to: {output_path}")
    
    logger.info("\nMatching statistics:")
    logger.info(f"  - Exact matches: {match_stats['exact']}")
    logger.info(f"  - E-number matches: {match_stats['e_number']}")
    logger.info(f"  - Keyword matches: {match_stats['keyword']}")
    logger.info(f"  - No match (new): {match_stats['no_match']}")
    
    if len(new_df) > 0:
        logger.info("\nSample new crowdsourced ingredients:")
        print(new_df[['ingredient_name', 'our_category', 'harm_level', 'reference']].head(10).to_string())
    
    logger.info("\n✓ Step 4 Complete! Next: Step 5 - Data augmentation & balancing")


if __name__ == "__main__":
    main()
