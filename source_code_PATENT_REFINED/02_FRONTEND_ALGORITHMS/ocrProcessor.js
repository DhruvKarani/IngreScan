// OCR-based ingredient and nutrition extraction with condition-aware parsing
import * as ImageManipulator from 'expo-image-manipulator';
import { GoogleGenerativeAI } from '@google/generative-ai';
import HEALTH_RULES from '../data/health_rules.json';

/**
 * Core OCR processor with personalized health condition awareness
 * Extracts ingredients, allergens, and nutrition data from product label photos
 */

export class OCRProcessor {
  constructor() {
    // Initialize Gemini AI for advanced OCR and interpretation
    this.genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  /**
   * Main OCR processing pipeline
   * @param {Object} imageUris - {ingredients, nutrition, allergens} image URIs
   * @param {Object} userProfile - User's health conditions and allergies
   * @returns {Object} Extracted and analyzed product data
   */
  async processProductImages(imageUris, userProfile) {
    try {
      const results = {
        ingredients: [],
        allergens: [],
        nutrients: {},
        confidence: 'MEDIUM',
        ocrSource: true
      };

      // Process ingredients list with condition-aware parsing
      if (imageUris.ingredients) {
        const ingredientsData = await this.extractIngredients(imageUris.ingredients, userProfile);
        results.ingredients = ingredientsData.ingredients;
        results.flaggedIngredients = ingredientsData.flagged;
      }

      // Process allergen warnings for immediate flagging
      if (imageUris.allergens) {
        results.allergens = await this.extractAllergens(imageUris.allergens, userProfile);
      }

      // Process nutrition facts table
      if (imageUris.nutrition) {
        results.nutrients = await this.extractNutritionFacts(imageUris.nutrition);
      }

      // Calculate confidence based on extraction quality
      results.confidence = this.calculateExtractionConfidence(results);

      return results;
    } catch (error) {
      console.error('OCR processing failed:', error);
      return { error: 'OCR_PROCESSING_FAILED', message: error.message };
    }
  }

  /**
   * Condition-aware ingredient extraction
   * Prioritizes ingredients relevant to user's health conditions
   */
  async extractIngredients(imageUri, userProfile) {
    const optimizedImage = await this.preprocessImage(imageUri);
    
    // Build condition-specific parsing prompt
    const conditions = userProfile.healthConditions || [];
    const allergies = userProfile.allergies || [];
    const targetKeywords = this.getTargetKeywords(conditions, allergies);

    const prompt = `
      Analyze this ingredients list image with special focus on health conditions.
      
      USER HEALTH PROFILE:
      - Conditions: ${conditions.join(', ')}
      - Allergies: ${allergies.join(', ')}
      
      PRIORITY EXTRACTION (flag these immediately):
      ${targetKeywords.join(', ')}
      
      Extract:
      1. Complete ingredients list (comma-separated)
      2. Flag any ingredients matching user's health concerns
      3. Highlight problematic ingredients for conditions
      
      Return JSON format:
      {
        "ingredients": ["ingredient1", "ingredient2", ...],
        "flagged": ["problematic_ingredient1", ...],
        "concerns": ["specific health concern", ...]
      }
    `;

    const result = await this.model.generateContent([
      prompt,
      { inlineData: { data: optimizedImage.base64, mimeType: "image/jpeg" } }
    ]);

    return this.parseIngredientsResponse(result.response.text());
  }

  /**
   * Extract allergen warnings with immediate user matching
   */
  async extractAllergens(imageUri, userProfile) {
    const optimizedImage = await this.preprocessImage(imageUri);
    const userAllergies = userProfile.allergies || [];

    const prompt = `
      Extract allergen warnings from this product label.
      
      USER ALLERGIES: ${userAllergies.join(', ')}
      
      Look for text like:
      - "Contains: Milk, Soy, Wheat"
      - "May contain traces of..."
      - "Allergen information:"
      
      Flag any allergens that match user's allergy profile.
      
      Return JSON:
      {
        "detected_allergens": ["milk", "soy", ...],
        "user_matches": ["allergen_user_has", ...],
        "severity": "HIGH/MEDIUM/LOW"
      }
    `;

    const result = await this.model.generateContent([
      prompt,
      { inlineData: { data: optimizedImage.base64, mimeType: "image/jpeg" } }
    ]);

    return this.parseAllergensResponse(result.response.text());
  }

  /**
   * Extract nutritional values from nutrition facts table
   */
  async extractNutritionFacts(imageUri) {
    const optimizedImage = await this.preprocessImage(imageUri);

    const prompt = `
      Extract numerical values from this nutrition facts table.
      Focus on per 100g/100ml values when available.
      
      Extract these nutrients:
      - Calories/Energy (kcal)
      - Total Fat (g)
      - Saturated Fat (g)
      - Trans Fat (g)
      - Cholesterol (mg)
      - Sodium (mg)
      - Total Carbohydrates (g)
      - Sugars (g)
      - Protein (g)
      - Fiber (g)
      
      Return JSON with per 100g values:
      {
        "energy-kcal_100g": 250,
        "fat_100g": 15.2,
        "saturated-fat_100g": 5.1,
        "sugars_100g": 12.3,
        "salt_100g": 0.8,
        ...
      }
    `;

    const result = await this.model.generateContent([
      prompt,
      { inlineData: { data: optimizedImage.base64, mimeType: "image/jpeg" } }
    ]);

    return this.parseNutritionResponse(result.response.text());
  }

  /**
   * Get priority keywords based on user's health conditions
   */
  getTargetKeywords(conditions, allergies) {
    let keywords = [...allergies];

    conditions.forEach(condition => {
      const rules = HEALTH_RULES[condition.toLowerCase()];
      if (rules && rules.ingredients) {
        keywords.push(...rules.ingredients);
      }
    });

    // Add common problematic ingredients
    keywords.push(
      'high fructose corn syrup', 'trans fat', 'partially hydrogenated',
      'artificial sweetener', 'sodium benzoate', 'msg'
    );

    return [...new Set(keywords)]; // Remove duplicates
  }

  /**
   * Preprocess image for better OCR accuracy
   */
  async preprocessImage(imageUri) {
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        { resize: { width: 1024 } }, // Optimize size
        { flip: ImageManipulator.FlipType.Horizontal } // Correct orientation if needed
      ],
      { 
        compress: 0.8, 
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true 
      }
    );

