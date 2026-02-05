import os
import sys
import webbrowser
from flask import Flask, send_from_directory, jsonify, request
import logging
from threading import Timer

# Adjust path to find scoring_engine in parent directory
# Adjust path to find scoring_engine in parent directory
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

if getattr(sys, 'frozen', False):
    # Running in PyInstaller bundle
    # sys._MEIPASS is the root of the bundle
    # scoring_engine should be importable directly if bundled correctly
    bundle_dir = sys._MEIPASS
    sys.path.insert(0, bundle_dir) # Ensure root is in path
    import scoring_engine as engine
    DIST_DIR = os.path.join(bundle_dir, 'dist')
else:
    # Running locally
    PARENT_DIR = os.path.dirname(ROOT_DIR)
    sys.path.insert(0, PARENT_DIR)
    try:
        import scoring_engine as engine
    except ImportError:
        sys.path.insert(0, ROOT_DIR)
        import scoring_engine as engine
    DIST_DIR = os.path.join(PARENT_DIR, 'dist')

app = Flask(__name__, static_folder=DIST_DIR)

# Ensure MIME types are correct
import mimetypes
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')

# Configure logging to show in terminal
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger()

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    # Check if path exists in dist folder
    if path != "" and os.path.exists(os.path.join(DIST_DIR, path)):
        return send_from_directory(DIST_DIR, path)
    # Otherwise serve index.html (SPA fallback)
    return send_from_directory(DIST_DIR, 'index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    # ... Same logic as score_api.py ...
    try:
        logger.info(f"Analyze request received")
        payload = request.get_json(force=True)
        barcode = payload.get('barcode')
        user_profile = payload.get('userProfile') or {}

        if not barcode:
            return jsonify({"error": "barcode required"}), 400

        # Update engine profile with fallbacks for different key names
        conditions = user_profile.get('conditions') or user_profile.get('healthConditions') or []
        allergies = user_profile.get('allergies') or user_profile.get('allergens') or []
        
        engine.USER_PROFILE['conditions'] = [str(c).lower() for c in conditions]
        engine.USER_PROFILE['allergies'] = [str(a).lower() for a in allergies]
        
        logger.info(f"Using profile: conditions={engine.USER_PROFILE['conditions']}, allergies={engine.USER_PROFILE['allergies']}")

        product, ingredients_text, nutrients = engine.robust_fetch_from_openfoodfacts(barcode)
        if not product:
            return jsonify({"error": "product_not_found"}), 404

        result = engine.analyze_product_engine(product, ingredients_text or "", nutrients or {})
        ingredients, additives = engine.extract_ingredients_and_additives(product, ingredients_text or "")
        result['ingredients'] = ingredients
        result['additives'] = additives
        
        return jsonify(result)
    except Exception as e:
        logger.exception('Scoring failed')
        return jsonify({"error": "scoring_failed", "message": str(e)}), 500

def open_browser():
    url = 'http://127.0.0.1:5000/'
    logger.info(f"Opening browser at {url}")
    webbrowser.open_new(url)

if __name__ == '__main__':
    print("---------------------------------------------------")
    print("IngreScan Server Starting...")
    print("Do NOT close this window while using the app.")
    print("---------------------------------------------------")
    Timer(1.5, open_browser).start()
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)
