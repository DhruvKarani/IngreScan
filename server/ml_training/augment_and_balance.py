"""
Step 5: Data Augmentation & Class Balancing

Expands the dataset through realistic variations and balances classes:
- E-number variations (E951, E-951, 951, INS 951)
- Common misspellings (aspartame → aspratame)
- Contextual examples ("contains aspartame")
- Case variations
- Oversample minority classes

Input: augmented_ingredients.csv (220 ingredients)
Output: balanced_training_data.csv (3000-4000 samples)
"""

import pandas as pd
import logging
import random
import re
from typing import List, Dict
from collections import Counter

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

random.seed(42)  # Reproducibility


class DataAugmenter:
    """Generate realistic variations of ingredient names"""
    
    def __init__(self):
        # Common OCR/typing mistakes
        self.char_substitutions = {
            'a': ['a', 'e', 'o'],
            'e': ['e', 'a', 'i'],
            'i': ['i', 'e', 'y'],
            'o': ['o', 'a', 'u'],
            'u': ['u', 'o'],
            's': ['s', 'z'],
            'c': ['c', 'k'],
            'k': ['k', 'c'],
            'ph': ['ph', 'f'],
            'f': ['f', 'ph']
        }
        
        # Contextual templates
        self.context_templates = [
            "contains {ing}",
            "{ing} (E{num})",
            "added {ing}",
            "including {ing}",
            "{ing} as preservative",
            "{ing} as sweetener",
            "{ing} as color",
            "{ing} added",
            "with {ing}",
            "{ing} content"
        ]
    
    def generate_e_number_variations(self, e_number: str) -> List[str]:
        """Generate E-number format variations"""
        if not e_number or not isinstance(e_number, str) or not e_number.startswith('E'):
            return []
        
        num = e_number[1:]  # Remove 'E'
        variations = [
            e_number,           # E951
            f"E-{num}",         # E-951
            f"E {num}",         # E 951
            num,                # 951
            f"INS {num}",       # INS 951
            f"INS-{num}",       # INS-951
            f"INS{num}",        # INS951
            f"E.{num}",         # E.951
        ]
        
        return variations
    
    def generate_misspellings(self, name: str, count: int = 3) -> List[str]:
        """Generate realistic misspellings"""
        if len(name) < 5:  # Don't misspell short words
            return []
        
        misspellings = []
        name_lower = name.lower()
        
        for _ in range(count):
            chars = list(name_lower)
            
            # Random operations
            operations = random.randint(1, 2)
            for _ in range(operations):
                op = random.choice(['substitute', 'delete', 'transpose'])
                
                if op == 'substitute' and len(chars) > 2:
                    # Substitute a vowel
                    vowel_indices = [i for i, c in enumerate(chars) if c in 'aeiou']
                    if vowel_indices:
                        idx = random.choice(vowel_indices)
                        if chars[idx] in self.char_substitutions:
                            chars[idx] = random.choice(self.char_substitutions[chars[idx]])
                
                elif op == 'delete' and len(chars) > 5:
                    # Delete a letter (not first or last)
                    idx = random.randint(1, len(chars) - 2)
                    chars.pop(idx)
                
                elif op == 'transpose' and len(chars) > 3:
                    # Swap adjacent letters
                    idx = random.randint(0, len(chars) - 2)
                    chars[idx], chars[idx + 1] = chars[idx + 1], chars[idx]
            
            misspelled = ''.join(chars)
            if misspelled != name_lower and misspelled not in misspellings:
                misspellings.append(misspelled)
        
        return misspellings[:count]
    
    def generate_case_variations(self, name: str) -> List[str]:
        """Generate case variations"""
        return [
            name.lower(),
            name.upper(),
            name.title(),
            name  # Original case
        ]
    
    def generate_contextual_examples(self, name: str, e_number: str = '') -> List[str]:
        """Generate contextual usage examples"""
        examples = []
        
        # Filter templates based on whether we have E-number
        has_e_number = e_number and isinstance(e_number, str) and e_number.startswith('E')
        available_templates = [t for t in self.context_templates if '{num}' not in t or has_e_number]
        
        if not available_templates:
            return []
        
        # Select random templates
        num_templates = min(3, len(available_templates))
        templates = random.sample(available_templates, num_templates)
        
        for template in templates:
            if '{num}' in template and has_e_number:
                example = template.format(ing=name.lower(), num=e_number[1:])
            else:
                example = template.format(ing=name.lower())
            examples.append(example)
        
        return examples
    
    def augment_ingredient(self, name: str, e_number: str, target_samples: int = 15) -> List[str]:
        """Generate multiple variations of an ingredient"""
        variations = set()
        
        # Original
        variations.add(name)
        variations.add(name.lower())
        
        # E-number variations
        if e_number and isinstance(e_number, str) and e_number.startswith('E'):
            variations.update(self.generate_e_number_variations(e_number))
        
        # Case variations
        variations.update(self.generate_case_variations(name))
        
        # Misspellings
        misspellings = self.generate_misspellings(name, count=5)
        variations.update(misspellings)
        
        # Contextual examples
        contextual = self.generate_contextual_examples(name, e_number)
        variations.update(contextual)
        
        # Convert to list and limit
        variations_list = list(variations)
        
        # If we have more than target, sample randomly
        if len(variations_list) > target_samples:
            # Always keep original
            keep = [name] if name in variations_list else []
            others = [v for v in variations_list if v != name]
            keep.extend(random.sample(others, target_samples - len(keep)))
            return keep
        
        return variations_list


