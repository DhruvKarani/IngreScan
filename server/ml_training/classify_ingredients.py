"""
Step 2: Auto-Classify Ingredients into Domain-Specific Categories

Maps regulatory categories (EFSA/FDA) to our custom food health categories:
- Natural vs Artificial sweeteners
- Preservative harm levels
- Color safety levels
- etc.

Input: authoritative_ingredients.csv
Output: classified_ingredients.csv
"""

import pandas as pd
import re
import logging
from typing import Dict, Tuple

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class IngredientClassifier:
    """Classify ingredients into domain-specific categories"""
    
    def __init__(self):
        # Domain-specific category mappings
        self.category_mapping = {
            # Sweetener classifications
            'natural_sweetener': {
                'keywords': ['stevia', 'steviol', 'monk fruit', 'thaumatin', 'erythritol', 'xylitol', 'allulose'],
                'e_numbers': ['E960', 'E957', 'E967', 'E968'],
                'type': 'natural'
            },
            'artificial_sweetener': {
                'keywords': ['aspartame', 'sucralose', 'saccharin', 'acesulfame', 'cyclamate', 'neotame', 'advantame'],
                'e_numbers': ['E950', 'E951', 'E952', 'E954', 'E955', 'E961', 'E962'],
                'type': 'artificial'
            },
            'sugar_alcohol': {
                'keywords': ['sorbitol', 'mannitol', 'maltitol', 'isomalt', 'lactitol', 'glycerol'],
                'e_numbers': ['E420', 'E421', 'E953', 'E965', 'E966', 'E422'],
                'type': 'processed'
            },
            'refined_sugar': {
                'keywords': ['sucrose', 'glucose', 'fructose', 'dextrose', 'maltose', 'lactose', 'corn syrup', 'hfcs'],
                'e_numbers': [],
                'type': 'processed'
            },
            'natural_sugar': {
                'keywords': ['honey', 'maple syrup', 'molasses', 'agave'],
                'e_numbers': [],
                'type': 'natural'
            },
            
            # Preservative classifications (by harm level)
            'natural_preservative': {
                'keywords': ['ascorbic acid', 'tocopherol', 'citric acid', 'lactic acid', 'acetic acid', 
                           'vinegar', 'vitamin c', 'vitamin e', 'rosemary extract', 'nisin', 'natamycin'],
                'e_numbers': ['E200', 'E201', 'E202', 'E203', 'E234', 'E235',
                            'E260', 'E261', 'E262', 'E263', 'E270',
                            'E300', 'E301', 'E302', 'E304', 'E306', 'E307', 'E308', 'E309', 'E330'],
                'type': 'natural'
            },
            'moderate_preservative': {
                'keywords': ['sorbate', 'propionate', 'propionic'],
                'e_numbers': ['E280', 'E281', 'E282', 'E283'],
                'type': 'processed'
            },
            'harmful_preservative': {
                'keywords': ['benzoate', 'sulphite', 'sulfite', 'sulphur dioxide', 'sulfur dioxide', 
                           'metabisulphite', 'bha', 'bht', 'tbhq', 'biphenyl', 'phenol'],
                'e_numbers': ['E210', 'E211', 'E212', 'E213',
                            'E220', 'E221', 'E222', 'E223', 'E224', 'E228',
                            'E230', 'E231', 'E232',
                            'E310', 'E311', 'E312', 'E319', 'E320', 'E321'],
                'type': 'artificial'
            },
            'very_harmful_preservative': {
                'keywords': ['nitrite', 'nitrate'],
                'e_numbers': ['E249', 'E250', 'E251', 'E252'],
                'type': 'artificial'
            },
            
            # Color classifications
            'natural_color': {
                'keywords': ['curcumin', 'riboflavin', 'carotene', 'chlorophyll', 'anthocyanin', 
                           'beetroot', 'annatto', 'paprika', 'turmeric', 'carmine', 'cochineal', 'lutein'],
                'e_numbers': ['E100', 'E101', 'E120', 'E140', 'E141', 
                            'E160a', 'E160b', 'E160c', 'E161b', 'E162', 'E163'],
                'type': 'natural'
            },
            'moderate_color': {
                'keywords': ['caramel'],
                'e_numbers': ['E150a', 'E150b', 'E150c', 'E150d', 'E171', 'E172'],
                'type': 'processed'
            },
            'harmful_color': {
                'keywords': ['tartrazine', 'yellow', 'sunset', 'allura', 'red', 'ponceau', 
                           'erythrosine', 'indigo', 'blue', 'brilliant', 'patent', 'green', 'brown', 'black'],
                'e_numbers': ['E102', 'E104', 'E110', 'E122', 'E123', 'E124', 'E127', 'E129',
                            'E131', 'E132', 'E133', 'E142', 'E151', 'E153', 'E154', 'E155'],
                'type': 'artificial'
            },
            
            # Flavor enhancers
            'flavor_enhancer': {
                'keywords': ['glutamate', 'msg', 'guanylate', 'inosinate', 'glutamic', 'yeast extract'],
                'e_numbers': ['E620', 'E621', 'E622', 'E623', 'E624', 'E625',
                            'E626', 'E627', 'E628', 'E629', 'E630', 'E631', 'E632', 'E633', 'E634', 'E635'],
                'type': 'processed'
            },
            
            # Emulsifiers & Stabilizers
            'emulsifier_stabilizer': {
                'keywords': ['lecithin', 'mono-', 'diglyceride', 'polysorbate', 'carrageenan', 
                           'guar', 'xanthan', 'locust bean', 'pectin', 'gelatin', 'agar', 
                           'alginate', 'cellulose', 'starch', 'gum', 'phosphate'],
                'e_numbers': ['E400', 'E401', 'E402', 'E403', 'E404', 'E405', 'E406', 'E407',
                            'E410', 'E412', 'E413', 'E414', 'E415', 'E416', 'E417', 'E418',
                            'E440', 'E441', 'E442', 'E450', 'E451', 'E452',
                            'E460', 'E461', 'E463', 'E464', 'E465', 'E466',
                            'E470a', 'E470b', 'E471', 'E472a', 'E472e', 'E475', 'E476', 'E477', 'E481', 'E482'],
                'type': 'processed'
            },
            
            # Fats
            'fat': {
                'keywords': ['oil', 'fat', 'butter', 'margarine'],
                'e_numbers': [],
                'type': 'natural'
            },
            
            # Others
            'acid': {
                'keywords': ['acid'],
                'e_numbers': [],
                'type': 'natural'
            },
            'leavening_agent': {
                'keywords': ['bicarbonate', 'baking'],
                'e_numbers': [],
                'type': 'natural'
            },
            'thickener': {
                'keywords': ['starch', 'maltodextrin'],
                'e_numbers': [],
                'type': 'processed'
            },
            'other': {
                'keywords': [],
                'e_numbers': [],
                'type': 'unknown'
            }
        }
    
    def classify_ingredient(self, name: str, e_number: str, fda_category: str) -> Tuple[str, str]:
        """
        Classify ingredient into our domain category
        Returns: (our_category, type)
        """
        name_lower = name.lower()
        
        # Check each category
        for our_category, rules in self.category_mapping.items():
            # Check E-number match
            if e_number and e_number in rules['e_numbers']:
                return our_category, rules['type']
            
            # Check keyword match
            for keyword in rules['keywords']:
                if keyword.lower() in name_lower:
                    return our_category, rules['type']
        
        # Fallback: map FDA category to closest match
        fda_lower = fda_category.lower()
        if 'sweetener' in fda_lower:
            # Default sweeteners to artificial unless proven natural
            if any(nat in name_lower for nat in ['stevia', 'monk', 'honey', 'maple', 'agave']):
                return 'natural_sweetener', 'natural'
            elif any(sug in name_lower for sug in ['sorbitol', 'mannitol', 'maltitol', 'xylitol', 'erythritol']):
                return 'sugar_alcohol', 'processed'
            else:
                return 'artificial_sweetener', 'artificial'
        
        elif 'preservative' in fda_lower:
            return 'moderate_preservative', 'processed'
        
        elif 'color' in fda_lower:
            return 'natural_color', 'natural'
        
        elif 'antioxidant' in fda_lower:
            return 'natural_preservative', 'natural'
        
        elif 'flavor' in fda_lower:
            return 'flavor_enhancer', 'processed'
        
        elif 'emulsifier' in fda_lower or 'stabilizer' in fda_lower:
            return 'emulsifier_stabilizer', 'processed'
        
        elif 'fat' in fda_lower:
            return 'fat', 'natural'
        
        else:
            return 'other', 'unknown'
    
    def assign_harm_level(self, our_category: str, name: str) -> str:
        """
        Assign harm level based on category
        Returns: VERY_LOW, LOW, MEDIUM, HIGH, VERY_HIGH
        """
        harm_mapping = {
            # Sweeteners
            'natural_sweetener': 'LOW',
            'natural_sugar': 'LOW',
            'sugar_alcohol': 'MEDIUM',
            'refined_sugar': 'MEDIUM',
            'artificial_sweetener': 'MEDIUM',
            
            # Preservatives
            'natural_preservative': 'VERY_LOW',
            'moderate_preservative': 'MEDIUM',
            'harmful_preservative': 'HIGH',
            'very_harmful_preservative': 'VERY_HIGH',
            
            # Colors
            'natural_color': 'VERY_LOW',
            'moderate_color': 'MEDIUM',
            'harmful_color': 'HIGH',
            
            # Others
            'flavor_enhancer': 'MEDIUM',
            'emulsifier_stabilizer': 'LOW',
            'fat': 'LOW',
            'acid': 'VERY_LOW',
            'leavening_agent': 'VERY_LOW',
            'thickener': 'LOW',
            'other': 'UNKNOWN'
        }
        
        return harm_mapping.get(our_category, 'UNKNOWN')