    return manipulatedImage;
  }

  /**
   * Parse and validate ingredients extraction response
   */
  parseIngredientsResponse(responseText) {
    try {
      // Clean response text and extract JSON
      const cleanText = responseText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanText);
      
      return {
        ingredients: parsed.ingredients || [],
        flagged: parsed.flagged || [],
        concerns: parsed.concerns || []
      };
    } catch (error) {
      console.error('Failed to parse ingredients response:', error);
      return { ingredients: [], flagged: [], concerns: [] };
    }
  }

  /**
   * Parse allergen extraction response
   */
  parseAllergensResponse(responseText) {
    try {
      const cleanText = responseText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanText);
      
      return {
        detected: parsed.detected_allergens || [],
        userMatches: parsed.user_matches || [],
        severity: parsed.severity || 'LOW'
      };
    } catch (error) {
      console.error('Failed to parse allergens response:', error);
      return { detected: [], userMatches: [], severity: 'LOW' };
    }
  }

  /**
   * Parse nutrition facts extraction response
   */
  parseNutritionResponse(responseText) {
    try {
      const cleanText = responseText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanText);
      
      // Ensure all values are numbers
      const nutrients = {};
      Object.keys(parsed).forEach(key => {
        const value = parseFloat(parsed[key]);
        if (!isNaN(value)) {
          nutrients[key] = value;
        }
      });
      
      return nutrients;
    } catch (error) {
      console.error('Failed to parse nutrition response:', error);
      return {};
    }
  }

  /**
   * Calculate confidence score based on extraction quality
   */
  calculateExtractionConfidence(results) {
    let score = 0;
    let maxScore = 0;

    // Ingredients confidence
    if (results.ingredients && results.ingredients.length > 0) {
      score += results.ingredients.length > 5 ? 3 : 2;
    }
    maxScore += 3;

    // Allergens confidence
    if (results.allergens && results.allergens.detected) {
      score += results.allergens.detected.length > 0 ? 2 : 1;
    }
    maxScore += 2;

    // Nutrients confidence
    const nutrientCount = Object.keys(results.nutrients || {}).length;
    score += nutrientCount > 5 ? 3 : (nutrientCount > 2 ? 2 : 1);
    maxScore += 3;

    const confidenceRatio = score / maxScore;
    if (confidenceRatio > 0.8) return 'HIGH';
    if (confidenceRatio > 0.5) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Apply condition-specific penalties to OCR extracted data
   * Integrates with existing health rules engine
   */
  applyHealthRulesPenalties(ocrData, userProfile) {
    const conditions = userProfile.healthConditions || [];
    const allergies = userProfile.allergies || [];
    
    let totalPenalty = 0;
    const warnings = [];

    // Apply allergen penalties
    allergies.forEach(allergy => {
      if (ocrData.allergens?.userMatches?.includes(allergy.toLowerCase())) {
        totalPenalty += 5;
        warnings.push(`[HIGH] Contains allergen: ${allergy}`);
      }
    });

    // Apply condition-based ingredient penalties
    conditions.forEach(condition => {
      const rules = HEALTH_RULES[condition.toLowerCase()];
      if (rules && rules.ingredients) {
        rules.ingredients.forEach(badIngredient => {
          const found = ocrData.ingredients.some(ing => 
            ing.toLowerCase().includes(badIngredient.toLowerCase())
          );
          if (found) {
            totalPenalty += rules.penalty_points || 3;
            warnings.push(`[HIGH] Contains ${badIngredient} - not suitable for ${condition}`);
          }
        });
      }
    });

    return { penalty: totalPenalty, warnings };
  }
}

export default OCRProcessor;