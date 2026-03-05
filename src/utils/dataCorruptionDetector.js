/**
 * Data Corruption Detection Utility
 * Detects garbage/corrupted data in product objects from various sources
 */

// Valid nutrition keys that should appear in nutriments
const VALID_NUTRIMENT_KEYS = [
  'energy-kcal_100g', 'energy_kcal_100g', 'energy_100g', 'calories',
  'sugars_100g', 'sugars',
  'fat_100g', 'fat', 'total_fat',
  'saturated-fat_100g', 'saturated_fat_100g', 'saturated_fat',
  'proteins_100g', 'proteins', 'protein',
  'carbohydrates_100g', 'carbohydrates', 'carbs',
  'salt_100g', 'salt',
  'sodium_100g', 'sodium',
  'fiber_100g', 'fiber', 'fibre',
  'serving_size', 'serving_quantity'
];

// Maximum realistic values per 100g (anything above is corruption/data error)
const NUTRIMENT_MAX_VALUES = {
  'salt_100g': 50,           // Even soy sauce is ~15g
  'salt': 50,
  'sodium_100g': 20,         // ~40% of salt weight  
  'sodium': 20,
  'sugars_100g': 100,        // Pure sugar = 100g
  'sugars': 100,
  'fat_100g': 100,           // Pure fat = 100g
  'fat': 100,
  'total_fat': 100,
  'saturated-fat_100g': 100,
  'saturated_fat_100g': 100,
  'saturated_fat': 100,
  'proteins_100g': 100,      // Pure protein powder ~80-90g
  'proteins': 100,
  'protein': 100,
  'carbohydrates_100g': 100, // Pure carbs = 100g
  'carbohydrates': 100,
  'carbs': 100,
  'fiber_100g': 50,          // Psyllium husk ~80g but very rare
  'fiber': 50,
  'fibre': 50,
  'energy-kcal_100g': 900,   // Pure oil ~900 kcal
  'energy_kcal_100g': 900,
  'energy_100g': 3800,       // In kJ (900 kcal × 4.184)
  'calories': 900
};

// Patterns that indicate corrupted ingredients (OCR artifacts, package text)
const CORRUPTED_INGREDIENT_PATTERNS = [
  /license|lic\.|lic no|lic:/i,
  /lot no|lot:|batch/i,
  /address|addr\.|manufactured at|mfg\./i,
  /fssai|food safety/i,
  /carbo?hydrate|ydrate/i,  // "ydrate" from bad OCR of "Carbohydrate"
  /fatty acids/i,
  /total fat|saturated fat/i,
  /nutritional? info/i,
  /per 100g|per serving/i,
  /calories|energy|kcal/i,
  /proteins|protein/i,
  /\d+g\/\d+/,  // Pattern like "19g/141" (nutrition data)
  /^\d+\s*g$/,  // Just "57g" or "100 g"
  /trademark|®|™|©/i,
  /best before|use by|exp\./i,
  /madhya pradesh|uttar pradesh|india/i  // Location names
];

/**
 * Check if ingredients array contains corrupted/garbage data
 * @param {Array} ingredients - Array of ingredient objects or strings
 * @returns {Object} { isCorrupted: boolean, corruptedItems: Array, reason: string }
 */
export function detectCorruptedIngredients(ingredients) {
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return { isCorrupted: false, corruptedItems: [], reason: null };
  }

  const corruptedItems = [];
  
  ingredients.forEach((ingredient, index) => {
    const text = typeof ingredient === 'string' ? ingredient : (ingredient.name || ingredient.text || '');
    
    // Check against corruption patterns
    for (const pattern of CORRUPTED_INGREDIENT_PATTERNS) {
      if (pattern.test(text)) {
        corruptedItems.push({
          index,
          text,
          pattern: pattern.toString()
        });
        break;  // One match is enough
      }
    }
  });

  if (corruptedItems.length > 0) {
    return {
      isCorrupted: true,
      corruptedItems,
      reason: `Found ${corruptedItems.length} corrupted ingredient entries (OCR artifacts or package text)`
    };
  }

  return { isCorrupted: false, corruptedItems: [], reason: null };
}

/**
 * Check if nutriments object contains garbage keys (not real nutrition data)
 * @param {Object} nutriments - Product nutriments object
 * @returns {Object} { hasGarbage: boolean, garbageKeys: Array, validKeyCount: number, absurdValues: Array }
 */
export function detectGarbageNutriments(nutriments) {
  if (!nutriments || typeof nutriments !== 'object') {
    return { hasGarbage: false, garbageKeys: [], validKeyCount: 0, absurdValues: [] };
  }

  const allKeys = Object.keys(nutriments);
  const garbageKeys = [];
  const absurdValues = [];
  let validKeyCount = 0;

  allKeys.forEach(key => {
    // Skip metadata keys
    if (key.startsWith('_') || key === 'serving_size' || key === 'serving_quantity') {
      return;
    }

    // Check if it's a valid nutrition key
    const isValid = VALID_NUTRIMENT_KEYS.some(validKey => 
      key === validKey || key.includes(validKey.replace('_100g', ''))
    );

    if (isValid && typeof nutriments[key] === 'number') {
      validKeyCount++;
      
      // Check for absurd values (physically impossible)
      const maxValue = NUTRIMENT_MAX_VALUES[key];
      if (maxValue && nutriments[key] > maxValue) {
        absurdValues.push({
          key,
          value: nutriments[key],
          max: maxValue,
          ratio: (nutriments[key] / maxValue).toFixed(1)
        });
      }
    } else if (!isValid && key.includes('100g')) {
      // Key contains 100g but not in valid list - likely garbage
      garbageKeys.push(key);
    }
  });

  return {
    hasGarbage: garbageKeys.length > 0 || absurdValues.length > 0,
    garbageKeys,
    absurdValues,
    validKeyCount
  };
}

