/**
 * ML-Enhanced API for Intelligent Food Analysis
 * Replaces broken Gemini API with Hugging Face-powered backend
 */

// Get scoring API URL from config
const getScoreApiUrl = () => {
  // Try to get from environment or config
  try {
    const { SCORE_API_URL } = require('../constants/config');
    const baseUrl = SCORE_API_URL || 'http://192.168.0.103:5000';
    // Remove /analyze suffix if present (we'll add specific endpoints)
    return baseUrl.replace(/\/analyze$/, '');
  } catch (e) {
    return 'http://192.168.0.103:5000';
  }
};

const ML_API_BASE = getScoreApiUrl();

/**
 * Analyze product using ML-enhanced scoring system
 * @param {Object} product - Product data with nutrients and ingredients
 * @param {Object} userProfile - User's conditions and allergies
 * @returns {Promise<Object>} - ML analysis with scores, warnings, and insights
 */
export const analyzeProductWithML = async (product, userProfile = {}) => {
  try {
    // Implement proper timeout using AbortController (45 seconds for ML processing - DistilBERT can be slow)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    const response = await fetch(`${ML_API_BASE}/ml-score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product: product,
        userProfile: userProfile
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`ML API returned ${response.status}`);
    }

    const result = await response.json();
    
    console.log('[ML-API] Analysis complete:', {
      score: result.score10,
      falseClaims: result.ml_insights?.false_claims_detected,
      ingredientsFound: result.ml_insights?.ingredients_found
    });

    return result;

  } catch (error) {
    const isTimeout = error.name === 'AbortError';
    console.error('[ML-API] Analysis failed:', {
      error: error.message,
      type: error.name,
      isTimeout,
      apiUrl: `${ML_API_BASE}/ml-score`
    });
    
    // Fallback to basic analysis
    return getFallbackAnalysis(product, userProfile);
  }
};

/**
 * Get personalized health score (0-100 scale) with evidence-based penalties
 * @param {Object} product - Product data with nutrients and ingredients
 * @param {Object} userProfile - User's health conditions and allergies
 * @returns {Promise<Object>} - Personalized score with breakdown and recommendations
 */
