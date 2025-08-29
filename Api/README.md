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
   - This will install:
     - fastapi
     - pydantic
     - requests

**Note:** `firebase-admin` is not included in `requirements.txt` since Firebase is not currently used in the project. Add it later if Firebase integration is implemented.

5. **Add your Firebase credentials:**

   - Place your `firebase_credentials.json` file in the project directory.

6. **Run the API:**
   ```
   python main.py
   ```

## Notes

- If you face any issues with missing packages, install them using `pip install <package_name>`.
- For allergen logic, refer to `allergens.py`.
- **Firebase and database functionality are not yet implemented.**

## Contact

If you have any questions, reach out to Amogh (Amoghiyer31).
