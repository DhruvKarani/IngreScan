import HEALTH_RULES from '../data/health_rules.json';
import { analyzeProductWithML } from './mlApi';

// Flag to enable/disable ML features
const USE_ML_SCORING = true;

/**
 * Score product using ML-enhanced system or fallback to rules
 */
export async function scoreFromRulesML(nutrients = {}, ingredientsText = '', userProfile = { conditions: [], allergies: [] }) {
  // Try ML-enhanced scoring first
  if (USE_ML_SCORING) {
    try {
      const productData = {
        nutriments: nutrients,
        ingredients_text: ingredientsText,
        product_name: nutrients.product_name || nutrients.name || 'Unknown'
      };

      const mlResult = await analyzeProductWithML(productData, userProfile);
      
      // If ML succeeded, return its results
      if (mlResult && mlResult.scoring_method === 'ML_ENHANCED') {
        console.log('[ScoreFromRules] Using ML-enhanced results');
        return mlResult;
      }
    } catch (error) {
      console.warn('[ScoreFromRules] ML scoring failed, using rule-based fallback:', error.message);
    }
  }

  // Fallback to legacy rule-based scoring
  return scoreFromRulesLegacy(nutrients, ingredientsText, userProfile);
}

// Legacy rule-based scoring (kept as fallback)
function scoreFromRulesLegacy(nutrients = {}, ingredientsText = '', userProfile = { conditions: [], allergies: [] }) {
  const ingredients = String(ingredientsText || '').toLowerCase();

  // Check if we have meaningful nutrition data (only valid nutrition fields)
  const VALID_NUTRITION_KEYS = [
    'energy-kcal_100g', 'energy_100g', 'calories_100g', 'calories',
    'sugars_100g', 'sugars',
    'fat_100g', 'fat',
    'proteins_100g', 'protein_100g', 'protein',
    'carbohydrates_100g', 'carbohydrates',
    'sodium_100g', 'salt_100g', 'sodium', 'salt',
    'fiber_100g', 'fiber'
  ];
  
  const hasNutritionData = VALID_NUTRITION_KEYS.some(key => {
    const value = nutrients[key];
    return value !== undefined && value !== null && Number(value) > 0;
  });
  const hasIngredientsData = ingredients.trim().length > 0;

  // If no nutrition or ingredients data, give a low score to indicate incomplete data
  if (!hasNutritionData && !hasIngredientsData) {
    return {
      score: 1,
      Score: 1,
      score10: 1,
      Tier: 'Incomplete Data',
      Confidence: 'LOW',
      explanation: 'Product has insufficient nutrition and ingredient information for proper scoring',
      personalizedWarnings: ['This product needs more complete nutrition information'],
      Warnings: ['Incomplete product data'],
      breakdown: { baseScore: 1, penalty: 0, reason: 'No nutrition or ingredient data available' },
      _source: 'local-incomplete',
    };
  }

  // baseline scoring similar to score_nutrients
  const sugar = Number(nutrients.sugars_100g || nutrients.sugars || nutrients['sugars_100g'] || 0);
  const fat = Number(nutrients.fat_100g || nutrients.fat || 0);
  const salt = Number(nutrients.salt_100g || nutrients.salt || nutrients.sodium_100g || 0);

  let score = hasNutritionData ? 10 : 7; // Start at 10 if we have data, 7 if only ingredients
  const breakdownParts = [];

  if (sugar > 10) {
    score -= 2;
    breakdownParts.push({ type: 'baseline', text: 'High sugar content (>10g)', points: -2 });
  }
  if (fat > 20) {
    score -= 1;
    breakdownParts.push({ type: 'baseline', text: 'High fat content (>20g)', points: -1 });
  }
  if (salt > 1.5) {
    score -= 2;
    breakdownParts.push({ type: 'baseline', text: 'High salt content (>1.5g)', points: -2 });
  }

  let penalty = 0;
  const warnings = [];

  // Apply health rules per user condition
  const conditions = Array.isArray(userProfile.conditions) ? userProfile.conditions : [];
  conditions.forEach((condRaw) => {
    const cond = String(condRaw || '').trim().toLowerCase();
    const rules = HEALTH_RULES[cond];
    if (!rules) return;

    // nutrients
    const nutrientRules = rules.nutrients || {};
    Object.keys(nutrientRules).forEach((nutr) => {
      const limit = nutrientRules[nutr].max;
      const penal = nutrientRules[nutr].penalty || 0;
      // Try various keys for the nutrient
      const v = Number(nutrients[nutr] ?? nutrients[nutr.replace('_100g', '')] ?? nutrients[nutr.replace('s_100g', '')] ?? 0);

      if (typeof limit === 'number' && v > limit) {
        penalty += penal;
        const msg = `${cond.charAt(0).toUpperCase() + cond.slice(1)}: High ${nutr.split('_')[0]} (${v} > ${limit})`;
        breakdownParts.push({ type: 'condition', text: msg, points: -penal });
        (rules.warnings || []).forEach(w => warnings.push(w));
      }
    });

    // ingredients
    (Array.isArray(rules.ingredients) ? rules.ingredients : []).forEach((bad) => {
      try {
        const badStr = String(bad || '').toLowerCase();
        if (badStr && ingredients.includes(badStr)) {
          const p = (rules.penalty_points || 3);
          penalty += p;
          breakdownParts.push({ type: 'condition', text: `${cond.charAt(0).toUpperCase() + cond.slice(1)}: Avoid "${badStr}"`, points: -p });
          (rules.warnings || []).forEach(w => warnings.push(w));
        }
      } catch (e) { }
    });
  });

  // Allergy check
  const allergies = Array.isArray(userProfile.allergies) ? userProfile.allergies : [];
  allergies.forEach((allergyId) => {
    try {
      const allergyRules = HEALTH_RULES[allergyId];
      if (allergyRules && Array.isArray(allergyRules.ingredients)) {
        allergyRules.ingredients.forEach((allergen) => {
          if (allergen && ingredients.includes(String(allergen).toLowerCase())) {
            penalty += 5;
            breakdownParts.push({ type: 'allergy', text: `ALLERGY: Contains ${allergen}`, points: -5 });
            warnings.push(`[HIGH] Contains allergen: ${allergen}`);
          }
        });
      }
    } catch (e) { }
  });

  const finalScore10 = Math.max(1, Math.round(score - penalty));
  const finalScore100 = finalScore10 * 10;

  const tier = finalScore10 >= 8 ? 'Daily' : finalScore10 >= 5 ? 'Moderate' : 'Occasional';
  const uniqWarnings = Array.from(new Set(warnings));

  return {
    Product: String(nutrients.product_name || nutrients.name || 'Unknown'),
    Score: finalScore10,
    score10: finalScore10,
    score: finalScore100,
    Tier: tier,
    Confidence: 'MEDIUM',
    explanation: `Score: ${finalScore10}/10 — ${tier}`,
    personalizedWarnings: uniqWarnings,
    Warnings: uniqWarnings,
    breakdown: breakdownParts,
    totalPenalty: penalty,
    scoring_method: 'RULE_BASED_LEGACY',
    _source: 'local-rules'
  };
}

// Export both ML and legacy versions
export const scoreFromRules = scoreFromRulesML;
export const scoreFromRulesSync = scoreFromRulesLegacy; // Synchronous version for compatibility