export const getPersonalizedScore = async (product, userProfile = {}) => {
  try {
    // Extract user conditions and allergies
    const conditions = userProfile.healthConditions || userProfile.conditions || [];
    const allergies = userProfile.allergens || userProfile.allergies || [];

    console.log('[ML-API] Personalized scoring with:', {
      conditions: conditions,
      allergies: allergies,
      productName: product.product_name || product.name
    });

    // Implement proper timeout using AbortController (45 seconds for personalized scoring - DistilBERT can be slow)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    const response = await fetch(`${ML_API_BASE}/personalized-score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product: product,
        user_profile: {
          conditions: conditions,
          allergies: allergies
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Personalized scoring API returned ${response.status}`);
    }

    const result = await response.json();
    
    console.log('[ML-API] Personalized score:', {
      score: result.final_score,
      label: result.label,
      critical_warning: result.critical_warning,
      conditions: conditions
    });

    return result;

  } catch (error) {
    const isTimeout = error.name === 'AbortError';
    console.error('[ML-API] Personalized scoring failed:', {
      error: error.message,
      type: error.name,
      isTimeout,
      apiUrl: `${ML_API_BASE}/personalized-score`
    });
    
    // Fallback to ML score if personalized scoring unavailable
    console.log('[ML-API] Falling back to ML score');
    const mlResult = await analyzeProductWithML(product, userProfile);
    
    // Transform to personalized score format
    return {
      final_score: mlResult.score10 * 10, // Convert 0-10 to 0-100
      label: mlResult.Tier || 'Moderate',
      color: getColorFromScore(mlResult.score10 * 10),
      emoji: getEmojiFromScore(mlResult.score10 * 10),
      recommendation: mlResult.tier_description || mlResult.explanation,
      guideline: 'Using ML score (personalized scoring unavailable)',
      critical_warning: false,
      breakdown: mlResult.breakdown || {},
      user_profile: {
        conditions: userProfile.healthConditions || userProfile.conditions || [],
        allergies: userProfile.allergens || userProfile.allergies || []
      },
      metadata: {
        scoring_version: 'fallback',
        timestamp: new Date().toISOString()
      },
      _fallback: true
    };
  }
};

// Helper functions for fallback transformation
function getColorFromScore(score) {
  if (score >= 90) return '#2ecc71';
  if (score >= 75) return '#3498db';
  if (score >= 60) return '#f39c12';
  if (score >= 45) return '#e67e22';
  if (score >= 30) return '#e74c3c';
  return '#c0392b';
}

function getEmojiFromScore(score) {
  if (score >= 90) return '✅';
  if (score >= 75) return '👍';
  if (score >= 60) return '⚠️';
  if (score >= 45) return '⚠️';
  if (score >= 30) return '⚠️';
  return '🚫';
}

/**
 * Analyze ingredients with ML (replaces Gemini functionality)
 * Detects ingredient categories, false claims, and provides descriptions
 * @param {Array|string} ingredients - Ingredient list or text
 * @param {Object} product - Full product data for context
 * @returns {Promise<Object>} - Categorized ingredients with ML insights
 */
export const analyzeIngredientsWithML = async (ingredients, product = {}) => {
  try {
    // Convert ingredients to text if it's an array
    const ingredientsText = Array.isArray(ingredients) 
      ? ingredients.join(', ')
      : String(ingredients || '');

    const productData = {
      ...product,
      ingredients_text: ingredientsText,
      ingredients: ingredientsText
    };

    const response = await fetch(`${ML_API_BASE}/ml-score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product: productData,
        userProfile: {}
      })
    });

    if (!response.ok) {
      throw new Error(`ML API returned ${response.status}`);
    }

    const result = await response.json();

    // Transform ML results to match expected format
    const ingredientCategories = result.ml_insights?.categories_detected || [];
    const ingredientsAnalyzed = result.breakdown?.ml_analysis?.ingredients_analyzed || [];

    return {
      ingredients: ingredientsAnalyzed.map(ing => ({
        name: ing,
        type: categorizeIngredient(ing, ingredientCategories),
        description: generateDescription(ing, ingredientCategories),
        riskLevel: assessRiskLevel(ing, ingredientCategories),
        purpose: inferPurpose(ing, ingredientCategories)
      })),
      additives: ingredientsAnalyzed
        .filter(ing => isAdditive(ing, ingredientCategories))
        .map(ing => ({
          name: ing,
          type: 'additive',
          description: generateDescription(ing, ingredientCategories),
          riskLevel: assessRiskLevel(ing, ingredientCategories),
          purpose: inferPurpose(ing, ingredientCategories)
        })),
      filteredOut: [],
      mlInsights: {
        falseClaims: result.ml_insights?.false_claims_detected || 0,
        synergiesFound: result.ml_insights?.synergies_found || 0,
        categoriesDetected: ingredientCategories
      }
    };

  } catch (error) {
    console.error('[ML-API] Ingredient analysis failed:', error.message);
    return getFallbackIngredientAnalysis(ingredients);
  }
};

/**
 * Check API health status
 */
export const checkMLApiHealth = async () => {
  try {
    const response = await fetch(`${ML_API_BASE}/health`, {
      method: 'GET',
      timeout: 5000
    });

    if (!response.ok) {
      return { available: false, reason: `HTTP ${response.status}` };
    }

    const health = await response.json();
    return {
      available: true,
      mlEnabled: health.ml_available,
      version: health.version
    };

  } catch (error) {
    return { available: false, reason: error.message };
  }
};

// Helper functions

function categorizeIngredient(ingredient, categories) {
  const ingredientLower = ingredient.toLowerCase();
  
  if (categories.includes('artificial') || categories.includes('preservative')) {
    if (ingredientLower.includes('e-') || ingredientLower.match(/e\d{3,4}/)) {
      return 'additive';
    }
  }
  
  if (categories.includes('sugar')) {
    return 'sweetener';
  }
  
  return 'ingredient';
}

