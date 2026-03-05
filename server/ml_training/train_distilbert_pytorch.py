"""
Fine-tune DistilBERT for Ingredient Classification (PyTorch Version)

Trains a custom DistilBERT model to classify ingredients into 19 domain-specific categories.
Uses PyTorch for training - compatible with Google Colab GPU.

Dataset: train.csv, val.csv, test.csv (9,481 total samples)
Output: Trained model for deployment to ml_engine.py
"""

import os
import sys
import json
import logging
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple
from datetime import datetime
from tqdm import tqdm

# PyTorch and Transformers
try:
    import torch
    from torch.utils.data import Dataset, DataLoader
    from torch.optim import AdamW
    from transformers import (
        DistilBertTokenizer, 
        DistilBertForSequenceClassification,
        get_linear_schedule_with_warmup
    )
    PYTORCH_AVAILABLE = True
except ImportError as e:
    print(f"❌ Error: Required packages not installed")
    print(f"Missing: {e}")
    print("\nInstall with:")
    print("  pip install torch transformers")
    sys.exit(1)

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Training configuration
CONFIG = {
    'model_name': 'distilbert-base-uncased',
    'max_length': 64,
    'batch_size': 32,
    'epochs': 4,
    'learning_rate': 2e-5,
    'warmup_steps': 100,
    'weight_decay': 0.01,
    'output_dir': 'distilbert_ingredient_classifier',
    'seed': 42
}

# Set seeds for reproducibility
torch.manual_seed(CONFIG['seed'])
np.random.seed(CONFIG['seed'])


class IngredientDataset(Dataset):
    """PyTorch Dataset for ingredients"""
    
    def __init__(self, texts: List[str], labels: List[int], tokenizer, max_length: int):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length
    
    def __len__(self):
        return len(self.texts)
    
    def __getitem__(self, idx):
        text = self.texts[idx]
        label = self.labels[idx]
        
        encoding = self.tokenizer(
            text,
            max_length=self.max_length,
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        )
        
        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'labels': torch.tensor(label, dtype=torch.long)
        }


class IngredientDataProcessor:
    """Process ingredient data for training"""
    
    def __init__(self):
        self.label_to_id = {}
        self.id_to_label = {}
        self.num_labels = 0
    
    def load_data(self, train_file: str, val_file: str, test_file: str) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """Load train, validation, and test datasets"""
        logger.info("\n" + "=" * 60)
        logger.info("STEP 1: LOADING DATA")
        logger.info("=" * 60)
        logger.info("\nLoading datasets...")
        
        train_df = pd.read_csv(train_file)
        val_df = pd.read_csv(val_file)
        test_df = pd.read_csv(test_file)
        
        logger.info(f"✓ Train set: {len(train_df)} samples")
        logger.info(f"✓ Validation set: {len(val_df)} samples")
        logger.info(f"✓ Test set: {len(test_df)} samples")
        logger.info(f"✓ Total: {len(train_df) + len(val_df) + len(test_df)} samples")
        
        return train_df, val_df, test_df
    
    def create_label_mapping(self, df: pd.DataFrame):
        """Create mapping between category names and integer labels"""
        logger.info("\n" + "=" * 60)
        logger.info("STEP 2: CREATING LABEL MAPPING")
        logger.info("=" * 60)
        
        # Get unique categories
        categories = sorted(df['our_category'].unique())
        self.num_labels = len(categories)
        
        # Create bidirectional mapping
        self.label_to_id = {label: idx for idx, label in enumerate(categories)}
        self.id_to_label = {idx: label for label, idx in self.label_to_id.items()}
        
        logger.info(f"\n✓ Found {self.num_labels} unique categories")
        logger.info("\nLabel mapping:")
        for idx, label in self.id_to_label.items():
            logger.info(f"   {idx}: {label}")
        
        # Save label mapping
        os.makedirs(CONFIG['output_dir'], exist_ok=True)
        mapping_path = os.path.join(CONFIG['output_dir'], 'label_mapping.json')
        with open(mapping_path, 'w') as f:
            json.dump({
                'label_to_id': self.label_to_id,
                'id_to_label': self.id_to_label,
                'num_labels': self.num_labels
            }, f, indent=2)
        logger.info(f"\n✓ Label mapping saved to: {mapping_path}")
    
    def preprocess_data(self, df: pd.DataFrame) -> Tuple[List[str], List[int]]:
        """Extract texts and convert labels to integers"""
        texts = df['ingredient_name'].tolist()
        labels = [self.label_to_id[cat] for cat in df['our_category']]
        return texts, labels
    
    def get_class_distribution(self, df: pd.DataFrame, split_name: str):
        """Show class distribution"""
        logger.info(f"\n{split_name} set class distribution:")
        dist = df['our_category'].value_counts()
        for cat, count in dist.items():
            pct = (count / len(df)) * 100
            logger.info(f"  {cat}: {count} ({pct:.1f}%)")


