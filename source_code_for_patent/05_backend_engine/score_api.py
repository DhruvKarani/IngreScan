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


if __name__ == '__main__':
    port = int(os.environ.get('SCORE_API_PORT', 5000))
    # Bind to 0.0.0.0 by default so mobile devices on the same LAN can reach this dev server.
    host = os.environ.get('SCORE_API_HOST', '0.0.0.0')

    # Helpful startup message with guidance for Expo Go
    logging.info('Starting scoring API (dev)')
    logging.info('If you want to call this from Expo Go on a mobile device, set SCORE_API_URL in the app to:')
    logging.info("  http://<YOUR_COMPUTER_LAN_IP>:%d/analyze  (or use http://10.0.2.2:%d/analyze for Android emulator)", port, port)
    logging.info('You may need to open your firewall for port %d and ensure the device is on the same network.', port)

    app.run(host=host, port=port, debug=False)
