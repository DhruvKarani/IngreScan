/**
 * Product Data Fetcher - Multi-Source Orchestrator
 * 
 * Fetches product data from the FastAPI orchestrator which:
 * - Tries OpenFoodFacts, Edamam, FatSecret (waterfall)
 * - Validates data quality (completeness score)
 * - Returns metadata for verification prompts
 * 
 * Replaces direct OpenFoodFacts API calls with orchestrated multi-source fetching.
 */

import { Platform } from 'react-native';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Get the Product Data Orchestrator API base URL based on environment.
 * 
 * - Android Emulator: 10.0.2.2:5001 (maps to host localhost)
 * - Physical Device (Expo Go): Use your computer's LAN IP
 * - Web/Desktop: 127.0.0.1:5001
 */
const getOrchestratorApiUrl = () => {
  // For development with Expo Go on physical device
  if (__DEV__ && Platform.OS !== 'web') {
    // Updated to match current computer IP address
    return 'http://192.168.0.100:5001';
  }
  
  // For web or desktop testing
  if (Platform.OS === 'web') {
    return 'http://127.0.0.1:5001';
  }
  
  // For Android emulator (maps to host machine's localhost)
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5001';
  }
  
  // For iOS simulator (localhost works directly)
  return 'http://localhost:5001';
};

const ORCHESTRATOR_API_BASE = getOrchestratorApiUrl();
const REQUEST_TIMEOUT = 15000; // 15 seconds (allows time for 3 API sources)

// =============================================================================
// MAIN FETCHER
// =============================================================================

/**
 * Fetch product data using the orchestrator API.
 * 
 * This function calls the FastAPI backend which orchestrates fetching from
 * multiple sources (OFF, Edamam, FatSecret) using waterfall fallback logic.
 * 
 * @param {string} barcode - Product barcode number
 * @param {object} options - Fetch options
 * @param {string} options.strategy - 'waterfall' (default) or 'smart'
 * @returns {Promise<object|null>} Product data with metadata or null if not found
 * 
 * @example
 * const product = await fetchProductData('8901719128462');
 * if (product) {
 *   console.log(`Product: ${product.product_name}`);
 *   console.log(`Completeness: ${product.metadata.completeness_score}%`);
 *   
 *   if (product.metadata.needs_verification) {
 *     // Show verification prompt to user
 *   }
 * }
 */