function isAdditive(ingredient, categories) {
  const ingredientLower = ingredient.toLowerCase();
  
  // E-numbers are always additives
  if (ingredientLower.match(/e\d{3,4}/)) return true;
  
  // Common additive keywords
  const additiveKeywords = ['preservative', 'emulsifier', 'stabilizer', 'color', 'colour', 'flavor', 'flavour'];
  return additiveKeywords.some(keyword => ingredientLower.includes(keyword));
}

function assessRiskLevel(ingredient, categories) {
  const ingredientLower = ingredient.toLowerCase();
  
  // High risk
  if (categories.includes('artificial') && ingredientLower.match(/e\d{3,4}/)) {
    return 'HIGH';
  }
  
  if (categories.includes('preservative')) {
    return 'MEDIUM';
  }
  
  if (categories.includes('sugar') || categories.includes('fat')) {
    return 'MEDIUM';
  }
  
  return 'LOW';
}

function generateDescription(ingredient, categories) {
  const ingredientLower = ingredient.toLowerCase();
  
  // Basic descriptions based on categories
  if (categories.includes('sugar')) {
    return `A form of sugar that adds sweetness to the product. High consumption of added sugars may contribute to health issues like obesity and diabetes.`;
  }
  
  if (categories.includes('preservative')) {
    return `A preservative used to extend shelf life by preventing microbial growth. Some people may be sensitive to certain preservatives.`;
  }
  
  if (categories.includes('artificial')) {
    return `An artificial additive used in food processing. Consider limiting consumption of products with multiple artificial additives.`;
  }
  
  return `A common food ingredient used in this product. Check your specific dietary restrictions and allergies.`;
}

function inferPurpose(ingredient, categories) {
  const ingredientLower = ingredient.toLowerCase();
  
  if (categories.includes('sugar')) return 'Sweetener';
  if (categories.includes('preservative')) return 'Preservation';
  if (categories.includes('artificial')) return 'Processing aid';
  if (categories.includes('fat')) return 'Texture and flavor';
  
  if (ingredientLower.includes('flavor') || ingredientLower.includes('flavour')) {
    return 'Flavoring';
  }
  
  if (ingredientLower.includes('color') || ingredientLower.includes('colour')) {
    return 'Coloring';
  }
  
  return 'Ingredient';
}

function getFallbackAnalysis(product, userProfile) {
  console.log('[ML-API] Using fallback analysis');
  
  return {
    score: 50,
    score10: 5,
    Score: 50,
    Tier: 'Moderate',
    tier_description: 'ML API unavailable - using basic analysis',
    Confidence: 'LOW',
    explanation: 'Basic analysis only (ML backend unavailable)',
    warnings: ['ML analysis unavailable - install backend dependencies'],
    personalizedWarnings: [],
    Warnings: [],
    breakdown: {},
    ml_insights: {
      ingredients_found: 0,
      categories_detected: [],
      false_claims_detected: 0,
      synergies_found: 0
    },
    scoring_method: 'FALLBACK',
    _source: 'fallback'
  };
}

function getFallbackIngredientAnalysis(ingredients) {
  const ingredientList = Array.isArray(ingredients) 
    ? ingredients 
    : String(ingredients || '').split(/[,;]/).map(i => i.trim()).filter(Boolean);

  return {
    ingredients: ingredientList.slice(0, 10).map(ing => ({
      name: ing,
      type: 'ingredient',
      description: 'ML analysis unavailable. This is a basic ingredient in the product.',
      riskLevel: 'UNKNOWN',
      purpose: 'Ingredient'
    })),
    additives: [],
    filteredOut: [],
    mlInsights: {
      falseClaims: 0,
      synergiesFound: 0,
      categoriesDetected: []
    }
  };
}

// Export all functions
export default {
  analyzeProductWithML,
  getPersonalizedScore,
  analyzeIngredientsWithML,
  checkMLApiHealth
};
