#!/usr/bin/env python3
"""
Simple local scoring API wrapper around scoring_engine.py

Usage (development):
  python server/score_api.py

Then POST JSON to http://127.0.0.1:5000/analyze with body:
  { "barcode": "0123456789012", "userProfile": { "allergies": ["milk"], "conditions": ["diabetes"] } }

The API will call scoring_engine.robust_fetch_from_openfoodfacts and analyze_product_engine
and return the analysis JSON.

Note: This is a local development helper. For production, you should deploy this as a
server (Cloud Run / Cloud Function) behind authentication and HTTPS.
"""
import json
from flask import Flask, request, jsonify
import logging
import os
import sys

ROOT = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, ROOT)

try:
    import scoring_engine as engine
except Exception as e:
    raise RuntimeError(f"Failed to import scoring_engine: {e}")

# Import ML-enhanced scoring system
try:
    from unified_scoring import calculate_unified_score
    ML_AVAILABLE = True
    logging.info("ML-enhanced scoring system loaded")
except Exception as e:
    ML_AVAILABLE = False
    logging.warning(f"ML scoring not available, falling back to legacy: {e}")

# Import personalized scoring system (0-100 scale with evidence-based thresholds)
try:
    from ml_engine import ml_analyze_product
    from personalized_scoring import calculate_personalized_score
    PERSONALIZED_SCORING_AVAILABLE = True
    logging.info("Personalized scoring system loaded (0-100 scale)")
except Exception as e:
    PERSONALIZED_SCORING_AVAILABLE = False
    logging.warning(f"Personalized scoring not available: {e}")

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)


@app.route('/analyze', methods=['POST'])
def analyze():
    payload = request.get_json(force=True)
    barcode = payload.get('barcode')
    user_profile = payload.get('userProfile') or {}

    if not barcode:
        return jsonify({"error": "barcode required"}), 400

    # set USER_PROFILE for the engine
    try:
        engine.USER_PROFILE['allergies'] = [a.lower() for a in (user_profile.get('allergies') or [])]
        engine.USER_PROFILE['conditions'] = [c.lower() for c in (user_profile.get('conditions') or [])]
    except Exception:
        engine.USER_PROFILE['allergies'] = []
        engine.USER_PROFILE['conditions'] = []

    product, ingredients_text, nutrients = engine.robust_fetch_from_openfoodfacts(barcode)
    if not product:
        return jsonify({"error": "product_not_found"}), 404

    try:
        result = engine.analyze_product_engine(product, ingredients_text or "", nutrients or {})
        # Try to attach extracted ingredients/additives
        ingredients, additives = engine.extract_ingredients_and_additives(product, ingredients_text or "")
        result['ingredients'] = ingredients
        result['additives'] = additives
        return jsonify(result)
    except Exception as e:
        logging.exception('Scoring failed')
        return jsonify({"error": "scoring_failed", "message": str(e)}), 500


@app.route('/ml-score', methods=['POST'])
def ml_score():
    """
    ML-enhanced scoring endpoint
    Expects: { "product": {...}, "userProfile": {...} }
    """
    if not ML_AVAILABLE:
        return jsonify({"error": "ML scoring not available"}), 503
    
    payload = request.get_json(force=True)
    product_data = payload.get('product')
    user_profile = payload.get('userProfile') or {}
    
    if not product_data:
        return jsonify({"error": "product data required"}), 400
    
    try:
        result = calculate_unified_score(product_data, user_profile)
        return jsonify(result)
    except Exception as e:
        logging.exception('ML scoring failed')
        return jsonify({"error": "ml_scoring_failed", "message": str(e)}), 500


@app.route('/personalized-score', methods=['POST'])
def personalized_score():
    """
    Personalized scoring endpoint (0-100 scale with evidence-based thresholds)
    Expects: { 
        "product": {...}, 
        "userProfile": {"conditions": ["diabetes"], "allergies": ["peanuts"]}
    }
    Returns: Comprehensive score with breakdown, penalties, bonuses, recommendations
    """
    if not PERSONALIZED_SCORING_AVAILABLE:
        return jsonify({"error": "Personalized scoring not available"}), 503
    
    payload = request.get_json(force=True)
    product_data = payload.get('product')
    user_profile = payload.get('userProfile') or payload.get('user_profile') or {"conditions": [], "allergies": []}
    
    if not product_data:
        return jsonify({"error": "product data required"}), 400
    
    try:
        # Step 1: Get ML analysis
        ml_results = ml_analyze_product(product_data)
        
        # Step 2: Extract nutrients
        nutrients = product_data.get('nutriments', {}) or product_data.get('nutritional_info', {})
        
        # Step 3: Parse ingredients list for position weighting
        ingredients_raw = product_data.get('ingredients_text', '') or product_data.get('ingredients', '')
        if isinstance(ingredients_raw, list):
            ingredients_list = [ing.strip() for ing in ingredients_raw if ing.strip()]
        elif isinstance(ingredients_raw, str) and ingredients_raw:
            ingredients_list = [ing.strip() for ing in ingredients_raw.split(',')]
        else:
            ingredients_list = None
        
        # Step 4: Calculate personalized score
        result = calculate_personalized_score(
            ml_results,
            nutrients,
            ingredients_list,
            user_profile
        )
        
        # Add product info to response
        result['product_name'] = product_data.get('product_name', 'Unknown')
        result['barcode'] = product_data.get('code', '')
        
        # Map field names for frontend compatibility
        result['label'] = result.get('score_label', result.get('label', ''))
        result['color'] = result.get('score_color', result.get('color', ''))
        
        return jsonify(result)
    except Exception as e:
        logging.exception('Personalized scoring failed')
        return jsonify({"error": "personalized_scoring_failed", "message": str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "ml_available": ML_AVAILABLE,
        "personalized_scoring_available": PERSONALIZED_SCORING_AVAILABLE,
        "version": "3.0-personalized-scoring",
        "endpoints": {
            "/analyze": "Legacy scoring (0-10 scale)",
            "/ml-score": "ML-enhanced scoring",
            "/personalized-score": "Personalized scoring (0-100 scale with user profiles)"
        }
    })


if __name__ == '__main__':
    port = int(os.environ.get('SCORE_API_PORT', 5000))
    # Bind to 0.0.0.0 by default so mobile devices on the same LAN can reach this dev server.
    host = os.environ.get('SCORE_API_HOST', '0.0.0.0')

    # Helpful startup message with guidance for Expo Go
    logging.info('='*70)
    logging.info('Starting scoring API (dev) - PERSONALIZED SCORING v3.0')
    logging.info('='*70)
    logging.info('Features:')
    logging.info('  - ML Classification: %s', 'ENABLED' if ML_AVAILABLE else 'DISABLED')
    logging.info('  - Personalized Scoring (0-100): %s', 'ENABLED' if PERSONALIZED_SCORING_AVAILABLE else 'DISABLED')
    logging.info('')
    logging.info('Endpoints:')
    logging.info('  POST /analyze              - Legacy scoring (0-10 scale)')
    logging.info('  POST /ml-score             - ML-enhanced scoring')
    logging.info('  POST /personalized-score   - Personalized scoring with user profiles')
    logging.info('  GET  /health               - Health check')
    logging.info('')
    logging.info('Mobile Access:')
    logging.info('  Android Emulator:  http://10.0.2.2:%d/personalized-score', port)
    logging.info('  Same LAN:         http://<YOUR_COMPUTER_IP>:%d/personalized-score', port)
    logging.info('  Localhost:        http://127.0.0.1:%d/personalized-score', port)
    logging.info('='*70)

    app.run(host=host, port=port, debug=False)
