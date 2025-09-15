# Amogh's Contribution to IngreScan

## What I Have Done

- Developed core API logic for ingredient and allergen analysis
- Added utility functions in `utils.py`
- Created models for data handling in `models.py`

## What Is Pending

- **Firebase integration:** The setup is present (`firebase_credentials.json`), but no functional code is implemented yet.
- **Database operations:** The structure in `db.py` is created, but no actual database logic is implemented yet.

## How to Run My Work

## How to Run My Work (Step-by-Step)

1. **Clone the repository:**

   ```
   git clone https://github.com/DhruvKarani/IngreScan.git
   ```

2. **Navigate to the project folder:**

   ```
   cd IngreScan/Api
   ```

3. **Install Python (if not already installed):**

   - Make sure you have Python 3.12 or later installed.

4. **Install all required Python packages:**
   - Run the following command to install dependencies:
     ```
     pip install -r requirements.txt
     ```
   - This will install (key packages):
     - fastapi, pydantic, uvicorn
     - requests
     - wikipedia
     - Pillow, pytesseract (for OCR in the image endpoint)
     - python-multipart (for file uploads)

**Note:** `firebase-admin` is not included since Firebase is not currently used.

5. **Add your Firebase credentials:**

   - Place your `firebase_credentials.json` file in the project directory.

6. **Run the API using FastAPI and Uvicorn:**
   - Start the server (from this folder):
     ```
     uvicorn main:app --reload --host 127.0.0.1 --port 8000
     ```
   - Open your browser and go to:
     [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) for the interactive API documentation (Swagger UI).
     [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc) for alternative API docs.

## Notes

- If you face any issues with missing packages, install them using `pip install <package_name>`.
- For allergen logic, refer to `allergens.py`.
- **Firebase and database functionality are not yet implemented.**

### Endpoints

- POST `/scan/ingredients` — Manual ingredient entry. Uses Open Food Facts first for ingredient info, falls back to Wikipedia.
- GET `/scan/barcode/{barcode}` — Barcode lookup using Open Food Facts v2/v1 with multiple fallbacks. Returns partial data when full info is not available.
- POST `/scan/image` — OCR demo (requires Tesseract installed if you enable real OCR).

### Windows quickstart

```
python -m venv .venv
.\.venv\Scripts\Activate
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

## Contact

If you have any questions, reach out to Amogh (Amoghiyer31).