def train_epoch(model, dataloader, optimizer, scheduler, device):
    """Train for one epoch"""
    model.train()
    total_loss = 0
    correct = 0
    total = 0
    
    progress_bar = tqdm(dataloader, desc="Training")
    for batch in progress_bar:
        # Move batch to device
        input_ids = batch['input_ids'].to(device)
        attention_mask = batch['attention_mask'].to(device)
        labels = batch['labels'].to(device)
        
        # Forward pass
        outputs = model(
            input_ids=input_ids,
            attention_mask=attention_mask,
            labels=labels
        )
        
        loss = outputs.loss
        logits = outputs.logits
        
        # Backward pass
        optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        scheduler.step()
        
        # Track metrics
        total_loss += loss.item()
        predictions = torch.argmax(logits, dim=1)
        correct += (predictions == labels).sum().item()
        total += labels.size(0)
        
        # Update progress bar
        progress_bar.set_postfix({
            'loss': f'{loss.item():.4f}',
            'acc': f'{correct/total:.4f}'
        })
    
    avg_loss = total_loss / len(dataloader)
    accuracy = correct / total
    return avg_loss, accuracy


def evaluate(model, dataloader, device):
    """Evaluate model on validation/test set"""
    model.eval()
    total_loss = 0
    correct = 0
    total = 0
    
    with torch.no_grad():
        for batch in tqdm(dataloader, desc="Evaluating"):
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            labels = batch['labels'].to(device)
            
            outputs = model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                labels=labels
            )
            
            loss = outputs.loss
            logits = outputs.logits
            
            total_loss += loss.item()
            predictions = torch.argmax(logits, dim=1)
            correct += (predictions == labels).sum().item()
            total += labels.size(0)
    
    avg_loss = total_loss / len(dataloader)
    accuracy = correct / total
    return avg_loss, accuracy