class ClassBalancer:
    """Balance classes for better training"""
    
    def __init__(self, target_min_samples: int = 100):
        self.target_min_samples = target_min_samples
    
    def balance_dataset(self, df: pd.DataFrame, augmenter: DataAugmenter) -> pd.DataFrame:
        """Oversample minority classes to achieve balance"""
        logger.info("Analyzing class distribution...")
        
        # Count samples per category
        category_counts = df['our_category'].value_counts()
        logger.info(f"Original distribution:\n{category_counts.to_string()}")
        
        # Determine target samples per class
        max_count = category_counts.max()
        target_per_class = max(self.target_min_samples, max_count)
        
        logger.info(f"\nTarget samples per class: {target_per_class}")
        
        balanced_data = []
        
        for category in df['our_category'].unique():
            category_df = df[df['our_category'] == category]
            current_count = len(category_df)
            
            if current_count >= target_per_class:
                # Already enough samples
                balanced_data.append(category_df)
                logger.info(f"  {category}: {current_count} samples (sufficient)")
            else:
                # Need to oversample
                needed = target_per_class - current_count
                logger.info(f"  {category}: {current_count} → {target_per_class} samples (adding {needed})")
                
                # Add original data
                balanced_data.append(category_df)
                
                # Generate more variations from existing samples
                samples_to_replicate = category_df.sample(n=needed, replace=True, random_state=42)
                
                # Create variations
                new_rows = []
                for idx, row in samples_to_replicate.iterrows():
                    # Generate one variation
                    e_num = row['e_number'] if pd.notna(row['e_number']) else ''
                    variations = augmenter.augment_ingredient(
                        row['ingredient_name'],
                        str(e_num) if e_num else '',
                        target_samples=2
                    )
                    
                    # Pick a variation different from original
                    variation = random.choice([v for v in variations if v != row['ingredient_name']] or variations)
                    
                    # Create new row with variation
                    new_row = row.copy()
                    new_row['ingredient_name'] = variation
                    new_rows.append(new_row)
                
                new_df = pd.DataFrame(new_rows)
                balanced_data.append(new_df)
        
        # Combine all
        final_df = pd.concat(balanced_data, ignore_index=True)
        
        logger.info(f"\nBalanced distribution:")
        logger.info(final_df['our_category'].value_counts().to_string())
        
        return final_df


def main():
    """Main execution function"""
    logger.info("=" * 60)
    logger.info("STEP 5: DATA AUGMENTATION & CLASS BALANCING")
    logger.info("=" * 60)
    
    # Load augmented data from Step 4
    logger.info("\n[1/4] Loading augmented ingredient data...")
    df = pd.read_csv('augmented_ingredients.csv')
    logger.info(f"✓ Loaded {len(df)} base ingredients")
    logger.info(f"✓ Categories: {df['our_category'].nunique()}")
    
    # Initialize augmenter
    augmenter = DataAugmenter()
    
    # Generate variations for ALL ingredients
    logger.info("\n[2/4] Generating augmented variations...")
    augmented_rows = []
    
    for idx, row in df.iterrows():
        # Generate variations (10-15 per ingredient)
        e_num = row['e_number'] if pd.notna(row['e_number']) else ''
        variations = augmenter.augment_ingredient(
            row['ingredient_name'],
            str(e_num) if e_num else '',
            target_samples=12
        )
        
        # Create a row for each variation
        for variation in variations:
            new_row = row.copy()
            new_row['ingredient_name'] = variation
            augmented_rows.append(new_row)
        
        if (idx + 1) % 50 == 0:
            logger.info(f"  Processed {idx + 1}/{len(df)} ingredients...")
    
    augmented_df = pd.DataFrame(augmented_rows)
    logger.info(f"✓ Generated {len(augmented_df)} augmented samples (avg {len(augmented_df)/len(df):.1f} per ingredient)")
    
    # Balance classes
    logger.info("\n[3/4] Balancing classes...")
    balancer = ClassBalancer(target_min_samples=100)
    balanced_df = balancer.balance_dataset(augmented_df, augmenter)
    
    # Shuffle dataset
    balanced_df = balanced_df.sample(frac=1, random_state=42).reset_index(drop=True)
    
    # Save
    logger.info("\n[4/4] Saving balanced training data...")
    output_path = 'balanced_training_data.csv'
    balanced_df.to_csv(output_path, index=False, encoding='utf-8')
    
    # Print summary
    logger.info("\n" + "=" * 60)
    logger.info("DATA AUGMENTATION & BALANCING COMPLETE")
    logger.info("=" * 60)
    logger.info(f"Total training samples: {len(balanced_df)}")
    logger.info(f"  - Base ingredients: {len(df)}")
    logger.info(f"  - Augmentation factor: {len(balanced_df)/len(df):.1f}x")
    logger.info(f"Output saved to: {output_path}")
    
    logger.info("\nFinal class distribution:")
    logger.info(balanced_df['our_category'].value_counts().to_string())
    
    logger.info("\nSample augmented data:")
    sample = balanced_df[['ingredient_name', 'our_category', 'harm_level']].head(15)
    print("\n" + sample.to_string())
    
    logger.info(f"\n✓ Dataset ready for training!")
    logger.info(f"✓ Balanced across {balanced_df['our_category'].nunique()} categories")
    logger.info(f"✓ {len(balanced_df)} total samples")
    
    logger.info("\n✓ Step 5 Complete! Next: Step 6 - Train/val/test split")


if __name__ == "__main__":
    main()
