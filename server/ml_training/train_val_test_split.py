"""
Step 6: Train/Validation/Test Split

Splits balanced dataset into:
- Train (70%): For model training
- Validation (15%): For hyperparameter tuning and early stopping
- Test (15%): For final model evaluation

Uses stratified split to maintain class distribution across all sets.

Input: balanced_training_data.csv (9,481 samples)
Output: train.csv, val.csv, test.csv
"""

import pandas as pd
import logging
from sklearn.model_selection import train_test_split
from collections import Counter

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def analyze_split_distribution(df: pd.DataFrame, name: str) -> None:
    """Print distribution statistics for a dataset split"""
    logger.info(f"\n{name} Set Statistics:")
    logger.info(f"  Total samples: {len(df)}")
    logger.info(f"  Categories: {df['our_category'].nunique()}")
    
    # Category distribution
    category_dist = df['our_category'].value_counts()
    logger.info(f"\n  Category distribution:")
    for cat, count in category_dist.items():
        pct = (count / len(df)) * 100
        logger.info(f"    {cat}: {count} ({pct:.1f}%)")
    
    # Harm level distribution
    harm_dist = df['harm_level'].value_counts()
    logger.info(f"\n  Harm level distribution:")
    for harm, count in harm_dist.items():
        pct = (count / len(df)) * 100
        logger.info(f"    {harm}: {count} ({pct:.1f}%)")


def verify_stratification(train_df: pd.DataFrame, val_df: pd.DataFrame, test_df: pd.DataFrame) -> None:
    """Verify that class distributions are similar across splits"""
    logger.info("\n" + "=" * 60)
    logger.info("STRATIFICATION VERIFICATION")
    logger.info("=" * 60)
    
    # Get category percentages for each split
    train_pcts = (train_df['our_category'].value_counts() / len(train_df) * 100).sort_index()
    val_pcts = (val_df['our_category'].value_counts() / len(val_df) * 100).sort_index()
    test_pcts = (test_df['our_category'].value_counts() / len(test_df) * 100).sort_index()
    
    logger.info("\nCategory distribution across splits (%):")
    logger.info(f"{'Category':<30} {'Train':>8} {'Val':>8} {'Test':>8} {'Max Diff':>10}")
    logger.info("-" * 70)
    
    max_diffs = []
    for cat in train_pcts.index:
        train_pct = train_pcts.get(cat, 0)
        val_pct = val_pcts.get(cat, 0)
        test_pct = test_pcts.get(cat, 0)
        max_diff = max(abs(train_pct - val_pct), abs(val_pct - test_pct), abs(train_pct - test_pct))
        max_diffs.append(max_diff)
        
        logger.info(f"{cat:<30} {train_pct:>7.1f}% {val_pct:>7.1f}% {test_pct:>7.1f}% {max_diff:>9.1f}%")
    
    avg_diff = sum(max_diffs) / len(max_diffs)
    logger.info(f"\nAverage max difference: {avg_diff:.2f}%")
    
    if avg_diff < 2.0:
        logger.info("✓ Excellent stratification (avg diff < 2%)")
    elif avg_diff < 5.0:
        logger.info("✓ Good stratification (avg diff < 5%)")
    else:
        logger.warning("⚠ Stratification could be improved (avg diff >= 5%)")


def main():
    """Main execution function"""
    logger.info("=" * 60)
    logger.info("STEP 6: TRAIN/VALIDATION/TEST SPLIT")
    logger.info("=" * 60)
    
    # Load balanced data from Step 5
    logger.info("\n[1/4] Loading balanced training data...")
    df = pd.read_csv('balanced_training_data.csv')
    logger.info(f"✓ Loaded {len(df)} samples")
    logger.info(f"✓ Categories: {df['our_category'].nunique()}")
    logger.info(f"✓ Columns: {list(df.columns)}")
    
    # Verify data quality
    logger.info("\nData quality check:")
    logger.info(f"  Missing values: {df.isnull().sum().sum()}")
    logger.info(f"  Duplicate ingredient names: {df['ingredient_name'].duplicated().sum()}")
    
    # Perform stratified split
    logger.info("\n[2/4] Performing stratified split...")
    logger.info("  Split ratios: Train=70%, Val=15%, Test=15%")
    
    # First split: 70% train, 30% temp (val+test)
    train_df, temp_df = train_test_split(
        df,
        test_size=0.30,
        random_state=42,
        stratify=df['our_category']  # Stratify by category
    )
    
    # Second split: 50% val, 50% test from temp (15% each of total)
    val_df, test_df = train_test_split(
        temp_df,
        test_size=0.50,
        random_state=42,
        stratify=temp_df['our_category']
    )
    
    logger.info(f"✓ Train set: {len(train_df)} samples ({len(train_df)/len(df)*100:.1f}%)")
    logger.info(f"✓ Validation set: {len(val_df)} samples ({len(val_df)/len(df)*100:.1f}%)")
    logger.info(f"✓ Test set: {len(test_df)} samples ({len(test_df)/len(df)*100:.1f}%)")
    
    # Analyze distributions
    logger.info("\n[3/4] Analyzing split distributions...")
    analyze_split_distribution(train_df, "Train")
    analyze_split_distribution(val_df, "Validation")
    analyze_split_distribution(test_df, "Test")
    
    # Verify stratification
    verify_stratification(train_df, val_df, test_df)
    
    # Save splits
    logger.info("\n[4/4] Saving dataset splits...")
    
    train_path = 'train.csv'
    val_path = 'val.csv'
    test_path = 'test.csv'
    
    train_df.to_csv(train_path, index=False, encoding='utf-8')
    val_df.to_csv(val_path, index=False, encoding='utf-8')
    test_df.to_csv(test_path, index=False, encoding='utf-8')
    
    logger.info(f"✓ Train set saved to: {train_path}")
    logger.info(f"✓ Validation set saved to: {val_path}")
    logger.info(f"✓ Test set saved to: {test_path}")
    
    # Print summary
    logger.info("\n" + "=" * 60)
    logger.info("TRAIN/VAL/TEST SPLIT COMPLETE")
    logger.info("=" * 60)
    logger.info(f"Total samples: {len(df)}")
    logger.info(f"  Train: {len(train_df)} samples (70.0%)")
    logger.info(f"  Val: {len(val_df)} samples (15.0%)")
    logger.info(f"  Test: {len(test_df)} samples (15.0%)")
    
    logger.info("\nSample data from train set:")
    sample = train_df[['ingredient_name', 'our_category', 'harm_level']].head(10)
    print("\n" + sample.to_string())

    logger.info("\n📊 Final Dataset Statistics:")
    logger.info(f"  Training samples: {len(train_df)}")
    logger.info(f"  Validation samples: {len(val_df)}")
    logger.info(f"  Test samples: {len(test_df)}")
    logger.info(f"  Categories: {df['our_category'].nunique()}")
    logger.info(f"  Samples per category: ~{len(train_df) // df['our_category'].nunique()}")
    

if __name__ == "__main__":
    main()