export async function fetchProductData(barcode, options = {}) {
  const { strategy = 'waterfall' } = options;
  
  if (!barcode || typeof barcode !== 'string') {
    console.warn('[ProductFetcher] Invalid barcode:', barcode);
    return null;
  }
  
  const cleanBarcode = barcode.trim();
  if (!cleanBarcode) {
    console.warn('[ProductFetcher] Empty barcode after trim');
    return null;
  }
  
  const url = `${ORCHESTRATOR_API_BASE}/api/product/${encodeURIComponent(cleanBarcode)}?strategy=${strategy}`;
  
  console.log(`[ProductFetcher] Fetching ${cleanBarcode} from orchestrator (strategy: ${strategy})`);
  
  try {
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT);
    });
    
    // Race between fetch and timeout
    const response = await Promise.race([
      fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      }),
      timeoutPromise
    ]);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[ProductFetcher] Product ${cleanBarcode} not found in any database`);
        return null;
      }
      
      console.warn(`[ProductFetcher] HTTP ${response.status} for barcode ${cleanBarcode}`);
      return null;
    }
    
    const result = await response.json();
    
    console.log('[ProductFetcher] Raw API response:', {
      success: result.success,
      hasData: !!result.data,
      dataKeys: result.data ? Object.keys(result.data) : [],
      nutrimentKeys: result.data?.nutriments ? Object.keys(result.data.nutriments) : [],
      rawNutriments: result.data?.nutriments
    });
    
    if (!result.success || !result.data) {
      console.log(`[ProductFetcher] No data returned for ${cleanBarcode}:`, result.error || 'Unknown error');
      return null;
    }
    
    // Normalize the response to match expected format
    const normalizedProduct = normalizeProductData(result.data, result.metadata);
    
    console.log(
      `[ProductFetcher] ✓ Fetched ${cleanBarcode} - ` +
      `${normalizedProduct.product_name || 'Unknown'} ` +
      `(${result.metadata.completeness_score}% complete, ` +
      `source: ${result.metadata.primary_source})`
    );
    
    return normalizedProduct;
    
  } catch (error) {
    if (error.message === 'Request timeout') {
      console.warn(`[ProductFetcher] Timeout fetching ${cleanBarcode} (>${REQUEST_TIMEOUT}ms)`);
    } else if (error.message.includes('Network request failed')) {
      console.warn(`[ProductFetcher] Network error - Is the API server running at ${ORCHESTRATOR_API_BASE}?`);
    } else {
      console.warn(`[ProductFetcher] Error fetching ${cleanBarcode}:`, error.message);
    }
    
    return null;
  }
}

// =============================================================================
// DATA NORMALIZATION
// =============================================================================

/**
 * Normalize orchestrator response to match expected app format.
 * 
 * Ensures backward compatibility with existing code that expects
 * OpenFoodFacts format while adding new metadata fields.
 * 
 * @param {object} data - Raw product data from orchestrator
 * @param {object} metadata - Quality metadata from orchestrator
 * @returns {object} Normalized product data
 */
function normalizeProductData(data, metadata) {
  // Get nutriments (may already be normalized by Python fetcher)
  const nutr = data.nutriments || {};
  
  console.log('[ProductFetcher] Normalizing nutrition data:', {
    nutrimentKeys: Object.keys(nutr),
    sampleValues: {
      sugars: nutr.sugars_100g || nutr.sugars,
      fat: nutr.fat_100g || nutr.fat,
      energy: nutr['energy-kcal_100g'] || nutr.energy_kcal_100g || nutr.energy,
    }
  });
  
  // Helper to extract value, checking multiple key variations
  const extractNutrient = (baseKey) => {
    const variations = [
      `${baseKey}_100g`,
      baseKey,
      // Handle dash vs underscore
      baseKey.replace(/-/g, '_') + '_100g',
      baseKey.replace(/-/g, '_'),
    ];
    
    for (const key of variations) {
      if (nutr[key] !== undefined && nutr[key] !== null && nutr[key] !== '') {
        const val = Number(nutr[key]);
        if (!isNaN(val)) {
          // Special handling for energy - might be in kJ
          if (baseKey.includes('energy') || baseKey.includes('kcal')) {
            // If value is very large (> 2000), it's probably kJ, convert to kcal
            if (val > 2000) {
              return Math.round(val / 4.184);
            }
          }
          return val;
        }
      }
    }
    return 0;
  };
  
  // Build normalized nutriments object with robust key matching
  const normalizedNutriments = {
    sugars_100g: extractNutrient('sugars'),
    fat_100g: extractNutrient('fat'),
    salt_100g: extractNutrient('salt') || extractNutrient('sodium'),
    proteins_100g: extractNutrient('proteins') || extractNutrient('protein'),
    carbohydrates_100g: extractNutrient('carbohydrates'),
    fiber_100g: extractNutrient('fiber'),
    'energy-kcal_100g': extractNutrient('energy-kcal') || extractNutrient('energy_kcal') || extractNutrient('energy') || extractNutrient('calories'),
    'saturated-fat_100g': extractNutrient('saturated-fat') || extractNutrient('saturated_fat'),
    __raw: nutr, // Keep raw for any additional lookups
  };
  
  console.log('[ProductFetcher] Normalized nutriments:', normalizedNutriments);
  
  // Extract allergens (normalize to array)
  let allergens = [];
  if (data.allergens) {
    if (Array.isArray(data.allergens)) {
      allergens = data.allergens;
    } else if (typeof data.allergens === 'string') {
      allergens = data.allergens.split(/[,;]/).map(a => a.trim()).filter(Boolean);
    }
  }
  
  // Normalize missing_fields (API returns categorized object, flatten to array)
  let missingFields = [];
  if (metadata.missing_fields) {
    if (Array.isArray(metadata.missing_fields)) {
      missingFields = metadata.missing_fields;
    } else if (typeof metadata.missing_fields === 'object') {
      // Flatten categorized missing fields
      missingFields = [
        ...(metadata.missing_fields.critical || []),
        ...(metadata.missing_fields.important || []),
        ...(metadata.missing_fields.optional || [])
      ];
    }
  }
  
  // Build normalized product object
  const normalized = {
    // Core fields (backward compatible)
    product_name: data.product_name || data.name || '',
    ingredients_text: data.ingredients_text || '',
    nutriments: normalizedNutriments,
    brands: data.brands || '',
    categories: data.categories || '',
    image_url: data.image_url || '',
    barcode: data.barcode || '',
    
    // Additional data
    allergens: allergens,
    serving_size: data.serving_size || '',
    quantity: data.quantity || '',
    
    // Firebase verification tracking - PRESERVE FROM API
    verifiedCount: data.verifiedCount || 0,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    
    // NEW: Quality metadata from orchestrator
    metadata: {
      completeness_score: metadata.completeness_score || 0,
      confidence: metadata.confidence || 'UNKNOWN',
      needs_verification: metadata.needs_verification !== false, // Default true for safety
      missing_fields: missingFields, // Flattened array of missing field names
      verified_count: data.verifiedCount || 0, // Sync with verifiedCount
      primary_source: metadata.primary_source || 'UNKNOWN',
      sources_tried: metadata.sources_tried || [],
      sources_used: metadata.sources_used || [],
      source_contributions: metadata.source_contributions || {},
    },
    
    // Keep raw data for debugging
    _raw: data._raw || data,
    _source: metadata.primary_source || 'orchestrator',
  };
  
  return normalized;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Fetch product data from all sources for comparison.
 * 
 * Useful for debugging or showing users which sources have data.
 * 
 * @param {string} barcode - Product barcode
 * @returns {Promise<object|null>} Comparison data from all sources
 */
export async function fetchProductFromAllSources(barcode) {
  if (!barcode || typeof barcode !== 'string') {
    return null;
  }
  
  const cleanBarcode = barcode.trim();
  const url = `${ORCHESTRATOR_API_BASE}/api/product/${encodeURIComponent(cleanBarcode)}/sources`;
  
  console.log(`[ProductFetcher] Fetching ${cleanBarcode} from ALL sources`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.warn(`[ProductFetcher] HTTP ${response.status} for all-sources fetch`);
      return null;
    }
    
    const result = await response.json();
    
    console.log(
      `[ProductFetcher] Sources available: ${result.comparison?.available_sources?.join(', ') || 'none'}`
    );
    
    return result;
    
  } catch (error) {
    console.warn('[ProductFetcher] Error fetching from all sources:', error.message);
    return null;
  }
}

/**
 * Check if the orchestrator API is healthy.
 * 
 * @returns {Promise<boolean>} True if API is running and healthy
 */
export async function checkOrchestratorHealth() {
  const url = `${ORCHESTRATOR_API_BASE}/health`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      timeout: 5000,
    });
    
    if (!response.ok) {
      return false;
    }
    
    const result = await response.json();
    const isHealthy = result.status === 'healthy';
    
    console.log(
      `[ProductFetcher] Orchestrator API ${isHealthy ? '✓' : '✗'} ` +
      `(${result.service} v${result.version})`
    );
    
    return isHealthy;
    
  } catch (error) {
    console.warn('[ProductFetcher] Health check failed:', error.message);
    return false;
  }
}

/**
 * Get orchestrator API configuration info.
 * 
 * @returns {object} API configuration
 */
export function getOrchestratorConfig() {
  return {
    baseUrl: ORCHESTRATOR_API_BASE,
    timeout: REQUEST_TIMEOUT,
    platform: Platform.OS,
  };
}

// =============================================================================
// BACKWARD COMPATIBILITY
// =============================================================================

/**
 * Fetch product from OpenFoodFacts via orchestrator.
 * 
 * This is a backward-compatible wrapper that maintains the same
 * function signature as the old fetchProductFromOFF function.
 * 
 * @deprecated Use fetchProductData instead for full metadata
 * @param {string} barcode - Product barcode
 * @returns {Promise<object|null>} Product data (OpenFoodFacts format)
 */
export async function fetchProductFromOFF(barcode) {
  console.warn(
    '[ProductFetcher] fetchProductFromOFF is deprecated. ' +
    'Use fetchProductData for full metadata support.'
  );
  
  // Call new fetcher and return in old format
  const product = await fetchProductData(barcode);
  
  if (!product) {
    return null;
  }
  
  // Return without metadata for backward compatibility
  const { metadata, _raw, _source, ...legacyFormat } = product;
  
  return {
    ...legacyFormat,
    raw: _raw, // Keep raw data field name
  };
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  fetchProductData,
  fetchProductFromAllSources,
  checkOrchestratorHealth,
  getOrchestratorConfig,
  fetchProductFromOFF, // For backward compatibility
};