def main():
    """Main execution function"""
    logger.info("=" * 60)
    logger.info("STEP 2: AUTO-CLASSIFY INGREDIENTS INTO DOMAIN CATEGORIES")
    logger.info("=" * 60)
    
    # Load data from Step 1
    logger.info("\n[1/3] Loading authoritative ingredients...")
    df = pd.read_csv('authoritative_ingredients.csv')
    logger.info(f"✓ Loaded {len(df)} ingredients")
    
    # Initialize classifier
    classifier = IngredientClassifier()
    
    # Classify each ingredient
    logger.info("\n[2/3] Classifying ingredients into domain categories...")
    
    results = []
    for idx, row in df.iterrows():
        our_category, ing_type = classifier.classify_ingredient(
            row['ingredient_name'],
            row['alternative_names'],
            row['category']
        )
        
        harm_level = classifier.assign_harm_level(our_category, row['ingredient_name'])
        
        results.append({
            'ingredient_name': row['ingredient_name'],
            'e_number': row['alternative_names'],
            'regulatory_category': row['category'],  # Original EFSA/FDA category
            'our_category': our_category,  # Our domain category
            'type': ing_type,  # natural/artificial/processed
            'harm_level': harm_level,
            'source': row['source'],
            'reference': row['reference']
        })
        
        if (idx + 1) % 50 == 0:
            logger.info(f"  Processed {idx + 1}/{len(df)} ingredients...")
    
    # Create DataFrame
    classified_df = pd.DataFrame(results)
    
    # Save to CSV
    logger.info("\n[3/3] Saving classified data...")
    output_path = 'classified_ingredients.csv'
    classified_df.to_csv(output_path, index=False, encoding='utf-8')
    
    # Print summary
    logger.info("\n" + "=" * 60)
    logger.info("CLASSIFICATION COMPLETE")
    logger.info("=" * 60)
    logger.info(f"Total ingredients classified: {len(classified_df)}")
    logger.info(f"Output saved to: {output_path}")
    
    logger.info("\nBreakdown by our categories:")
    logger.info(classified_df['our_category'].value_counts().to_string())
    
    logger.info("\nBreakdown by type:")
    logger.info(classified_df['type'].value_counts().to_string())
    
    logger.info("\nBreakdown by harm level:")
    logger.info(classified_df['harm_level'].value_counts().to_string())
    
    logger.info("\nSample classified data:")
    print(classified_df[['ingredient_name', 'e_number', 'our_category', 'harm_level']].head(15).to_string())
    
    # Flag unclassified
    unclassified = classified_df[classified_df['our_category'] == 'other']
    if len(unclassified) > 0:
        logger.warning(f"\n⚠ {len(unclassified)} ingredients classified as 'other' - may need manual review:")
        print(unclassified[['ingredient_name', 'regulatory_category']].head(10).to_string())
    
    logger.info("\n✓ Step 2 Complete! Next: Step 3 - Assign detailed harm level justifications")


if __name__ == "__main__":
    main()
