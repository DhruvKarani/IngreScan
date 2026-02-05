# Comprehensive Harm Classification System

## Overview
The ML-powered system classifies **ALL food ingredients** (not just sweeteners) into 5 harm levels with distinction between natural, processed, and artificial additives.

## 5-Level Harm System

### 🟢 VERY LOW HARM (0 points)
**Whole Foods & Basic Ingredients**
- Fruits, vegetables, whole grains
- Legumes, nuts, seeds
- Fresh proteins (chicken, fish, eggs)
- Herbs and spices
- Water, milk

**Action**: No penalty, may receive **score boost (+1 to +2)**

---

### 🟢 LOW HARM (1 point each)
**Natural Preservatives & Additives**
- Vitamin C (Ascorbic Acid, E300-E302)
- Citric Acid
- Vinegar (Acetic Acid)
- Natural colors: Beet juice, Turmeric, Beta-carotene (E100-E163)
- Natural flavors from plants/fruits

**Action**: Minimal penalty, considered safe

---

### 🟡 MEDIUM HARM (5 points each)
**Moderate Risk Additives**
- Potassium Sorbate (E202)
- Sorbic Acid (E200-E203)
- Caramel Colors (E150a-E150d)
- Artificial flavors (Vanillin, Diacetyl)
- MSG (E621)
- Soy Lecithin (E322)
- Carrageenan (E407)

**Action**: Moderate penalty, limit consumption

---

### 🟠 HIGH HARM (10 points each)
**High Risk Additives**
- Sodium Benzoate (E211-E219)
- Sulfites (E220-E228)
- BHA (E320), BHT (E321)
- Artificial colors: Yellow 5 (E102), Red 40 (E129), Tartrazine
- Propyl Gallate (E310)
- TBHQ (E319)

**Action**: Significant penalty, avoid frequent consumption

---

### 🔴 VERY HIGH HARM (15 points each)
**Maximum Risk Ingredients**
- Sodium Nitrite (E250)
- Sodium Nitrate (E251)
- Potassium Nitrate (E252)
- Mechanically separated meat
- Trans fats (Partially hydrogenated oils)
- High fructose corn syrup (in ultra-processed context)

**Action**: Maximum penalty, strong health warnings

---

## Category Classifications

### 21+ Ingredient Categories

#### **Sweeteners** (5 categories)
1. **Natural Sugar** (LOW) - honey, maple syrup, fruit sugar
2. **Refined Sugar** (MEDIUM) - white sugar, cane sugar
3. **Natural Sweetener** (LOW) - stevia, monk fruit
4. **Artificial Sweetener** (MEDIUM) - aspartame, saccharin, sucralose
5. **Sugar Alcohol** (LOW-MEDIUM) - xylitol, erythritol

#### **Preservatives** (4 harm levels)
1. **Natural Preservative** (LOW) - vitamin C, citric acid, vinegar
2. **Moderate Preservative** (MEDIUM) - potassium sorbate, E200-E203
3. **Harmful Preservative** (HIGH) - benzoates, sulfites, BHA, BHT
4. **Very Harmful Preservative** (VERY HIGH) - nitrites, nitrates

#### **Colors** (3 harm levels)
1. **Natural Color** (LOW) - beet juice, turmeric, beta-carotene
2. **Moderate Color** (MEDIUM) - caramel colors E150a-E175
3. **Harmful Color** (HIGH) - tartrazine, yellow 5, red 40

#### **Flavors** (3 types)
1. **Natural Flavor** (LOW) - plant/fruit extracts
2. **Artificial Flavor** (MEDIUM) - vanillin, diacetyl
3. **Flavor Enhancer** (MEDIUM-HIGH) - MSG, hydrolyzed proteins

#### **Other Categories**
- **Emulsifier/Stabilizer** (LOW-MEDIUM) - lecithin, xanthan gum
- **Fat** (MEDIUM) - oils, saturated fats
- **Gluten** (varies by user profile)
- **Dairy** (varies by user profile)
- **Sodium** (MEDIUM-HIGH based on amount)
- **GMO** (varies by user preference)

#### **Whole Food Categories** (Score Boost)
- **Fruits** (+2 points) - apple, banana, berries
- **Vegetables** (+2 points) - spinach, broccoli, tomato
- **Whole Grains** (+2 points) - quinoa, brown rice, oats
- **Legumes** (+1 point) - lentils, chickpeas, beans
- **Nuts & Seeds** (+1 point) - almonds, chia seeds
- **Proteins** (+1 point) - chicken, fish, eggs
- **Herbs & Spices** (+1 point) - basil, turmeric, garlic

#### **Processed Food Indicators** (Penalties)
- **Refined Grains** (-3 points) - white flour, refined wheat
- **Processed Meat** (-8 points) - bacon, sausage, hot dogs
- **Ultra-Processed** (-5 points) - mechanically separated, hydrolyzed

---

## Examples

### Example 1: Healthy Product
**Organic Quinoa Bowl**
- Ingredients: quinoa, spinach, tomatoes, olive oil, lemon juice
- Classifications:
  - Quinoa → Whole grain (+2 boost)
  - Spinach, tomatoes → Vegetables (+2 boost each)
  - Olive oil → Natural fat (0 penalty)
  - Lemon juice → Natural preservative (1 point)
- **Total Harm Score: 1 point**
- **Verdict: ✅ VERY SAFE**

---

### Example 2: Moderate Product
**Packaged Bread**
- Ingredients: enriched flour, sugar, yeast, calcium propionate, lecithin
- Classifications:
  - Enriched flour → Refined grain (-3)
  - Sugar → Refined sugar (MEDIUM, 5 points)
  - Calcium propionate → Moderate preservative (MEDIUM, 5 points)
  - Lecithin → Emulsifier (LOW, 1 point)
