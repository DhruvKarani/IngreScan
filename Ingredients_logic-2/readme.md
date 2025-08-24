# IngreScan – Project Log

## Day 1 - [15/8/2025]
### What I Worked On
- Developed a working **prototype website** for IngreScan.
- The site replicates the same backend logic (barcode → OFF → formatted output).
- Serves as a **web-based demo** for testing, but the project goal remains an **app-first experience**.

### Problems / Learnings
- Web version is easier to demo/share but does not solve core challenges (OFF coverage, scoring system).
- Confirms that the current logic is portable between web and app frameworks.

---

## Day 2 - [21/8/2025]
### What I Worked On
- Defined project flow and goals:
  - Scan product barcode.
  - Fetch product info (Nutri-Score + ingredients).
  - Show cleanly formatted output to user.
- Decided on Firebase as the primary database.
- Split tasks into two parallel tracks:
  - **Person A:** Work with OpenFoodFacts (OFF) API → get product info, scoring, and test results.
  - **Person B:** Explore OCR / image-based extraction for nutrition labels as a fallback when OFF fails.

### Problems / Learnings
- OFF has incomplete info for Indian products (Maggi not found).
- Barcode-based lookup may vary by region (EU Coke vs. India Coke).
- Need a fallback solution: 
  - Either crowdsource (user enters once, saved in Firebase), or 
  - OCR-based scanning of nutrition labels.
- Important insight: Relying only on OFF is unreliable for Indian audience.

---

## Day 3 - [22/8/2025]
### What I Worked On
- Integrated OFF API with barcode scanning.
- Tested the API on multiple products (Coca-Cola, Pepsi, packaged foods).
- Implemented clean output formatting:
  - Barcode, Product Name.
  - Nutri-Score (Letter + Score/10).
  - Nutrition inputs (energy, sugar, fat, sodium, protein, etc.).
  - Ingredient list + additives.

### Problems / Learnings
- Found inconsistency in Nutri-Score mapping (e.g., Pepsi Max grade B but higher score than Coke).
- OFF product naming is sometimes unclear (e.g., “Original Taste” for Coca-Cola).
- Some products still return **“Product not found”** → reinforces need for fallback.
- Learned importance of formatting outputs so users can instantly understand.

---

## Day 4 - [23/8/2025]
### What I Worked On
- Identified major reliability issues with OFF:
  - Popular Indian products (like Maggi) missing.
  - Regional differences in barcodes/ingredients.
  - Risk of user distrust (“App says Coke is fine, but I know it’s unhealthy”).
- Brainstormed fallback strategies:
  - Community-driven database (first entry → Firebase, reused later).
  - OCR-based nutrition label scanning.
  - Manual nutrition input as last resort.
- Discussed long-term scoring approach:
  - Start with OFF for convenience.
  - Build **our own scoring system** later, incorporating:
    - Nutritional values (sugar, fat, protein).
    - Preservatives, stabilizers, additives.
    - AI-based evaluation.

### Problems / Learnings
- Relying purely on OFF is not viable for Indian audience.
- Designing a fair custom scoring system requires careful domain research (to avoid oversimplification).
- Need to balance **ease of use** (scan barcode, instant result) with **data completeness** (fallbacks).