def main():
    """Main training pipeline"""
    logger.info("\n" + "=" * 60)
    logger.info("DISTILBERT INGREDIENT CLASSIFIER - TRAINING (PYTORCH)")
    logger.info("=" * 60)
    logger.info(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Check GPU
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    logger.info(f"\nDevice: {device}")
    if torch.cuda.is_available():
        logger.info(f"✓ GPU available: {torch.cuda.get_device_name(0)}")
        logger.info(f"  Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")
    else:
        logger.info("⚠ No GPU detected - training will use CPU (slower)")
    
    # Display configuration
    logger.info("\nTraining configuration:")
    for key, value in CONFIG.items():
        logger.info(f"  {key}: {value}")
    
    # Initialize data processor
    processor = IngredientDataProcessor()
    
    # STEP 1 & 2: Load data and create label mapping
    train_df, val_df, test_df = processor.load_data('train.csv', 'val.csv', 'test.csv')
    processor.create_label_mapping(train_df)
    
    # Show class distributions
    processor.get_class_distribution(train_df, "Train")
    processor.get_class_distribution(val_df, "Validation")
    processor.get_class_distribution(test_df, "Test")
    
    # Preprocess data
    logger.info("\n" + "=" * 60)
    logger.info("PREPROCESSING DATA")
    logger.info("=" * 60)
    
    train_texts, train_labels = processor.preprocess_data(train_df)
    val_texts, val_labels = processor.preprocess_data(val_df)
    test_texts, test_labels = processor.preprocess_data(test_df)
    
    logger.info(f"\n✓ Extracted {len(train_texts)} training texts")
    logger.info(f"✓ Extracted {len(val_texts)} validation texts")
    logger.info(f"✓ Extracted {len(test_texts)} test texts")
    
    # STEP 3: Load tokenizer
    logger.info("\n" + "=" * 60)
    logger.info("STEP 3: LOAD TOKENIZER")
    logger.info("=" * 60)
    
    logger.info(f"\nLoading tokenizer: {CONFIG['model_name']}")
    tokenizer = DistilBertTokenizer.from_pretrained(CONFIG['model_name'])
    logger.info(f"✓ Tokenizer loaded")
    logger.info(f"  Vocabulary size: {tokenizer.vocab_size}")
    
    # Save tokenizer
    tokenizer_path = os.path.join(CONFIG['output_dir'], 'tokenizer')
    tokenizer.save_pretrained(tokenizer_path)
    logger.info(f"✓ Tokenizer saved to: {tokenizer_path}")
    
    # STEP 4: Create datasets and dataloaders
    logger.info("\n" + "=" * 60)
    logger.info("STEP 4: CREATE DATASETS")
    logger.info("=" * 60)
    
    logger.info("\nCreating PyTorch datasets...")
    train_dataset = IngredientDataset(train_texts, train_labels, tokenizer, CONFIG['max_length'])
    val_dataset = IngredientDataset(val_texts, val_labels, tokenizer, CONFIG['max_length'])
    test_dataset = IngredientDataset(test_texts, test_labels, tokenizer, CONFIG['max_length'])
    
    train_loader = DataLoader(train_dataset, batch_size=CONFIG['batch_size'], shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=CONFIG['batch_size'])
    test_loader = DataLoader(test_dataset, batch_size=CONFIG['batch_size'])
    
    logger.info(f"✓ Training dataset: {len(train_dataset)} samples, {len(train_loader)} batches")
    logger.info(f"✓ Validation dataset: {len(val_dataset)} samples, {len(val_loader)} batches")
    logger.info(f"✓ Test dataset: {len(test_dataset)} samples, {len(test_loader)} batches")
    
    # STEP 5: Load model
    logger.info("\n" + "=" * 60)
    logger.info("STEP 5: LOAD PRE-TRAINED MODEL")
    logger.info("=" * 60)
    
    logger.info(f"\nLoading model: {CONFIG['model_name']}")
    logger.info(f"Number of labels: {processor.num_labels}")
    
    model = DistilBertForSequenceClassification.from_pretrained(
        CONFIG['model_name'],
        num_labels=processor.num_labels
    )
    model.to(device)
    logger.info("✓ Model loaded successfully")
    
    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    logger.info(f"  Total parameters: {total_params:,}")
    logger.info(f"  Trainable parameters: {trainable_params:,}")
    
    # STEP 6: Setup optimizer and scheduler
    logger.info("\n" + "=" * 60)
    logger.info("STEP 6: SETUP OPTIMIZER")
    logger.info("=" * 60)
    
    total_steps = len(train_loader) * CONFIG['epochs']
    logger.info(f"\nTotal training steps: {total_steps}")
    logger.info(f"Warmup steps: {CONFIG['warmup_steps']}")
    
    optimizer = AdamW(
        model.parameters(),
        lr=CONFIG['learning_rate'],
        weight_decay=CONFIG['weight_decay']
    )
    
    scheduler = get_linear_schedule_with_warmup(
        optimizer,
        num_warmup_steps=CONFIG['warmup_steps'],
        num_training_steps=total_steps
    )
    
    logger.info("✓ AdamW optimizer created")
    logger.info(f"  Learning rate: {CONFIG['learning_rate']}")
    logger.info(f"  Weight decay: {CONFIG['weight_decay']}")
    
    # STEP 7: Training
    logger.info("\n" + "=" * 60)
    logger.info("STEP 7: TRAINING")
    logger.info("=" * 60)
    
    best_val_loss = float('inf')
    best_val_acc = 0
    patience_counter = 0
    patience = 2
    
    for epoch in range(CONFIG['epochs']):
        logger.info(f"\n{'='*60}")
        logger.info(f"Epoch {epoch + 1}/{CONFIG['epochs']}")
        logger.info(f"{'='*60}")
        
        # Train
        train_loss, train_acc = train_epoch(model, train_loader, optimizer, scheduler, device)
        logger.info(f"\nTrain Loss: {train_loss:.4f} | Train Acc: {train_acc:.4f}")
        
        # Validate
        val_loss, val_acc = evaluate(model, val_loader, device)
        logger.info(f"Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.4f}")
        
        # Save best model
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_val_loss = val_loss
            patience_counter = 0
            
            # Save model
            model_path = os.path.join(CONFIG['output_dir'], 'model')
            model.save_pretrained(model_path)
            logger.info(f"✓ Best model saved (Val Acc: {val_acc:.4f})")
        else:
            patience_counter += 1
            logger.info(f"No improvement (patience: {patience_counter}/{patience})")
        
        # Early stopping
        if patience_counter >= patience:
            logger.info(f"\nEarly stopping triggered after epoch {epoch + 1}")
            break
    
    logger.info("\n" + "=" * 60)
    logger.info("STEP 7 COMPLETE")
    logger.info("=" * 60)
    logger.info(f"✓ Training finished")
    logger.info(f"  Best Val Acc: {best_val_acc:.4f}")
    logger.info(f"  Best Val Loss: {best_val_loss:.4f}")
    
    # STEP 8: Final evaluation on test set
    logger.info("\n" + "=" * 60)
    logger.info("STEP 8: EVALUATION ON TEST SET")
    logger.info("=" * 60)
    
    # Load best model
    model = DistilBertForSequenceClassification.from_pretrained(
        os.path.join(CONFIG['output_dir'], 'model')
    )
    model.to(device)
    
    test_loss, test_acc = evaluate(model, test_loader, device)
    logger.info(f"\nTest Results:")
    logger.info(f"  Test Loss: {test_loss:.4f}")
    logger.info(f"  Test Accuracy: {test_acc:.4f}")
    
    logger.info("\n" + "=" * 60)
    logger.info("TRAINING COMPLETE")
    logger.info("=" * 60)
    logger.info(f"\nModel saved to: {CONFIG['output_dir']}/")
    logger.info(f"  - model/: Trained weights")
    logger.info(f"  - tokenizer/: Tokenizer files")
    logger.info(f"  - label_mapping.json: Category mappings")
    
    return model, tokenizer, processor


if __name__ == "__main__":
    results = main()
    logger.info("\n✅ All steps completed successfully!")
