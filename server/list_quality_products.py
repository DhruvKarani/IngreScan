#!/usr/bin/env python3
"""
Quick script to list high and medium quality products from Firebase.
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("❌ firebase-admin not installed. Run: pip install firebase-admin")
    sys.exit(1)

from server.data_quality_validator import validate_product_data


def init_firebase():
    """Initialize Firebase."""
    cred_path = os.path.join(os.path.dirname(__file__), 'firebase-credentials.json')
    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred, {'projectId': 'ingrescandb'})
        return firestore.client()
    else:
        print("❌ firebase-credentials.json not found")
        sys.exit(1)


def main():
    print("Fetching products from Firebase...\n")
    db = init_firebase()
    
    products_ref = db.collection('products')
    all_products = products_ref.stream()
    
    high_quality = []
    medium_quality = []
    
    for doc in all_products:
        product_id = doc.id
        product_data = doc.to_dict()
        
        validation = validate_product_data(product_data)
        score = validation['completeness_score']
        
        if score >= 90:
            high_quality.append((product_id, product_data.get('product_name', 'N/A'), score))
        elif score >= 70:
            medium_quality.append((product_id, product_data.get('product_name', 'N/A'), score))
    
    # Print results
    print("=" * 80)
    print(f"HIGH QUALITY PRODUCTS (90-100%) - {len(high_quality)} found")
    print("=" * 80)
    for i, (barcode, name, score) in enumerate(sorted(high_quality, key=lambda x: x[2], reverse=True), 1):
        print(f"{i}. {barcode[:20]:<20} | {score:3d}/100 | {name[:45]}")
    
    print("\n" + "=" * 80)
    print(f"MEDIUM QUALITY PRODUCTS (70-89%) - {len(medium_quality)} found")
    print("=" * 80)
    for i, (barcode, name, score) in enumerate(sorted(medium_quality, key=lambda x: x[2], reverse=True), 1):
        print(f"{i}. {barcode[:20]:<20} | {score:3d}/100 | {name[:45]}")
    
    print("\n" + "=" * 80)


if __name__ == '__main__':
    main()