- **Total Harm Score: 11 points**
- **Verdict: 🟡 MODERATE RISK**

---

### Example 3: High Risk Product
**Fruit Punch Drink**
- Ingredients: HFCS, artificial flavor, red 40, yellow 5, sodium benzoate
- Classifications:
  - HFCS → Ultra-processed (-5)
  - Artificial flavor → Artificial (MEDIUM, 7 points)
  - Red 40, Yellow 5 → Harmful colors (HIGH, 10 points each)
  - Sodium benzoate → Harmful preservative (HIGH, 10 points)
- **Total Harm Score: 47 points**
- **Verdict: 🔴 VERY HIGH RISK**

---

### Example 4: Maximum Risk Product
**Hot Dogs**
- Ingredients: mechanically separated chicken, sodium nitrite, BHA, BHT, red 40
- Classifications:
  - Mechanically separated chicken → Processed meat (-8)
  - Sodium nitrite → VERY harmful preservative (VERY HIGH, 15 points)
  - BHA → Harmful preservative (HIGH, 10 points)
  - BHT → Harmful preservative (HIGH, 10 points)
  - Red 40 → Harmful color (HIGH, 10 points)
- **Total Harm Score: 45 points**
- **Verdict: 🔴 VERY HIGH RISK - AVOID**

---

## Warning System

Based on harm counts, the system generates warnings:

- **2+ VERY HIGH risk ingredients**: 
  > ⚠️ ALERT: Contains X VERY HIGH risk ingredient(s) - Avoid frequent consumption

- **3+ HIGH risk ingredients**:
  > ⚠️ WARNING: Contains X HIGH risk ingredient(s) - Consider healthier alternatives

- **5+ MEDIUM risk ingredients**:
  > ℹ️ NOTICE: Contains X MEDIUM risk ingredient(s) - Consume in moderation

---

## Natural vs Artificial Examples

### Natural Additives (Safe)
| Ingredient | Category | Harm Level | Penalty |
|------------|----------|------------|---------|
| Vitamin C (Ascorbic Acid) | Natural Preservative | LOW | 1 pt |
| Citric Acid | Natural Preservative | LOW | 1 pt |
| Beet Juice | Natural Color | LOW | 1 pt |
| Turmeric | Natural Color | LOW | 1 pt |
| Stevia | Natural Sweetener | LOW | 1 pt |

### Artificial Additives (Risky)
| Ingredient | Category | Harm Level | Penalty |
|------------|----------|------------|---------|
| Sodium Benzoate | Harmful Preservative | HIGH | 10 pts |
| BHA/BHT | Harmful Preservative | HIGH | 10 pts |
| Red 40 | Harmful Color | HIGH | 10 pts |
| Yellow 5 (Tartrazine) | Harmful Color | HIGH | 10 pts |
| Aspartame | Artificial Sweetener | MEDIUM | 7 pts |

### Maximum Risk Additives
| Ingredient | Category | Harm Level | Penalty |
|------------|----------|------------|---------|
| Sodium Nitrite | Very Harmful Preservative | VERY HIGH | 15 pts |
| Sodium Nitrate | Very Harmful Preservative | VERY HIGH | 15 pts |
| Trans Fats | Ultra-Processed Fat | VERY HIGH | 15 pts |

---

## How It Works

### 1. **Ingredient Extraction**
```
"quinoa, spinach, sodium benzoate, red 40"
→ ['quinoa', 'spinach', 'sodium benzoate', 'red 40']
```

### 2. **Semantic Matching**
Uses sentence-transformers to match against 300+ ingredient aliases:
- "sodium benzoate" → 98% match with "e211" (harmful preservative)
- "red 40" → 97% match with "allura red" (harmful color)

### 3. **Harm Level Assignment**
```python
{
  "quinoa": {"harm_level": "VERY_LOW", "type": "natural", "score_boost": +2},
  "spinach": {"harm_level": "VERY_LOW", "type": "natural", "score_boost": +2},
  "sodium benzoate": {"harm_level": "HIGH", "type": "artificial", "penalty": 10},
  "red 40": {"harm_level": "HIGH", "type": "artificial", "penalty": 10}
}
```

### 4. **Harm Score Calculation**
```
Harm Score = (VERY_HIGH × 15) + (HIGH × 10) + (MEDIUM × 5) + (LOW × 1)
           = (0 × 15) + (2 × 10) + (0 × 5) + (0 × 1)
           = 20 points
```

### 5. **Unified Score**
```
Final Score = Base Nutrition Score 
            - Harm Score 
            - False Claim Penalties
            - Synergy Penalties
            - Personalization Penalties
```

---

## Testing

Run the comprehensive test:
```bash
cd server
python test_comprehensive_classification.py
```

This tests:
- ✅ Whole food recognition (quinoa, vegetables)
- ✅ Natural preservative detection (vitamin C)
- ✅ Artificial color/flavor penalties
- ✅ Processed meat warnings
- ✅ All 5 harm levels
- ✅ Score boosts for healthy ingredients

---

## Key Advantages

1. **Nuanced Scoring**: Vitamin C (1pt) vs Nitrites (15pts) - not all additives equal
2. **Natural Recognition**: Rewards whole foods with score boosts
3. **Comprehensive Coverage**: 21+ categories, 300+ ingredients
4. **Context-Aware**: Same ingredient different penalties based on processing
5. **Transparent**: Shows exactly which ingredients cause which penalties
6. **Educational**: Users learn which additives are safe vs harmful

---

## Future Enhancements

- [ ] Country-specific regulations (EU vs US banned additives)
- [ ] Allergen interaction warnings
- [ ] Cumulative exposure tracking
- [ ] Synergy effects (e.g., nitrites + amines)
- [ ] Processing method impact (cold-pressed vs refined)