/**
 * Comprehensive corruption check for product data
 * @param {Object} product - Product object from any source
 * @returns {Object} { 
 *   isCorrupted: boolean, 
 *   issues: Array<string>,
 *   ingredientsCorrupted: boolean,
 *   nutrimentsHaveGarbage: boolean,
 *   details: Object 
 * }
 */
export function detectProductCorruption(product) {
  if (!product) {
    return { isCorrupted: false, issues: [], ingredientsCorrupted: false, nutrimentsHaveGarbage: false };
  }

  const issues = [];
  let ingredientsCorrupted = false;
  let nutrimentsHaveGarbage = false;

  // Check ingredients
  if (product.ingredients && Array.isArray(product.ingredients)) {
    const ingredientCheck = detectCorruptedIngredients(product.ingredients);
    if (ingredientCheck.isCorrupted) {
      ingredientsCorrupted = true;
      issues.push(ingredientCheck.reason);
    }
  }

  // Check nutriments
  const nutriments = product.nutriments || product.nutrition || {};
  const nutrimentCheck = detectGarbageNutriments(nutriments);
  if (nutrimentCheck.hasGarbage) {
    nutrimentsHaveGarbage = true;
    
    if (nutrimentCheck.garbageKeys.length > 0) {
      issues.push(`Found ${nutrimentCheck.garbageKeys.length} garbage nutrition fields: ${nutrimentCheck.garbageKeys.slice(0, 3).join(', ')}`);
    }
    
    if (nutrimentCheck.absurdValues.length > 0) {
      const absurdDetails = nutrimentCheck.absurdValues.map(v => 
        `${v.key}=${v.value}g (${v.ratio}x over limit)`
      ).join(', ');
      issues.push(`Found ${nutrimentCheck.absurdValues.length} impossible nutrition values: ${absurdDetails}`);
    }
  }

  // Check if has almost no valid nutrition data
  if (nutrimentCheck.validKeyCount < 2) {
    issues.push('Insufficient valid nutrition data (need at least 2 fields)');
  }

  return {
    isCorrupted: ingredientsCorrupted || nutrimentsHaveGarbage || nutrimentCheck.validKeyCount < 2,
    issues,
    ingredientsCorrupted,
    nutrimentsHaveGarbage,
    details: {
      ingredientCheck: ingredientsCorrupted ? detectCorruptedIngredients(product.ingredients) : null,
      nutrimentCheck
    }
  };
}

/**
 * Clean garbage keys from nutriments object
 * @param {Object} nutriments - Nutriments object
 * @returns {Object} Cleaned nutriments with only valid keys
 */
export function cleanNutriments(nutriments) {
  if (!nutriments || typeof nutriments !== 'object') {
    return {};
  }

  const cleaned = {};
  Object.keys(nutriments).forEach(key => {
    // Keep metadata keys
    if (key.startsWith('_')) {
      cleaned[key] = nutriments[key];
      return;
    }

    // Check if valid nutrition key
    const isValid = VALID_NUTRIMENT_KEYS.some(validKey => 
      key === validKey || key.includes(validKey.replace('_100g', ''))
    );

    if (isValid) {
      cleaned[key] = nutriments[key];
    }
  });

  return cleaned;
}

/**
 * Auto-correct absurd nutritional values (likely unit conversion errors)
 * @param {Object} nutriments - Nutriments object
 * @returns {Object} { corrected: Object, corrections: Array }
 */
export function autoCorrectNutriments(nutriments) {
  if (!nutriments || typeof nutriments !== 'object') {
    return { corrected: {}, corrections: [] };
  }

  const corrected = { ...nutriments };
  const corrections = [];

  Object.keys(nutriments).forEach(key => {
    if (key.startsWith('_') || typeof nutriments[key] !== 'number') {
      return;
    }

    const maxValue = NUTRIMENT_MAX_VALUES[key];
    if (!maxValue) return;

    const value = nutriments[key];
    
    // If value is absurdly high, likely mg entered as g
    if (value > maxValue) {
      // For salt/sodium, if > maxValue, probably meant mg → divide by 1000
      if (key.includes('salt') || key.includes('sodium')) {
        const correctedValue = Math.round((value / 1000) * 100) / 100; // 2 decimal places
        corrected[key] = correctedValue;
        corrections.push({
          key,
          original: value,
          corrected: correctedValue,
          reason: 'Likely milligrams entered as grams (÷1000)'
        });
      }
      // For other nutrients, if > 2x limit, cap to limit or divide by 10
      else if (value > maxValue * 2) {
        // If dividing by 10 brings it in range, do that (common decimal point error)
        const dividedBy10 = Math.round((value / 10) * 100) / 100;
        if (dividedBy10 <= maxValue) {
          corrected[key] = dividedBy10;
          corrections.push({
            key,
            original: value,
            corrected: dividedBy10,
            reason: 'Decimal point error (÷10)'
          });
        } else {
          // Otherwise cap to max value
          corrected[key] = maxValue;
          corrections.push({
            key,
            original: value,
            corrected: maxValue,
            reason: `Capped to maximum realistic value (${maxValue}g)`
          });
        }
      }
    }
  });

  return { corrected, corrections };
}
