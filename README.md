# 📱 IngreScan - Personalized Food Health Analysis System

> A personalized, rule-driven food analysis system that provides condition-specific health ratings through barcode scanning and intelligent OCR processing. This system introduces multilingual ingredient analysis with adaptive personalization algorithms.

[![React Native](https://img.shields.io/badge/React%20Native-0.81.5-blue)](https://reactnative.dev/)
[![Python](https://img.shields.io/badge/Python-3.12+-green)](https://python.org/)
[![Firebase](https://img.shields.io/badge/Firebase-12.3.0-orange)](https://firebase.google.com/)
[![License](https://img.shields.io/badge/License-Patent%20Pending-red)](LICENSE)

---

## ⚠️ The Problem We Solve

Consumers rely on packaged foods but cannot interpret complex industrial ingredient codes (INS 332, E-232, carrageenan, sodium benzoate). Current systems provide generic nutrition facts without considering individual health conditions, allergies, or dietary requirements.

**Core Issues:**
- Industrial ingredient codes lack plain-language explanations
- No condition-specific health impact analysis  
- One-size-fits-all approach ignores individual health profiles
- Limited transparency in ingredient impact assessment

This system addresses these gaps through personalized, condition-aware analysis.

---

## 🎯 System Overview

**IngreScan** implements a transparent, condition-aware food analysis system that provides personalized health ratings with full algorithmic explainability. The system analyzes ingredient impact based on individual health profiles and provides plain-English explanations for complex industrial additives.

### **🔑 Core Innovation**
Personalized health impact scoring where identical products receive different health ratings based on user-specific conditions, allergies, and dietary requirements. The system provides complete transparency in scoring methodology and ingredient impact analysis.

### **🔍 System Capabilities**
- **Score Breakdown**: Algorithmic transparency in health impact calculation
- **Ingredient Impact Analysis**: Condition-specific ingredient effect mapping  
- **Additive Decoder**: Industrial chemical name translation to plain language
- **Label Reading Education**: Ingredient interpretation guidance
- **Daily Impact Tracking**: Cumulative nutritional impact assessment
- **Alternative Analysis**: Comparative product recommendation logic

---

## 🏗️ System Architecture & Flow

### **📊 High-Level Architecture**

```
📱 USER SCANS BARCODE
     ↓
🔍 4-TIER DATA LOOKUP
     ↓
1️⃣ Firebase Database ────→ Cached personalized analysis
     ↓ (if not found)
2️⃣ Open Food Facts API ──→ External product database
     ↓ (if not found)  
3️⃣ OCR PROCESSOR ─────────→ Condition-aware photo analysis
     ↓ (if not found)
4️⃣ MANUAL INPUT ──────────→ User-entered product data
     ↓
🧠 PERSONALIZATION ENGINE ──→ **CORE INNOVATION**
     ↓                      Condition-specific health analysis
📊 HEALTH SCORE + WARNINGS
     ↓
� HEALTHY ALTERNATIVES
     ↓
�💾 SAVE TO CACHE + HISTORY
```

### **🔄 Data Flow Architecture**

```
📱 FRONTEND (React Native/Expo)
├── ScanScreen.js - Barcode scanning + OCR capture
├── ProductDetailsScreen.js - Personalized results display  
├── ProfileScreen.js - User health profile management
└── HistoryScreen.js - Scan history & trends

⚡ ALGORITHMS (JavaScript/AI)
├── scoreProduct.js - Multi-factor scoring engine
├── allergenScorer.js - Intelligent allergen detection
├── dailyIntakeManager.js - Adaptive nutrition tracking
├── ocrProcessor.js - Condition-aware image processing
└── geminiApi.js - AI-powered ingredient analysis

🐍 BACKEND (Python/Flask)
├── scoring_engine.py - Core health analysis (700+ lines)
├── score_api.py - REST API server
└── health_rules.json - Medical condition rules database

🗄️ DATA LAYER
├── Firebase Firestore - User profiles & cached products
├── Open Food Facts API - Global product database
└── Google Gemini AI - OCR & natural language processing
```

---

## 🧠 Where Personalization Happens

### **1. User Profile Creation** 
```javascript
// Health profile affects every aspect of analysis
userProfile = {
  healthConditions: ['diabetes', 'high_bp',.............],
  allergies: ['milk', 'soy',..............], 
  dietaryPreferences: ['vegetarian'],
  nutritionGoals: { maxSugar: 25, maxSodium: 1500 },
  dailyIntake: { current: {...}, limits: {...} }
}
```

### **2. Condition-Aware OCR Processing** 🔥 
```javascript
// OCR prioritizes extraction based on user's conditions
const targetKeywords = getTargetKeywords(userProfile.healthConditions);
// Diabetes user → prioritizes: sugar, glucose, corn syrup
// High BP user → prioritizes: sodium, salt content  
// Pregnant user → prioritizes: caffeine, alcohol, raw fish
```

### **3. Dynamic Health Rules Engine** 🔥 **CORE INNOVATION**
```python
# health_rules.json - Condition-specific penalties
"diabetes": {
  "nutrients": {
    "sugars_100g": { "max": 5, "penalty": 3 },
    "carbohydrates_100g": { "max": 15, "penalty": 2 }
  },
  "ingredients": ["glucose", "fructose", "corn syrup"],
  "warnings": ["⚠ High sugar/carbs - not suitable for diabetes"]
}
```

### **4. Adaptive Daily Intake Management** 🔥 **INNOVATION**
```javascript
// Updates user's daily limits based on consumption patterns
const adaptiveGoals = calculatePersonalizedGoals(
  userProfile.baseGoals,
  currentIntake,
  healthConditions,
  activityLevel
);
```

### **5. Multi-Factor Scoring Algorithm** 🔥 **CORE INNOVATION**
```javascript
finalScore = baseNutritionScore 
  - conditionPenalties 
  - allergenPenalties 
  - dietaryConflicts 
  - dailyIntakeContext
// Same product = different scores per user
```

---

## � Technical Differentiation

| **Component** | **Standard Approach** | **Our Implementation** |
|---------------|----------------------|------------------------|
| **Focus Area** | Macro tracking (calories, protein, carbs) | Ingredient analysis with health impact |
| **Product Analysis** | Generic nutrition facts | Personalized health impact scoring |
| **Data Collection** | Manual entry only | 4-Tier fallback: Database → API → OCR → Manual |
| **Health Rules** | One-size-fits-all | Condition-specific algorithms |
| **Language Support** | English-only or limited translations | Multilingual analysis & ingredient explanations |
| **Ingredient Intelligence** | Basic nutrition labels | Industrial additive decoder + warnings |
| **Allergen Detection** | Simple keyword matching | Cross-contamination analysis |
| **Daily Tracking** | Static macro goals | Adaptive goals based on consumption |
| **Transparency** | Black-box scoring | Full algorithmic explainability |
| **Recommendations** | Generic suggestions | Condition-specific alternatives |



---

## 🛠️ Technology Stack

**Core Architecture**: Frontend (React Native), Backend (Python Flask), AI (Gemini), Database (Firebase).

---

## 🔒 Patent & IP Protection

This system implements novel intellectual property covering:

1. **Condition-Aware OCR Processing** - Health-focused image analysis methodology
2. **Adaptive Health Rules Engine** - Dynamic personalization algorithms  
3. **Multi-Tier Product Analysis** - Comprehensive data fallback system
4. **Real-time Personalized Scoring** - Context-aware health impact calculation
5. **Behavioral Modification Framework** - Gamified health improvement methodology

**Disclaimer**: This system provides informational analysis only and does not provide medical diagnosis or treatment.

---

## 📞 Contact

**IngreScan Development Team**
- 📧 Email: dhruvkarani2005@gmail.com
