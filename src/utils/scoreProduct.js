// Simple heuristic scoring and ingredient analysis
// Returns score (0-100), breakdown, personalizedWarnings, explanation, sustainability
import HEALTH_RULES from '../data/health_rules.json';

export function computeProductAnalysis(product = {}, userPrefs = {}) {
  const nutrition = product.nutrition || {};
  const ingredientsRaw = product.ingredients || product.ingredientList || '';
  const ingredients = Array.isArray(ingredientsRaw)
    ? ingredientsRaw.map(i => String(i).toLowerCase())
    : String(ingredientsRaw).split(/[,;\n]/).map(s => s.trim().toLowerCase()).filter(Boolean);

  // Basic normalization helpers
  const normalize = (value, max) => {
    if (value == null || isNaN(Number(value))) return 0;
    const v = Number(value);
    return Math.max(0, Math.min(1, v / max));
  };

  // Components: sugar (g), saturatedFat (g), sodium (mg), calories
  const sugar = normalize(nutrition.sugar_g ?? nutrition.sugars ?? nutrition.sugar, 30);
  const satFat = normalize(nutrition.saturatedFat_g ?? nutrition.sat_fat ?? nutrition.saturated_fat, 10);
  const sodium = normalize(nutrition.sodium_mg ?? nutrition.sodium ?? nutrition.salt_mg, 1000);
  const calories = normalize(nutrition.calories ?? nutrition.kcal, 800);

  // Higher bad components decrease score
  const badScore = (sugar + satFat + sodium + (calories * 0.6)) / 4;
  const baseScore = Math.round((1 - badScore) * 100);

  // Ingredient-based penalties (example lists)
  const allergens = userPrefs.allergens || [];
  const dietary = userPrefs.dietaryPreferences || [];

  const warnings = [];
  let penalty = 0;

  // Check allergens using health rules
  const allergenMatches = [];
  allergens.forEach(allergyId => {
    try {
      const allergyRules = HEALTH_RULES[allergyId];
      if (allergyRules && Array.isArray(allergyRules.ingredients)) {
        // Check each specific allergen ingredient
        allergyRules.ingredients.forEach(allergenIngredient => {
          const normalizedIngredient = String(allergenIngredient).toLowerCase();
          if (ingredients.some(ing => ing.includes(normalizedIngredient))) {
            allergenMatches.push(allergenIngredient);
          }
        });
      } else {
        // Fallback: check if the allergy name itself appears in ingredients
        const low = String(allergyId).toLowerCase();
        if (ingredients.some(ing => ing.includes(low))) {
          allergenMatches.push(allergyId);
        }
      }
    } catch (e) {
      // Fallback to simple matching
      const low = String(allergyId).toLowerCase();
      if (ingredients.some(ing => ing.includes(low))) {
        allergenMatches.push(allergyId);
      }
    }
  });
  if (allergenMatches.length) {
    warnings.push(`Contains ${allergenMatches.join(', ')} (allergen)`);
    penalty += 30;
  }

  // Check dietary conflicts (e.g., vegetarian sees 'gelatin' as conflict)
  const dietConflicts = [];
  if (dietary.includes('vegetarian')) {
    if (ingredients.some(i => i.includes('gelatin') || i.includes('anchovy') || i.includes('fish') || i.includes('meat'))) {
      dietConflicts.push('non-vegetarian ingredient');
    }
  }
  if (dietary.includes('vegan')) {
    if (ingredients.some(i => i.includes('milk') || i.includes('egg') || i.includes('honey') || i.includes('gelatin'))) {
      dietConflicts.push('non-vegan ingredient');
    }
  }
  if (dietConflicts.length) {
    warnings.push(`Not suitable: ${dietConflicts.join(', ')}`);
    penalty += 20;
  }

  // Ingredient hazard simple checks
  const hazardList = ['high fructose corn syrup', 'trans fat', 'partially hydrogenated'];
  const hazards = hazardList.filter(h => ingredients.some(i => i.includes(h)));
  if (hazards.length) {
    warnings.push(`Contains ${hazards.join(', ')}`);
    penalty += 10;
  }

  // Sustainability simple inference
  let sustainability = 'Unknown';
  const packaging = (product.packaging || '').toLowerCase();
  if (packaging.includes('glass')) sustainability = 'Low impact (glass)';
  else if (packaging.includes('recycl') || packaging.includes('paper')) sustainability = 'Medium impact (recyclable)';
  else if (packaging.includes('plastic')) sustainability = 'Higher impact (plastic)';

  // Final score clamp 0..100
  let finalScore = Math.max(0, Math.min(100, baseScore - penalty));

  // One-line explanation
  const explanationParts = [];
  if (finalScore >= 80) explanationParts.push('Excellent choice');
  else if (finalScore >= 60) explanationParts.push('Good choice');
  else if (finalScore >= 40) explanationParts.push('Moderate');
  else explanationParts.push('Consider alternatives');

  if (warnings.length) explanationParts.push(warnings[0]);
  const explanation = explanationParts.join(' — ');

  const breakdown = {
    baseScore,
    penalty,
    sugar: Math.round(sugar * 100),
    saturatedFat: Math.round(satFat * 100),
    sodium: Math.round(sodium * 100),
    calories: Math.round(calories * 100),
  };

  return {
    score: finalScore,
    breakdown,
    personalizedWarnings: warnings,
    explanation,
    sustainability,
    ingredients,
  };
}
