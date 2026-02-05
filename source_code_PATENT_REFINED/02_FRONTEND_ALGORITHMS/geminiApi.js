import { GEMINI_API_KEY, GEMINI_API_URL } from '../constants/config';
import { db } from '../firebase';
import { doc, setDoc, getDoc, collection } from 'firebase/firestore';

/**
 * Call Gemini API to analyze ingredients and get descriptions
 * @param {Array} ingredients - Array of ingredient names
 * @returns {Promise<Object>} - Object with filtered food ingredients and their descriptions
 */
export const analyzeIngredientsWithGemini = async (ingredients) => {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    console.warn('Gemini API key not configured. Using fallback ingredient analysis.');
    return getFallbackIngredientAnalysis(ingredients);
  }

  try {
    const ingredientList = Array.isArray(ingredients) ? ingredients : [];
    
    if (ingredientList.length === 0) {
      return { ingredients: [], additives: [], filteredOut: [] };
    }

    // Try to get cached analysis first (temporarily disabled for improved categorization)
    // const cachedAnalysis = await getCachedIngredientAnalysis(ingredientList);
    // if (cachedAnalysis) {
    //   console.log('Using cached ingredient analysis');
    //   return cachedAnalysis;
    // }

    const prompt = `
You are a food expert. Analyze this ingredient list and strictly separate into INGREDIENTS and ADDITIVES.

INGREDIENTS = Natural food components (flour, wheat, rice, corn, oil, salt, sugar, spices, herbs, milk, eggs, meat, vegetables, fruits, nuts, beans, etc.)
ADDITIVES = E-numbers, preservatives, artificial colors, flavor enhancers (MSG), stabilizers, emulsifiers, acidity regulators, antioxidants, modified starches, hydrolyzed proteins, artificial flavors, etc.

STRICT RULES:
- E-numbers (E100, E621, etc.) = ALWAYS additive
- Flavor enhancer, MSG, monosodium glutamate = ALWAYS additive  
- Artificial colors (Yellow 6, Red 40, etc.) = ALWAYS additive
- Preservatives, stabilizers, emulsifiers = ALWAYS additive
- Modified/hydrolyzed substances = ALWAYS additive
- Basic foods (flour, oil, salt, sugar, spices) = ALWAYS ingredient

For each item provide:
- name: clean name
- description: EXACTLY 50-70 words in simple terms a regular person can understand
- type: "ingredient" or "additive" 
- riskLevel: "LOW", "MEDIUM", or "HIGH"
- purpose: what it does in the food

EXCLUDE: packaging info, warnings, "may contain", facility info, non-food items

List: ${ingredientList.join(', ')}

Respond with valid JSON:
{
  "ingredients": [
    {
      "name": "name",
      "description": "50-70 word simple explanation",
      "type": "ingredient",
      "riskLevel": "LOW|MEDIUM|HIGH",
      "purpose": "what it does"
    }
  ],
  "additives": [
    {
      "name": "name", 
      "description": "50-70 word simple explanation",
      "type": "additive",
      "riskLevel": "LOW|MEDIUM|HIGH",
      "purpose": "what it does"
    }
  ],
  "filteredOut": ["removed items"]
}
`;

    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.warn(`Gemini API error: ${response.status} ${response.statusText}`);
      if (response.status === 404) {
        console.warn('Gemini API endpoint not found, using fallback analysis');
        return getFallbackIngredientAnalysis(ingredients);
      }
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response format from Gemini API');
    }

    const responseText = data.candidates[0].content.parts[0].text;
    
    // Clean up the response text to extract JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from Gemini response');
    }

    const analysisResult = JSON.parse(jsonMatch[0]);
    
    // Validate the response structure
    if (!analysisResult.ingredients || !Array.isArray(analysisResult.ingredients) ||
        !analysisResult.additives || !Array.isArray(analysisResult.additives)) {
      throw new Error('Invalid analysis result structure');
    }

    // Store in Firestore for caching
    await storeIngredientAnalysisInDb(ingredientList, analysisResult);

    return analysisResult;

  } catch (error) {
    console.warn('Error calling Gemini API:', error.message || error);
    
    // Fallback to basic analysis
    return getFallbackIngredientAnalysis(ingredients);
  }
};

/**
 * Store ingredient analysis in Firestore for caching
 */
const storeIngredientAnalysisInDb = async (originalIngredients, analysis) => {
  try {
    const ingredientKey = originalIngredients.sort().join(',').toLowerCase();
    const docId = btoa(ingredientKey).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    
    const docRef = doc(db, 'ingredientAnalysis', docId);
    await setDoc(docRef, {
      originalIngredients,
      analysis,
      createdAt: new Date(),
      version: '1.2' // Updated version for improved categorization
    });
    
    // Store individual ingredients/additives for quick lookup
    [...analysis.ingredients, ...analysis.additives].forEach(async (item) => {
      const itemDocRef = doc(db, 'ingredientInfo', item.name.toLowerCase().replace(/[^a-zA-Z0-9]/g, ''));
      await setDoc(itemDocRef, {
        ...item,
        lastUpdated: new Date()
      }, { merge: true });
    });
  } catch (error) {
    console.warn('Could not store analysis in Firestore:', error);
  }
};

/**
 * Try to get cached ingredient analysis from Firestore
 */
const getCachedIngredientAnalysis = async (ingredients) => {
  try {
    const ingredientKey = ingredients.sort().join(',').toLowerCase();
    const docId = btoa(ingredientKey).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    
    const docRef = doc(db, 'ingredientAnalysis', docId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // Skip cache if it's been deleted or is old version
      if (data.deleted || data.version !== '1.2') {
        return null;
      }
      
      // Check if cache is less than 30 days old
      const cacheAge = Date.now() - data.createdAt.toDate().getTime();
      if (cacheAge < 30 * 24 * 60 * 60 * 1000) { // 30 days
        return data.analysis;
      }
    }
  } catch (error) {
    console.warn('Could not fetch cached analysis:', error);
  }
  return null;
};

/**
 * Fallback ingredient analysis when Gemini API is not available
 * @param {Array} ingredients - Array of ingredient names
 * @returns {Object} - Basic ingredient analysis
 */
const getFallbackIngredientAnalysis = (ingredients) => {
  const ingredientList = Array.isArray(ingredients) ? ingredients : [];
  
  // Basic food ingredient patterns
  const nonFoodPatterns = [
    /packaging/i, /wrapper/i, /container/i, /box/i, /can/i, /bottle/i,
    /machine/i, /equipment/i, /facility/i, /plant/i, /factory/i,
    /allergen info/i, /manufactured/i, /processed in/i, /contains:/i,
    /may contain/i, /warning/i, /notice/i, /storage/i, /best before/i
  ];

  const additivePatterns = [
    /e\d{3}/i, /preservative/i, /sodium benzoate/i, /potassium sorbate/i,
    /citric acid/i, /ascorbic acid/i, /tocopherol/i, /stabilizer/i, 
    /emulsifier/i, /thickener/i, /gelling agent/i, /anti-caking/i, 
    /lecithin/i, /carrageenan/i, /xanthan/i, /guar gum/i, /color/i, /colour/i,
    /artificial/i, /natural flavor/i, /flavor/i, /monosodium glutamate/i,
    /msg/i, /acidity regulator/i, /anticaking agent/i, /antioxidant/i,
    /flavor enhancer/i, /raising agent/i, /sodium chloride/i, /caramel/i,
    /yellow \d/i, /red \d/i, /blue \d/i, /sunset yellow/i, /tartrazine/i,
    /allura red/i, /brilliant blue/i, /sodium/i, /calcium/i, /potassium/i,
    /phosphate/i, /sulfate/i, /nitrate/i, /nitrite/i, /dextrose/i,
    /maltodextrin/i, /glucose syrup/i, /corn syrup/i, /modified starch/i,
    /hydrolyzed/i, /autolyzed/i, /extract/i, /concentrate/i, /isolate/i,
    // Specific additives from the screenshot
    /\d{3}[a-z]?\)?$/i, // E-number patterns like 160c, 330, 296, etc.
    /acidity regulators?/i, /colouring?/i, /coloring?/i,
    /seasoning.*spices.*condiments/i, /spices.*condiments/i
  ];

  const naturalIngredients = [];
  const additives = [];
  const filteredOut = [];

  // Helper function to clean and format ingredient names
  const cleanIngredientName = (rawName) => {
    if (!rawName) return '';
    
    let cleaned = String(rawName).trim();
    
    // Remove trailing commas, periods, and asterisks
    cleaned = cleaned.replace(/[,.*]+$/, '');
    
    // Handle incomplete brackets
    const openBrackets = (cleaned.match(/\(/g) || []).length;
    const closeBrackets = (cleaned.match(/\)/g) || []).length;
    
    if (openBrackets > closeBrackets) {
      cleaned = cleaned + ')';
    } else if (closeBrackets > openBrackets) {
      cleaned = cleaned.replace(/\)+$/, '');
    }
    
    // Clean up formatting
    cleaned = cleaned
      .replace(/\s*\(\s*/g, ' (')
      .replace(/\s*\)\s*/g, ') ')
      .replace(/\s+/g, ' ')
      .replace(/^\*+/, '')
      .replace(/\*+$/, '')
      .trim();
    
    return cleaned;
  };

  ingredientList.forEach(ingredient => {
    const rawName = ingredient.trim();
    if (!rawName) return;
    
    const name = cleanIngredientName(rawName);

    // Check if it's a non-food item
    const isNonFood = nonFoodPatterns.some(pattern => pattern.test(name));
    
    if (isNonFood) {
      filteredOut.push(name);
      return;
    }

    // More specific categorization logic
    const lowerName = name.toLowerCase();
    
    // Check for specific additive patterns first
    let isAdditive = false;
    let riskLevel = 'LOW';
    let purpose = 'Food component';
    
    // E-numbers and specific additives
    if (/\b(e?\d{3}[a-z]?)\b/i.test(name) || /\b\d{3}[a-z]?\)/i.test(name)) {
      isAdditive = true;
      riskLevel = 'MEDIUM';
      purpose = 'Food additive (E-number)';
    }
    // Color additives
    else if (/colou?r/i.test(name)) {
      isAdditive = true;
      riskLevel = 'MEDIUM';
      purpose = 'Artificial coloring';
    }
    // Acidity regulators
    else if (/acidity\s+regulator/i.test(name)) {
      isAdditive = true;
      riskLevel = 'LOW';
      purpose = 'pH control agent';
    }
    // Maltodextrin and modified substances
    else if (/maltodextrin|modified|hydrolyzed/i.test(name)) {
      isAdditive = true;
      riskLevel = 'MEDIUM';
      purpose = 'Processing aid';
    }
    // Seasoning with spices (could be mixed)
    else if (/seasoning.*spice/i.test(name) && /\(/i.test(name)) {
      isAdditive = true;
      riskLevel = 'MEDIUM';
      purpose = 'Flavor blend with additives';
    }
    // Check other additive patterns
    else {
      isAdditive = additivePatterns.some(pattern => pattern.test(name));
      if (isAdditive) {
        riskLevel = 'MEDIUM';
        purpose = 'Food processing aid';
      }
    }
    
    if (isAdditive) {
      additives.push({
        name: name,
        description: `${name} is a food additive used to preserve, stabilize, or enhance food products. It helps maintain quality, appearance, or flavor in processed foods and is regulated for safe consumption.`,
        type: 'additive',
        riskLevel: riskLevel,
        purpose: purpose
      });
    } else {
      naturalIngredients.push({
        name: name,
        description: `${name} is a natural food ingredient commonly used in food preparation and cooking. It provides flavor, nutrition, or texture to the product and comes from natural sources.`,
        type: 'ingredient',
        riskLevel: 'LOW',
        purpose: 'Natural food component'
      });
    }
  });

  return {
    ingredients: naturalIngredients,
    additives,
    filteredOut
  };
};

/**
 * Get detailed ingredient information for a single ingredient
 * @param {string} ingredientName - Name of the ingredient
 * @returns {Promise<Object>} - Detailed ingredient information
 */
export const getIngredientDetails = async (ingredientName) => {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    return {
      name: ingredientName,
      description: `${ingredientName} is a food ingredient.`,
      category: 'natural',
      riskLevel: 'LOW',
      healthImpact: 'Generally considered safe for consumption.',
      alternatives: []
    };
  }

  try {
    const prompt = `
Provide detailed information about the food ingredient: "${ingredientName}"

Include:
- description: What is this ingredient? (2-3 sentences)
- category: one of [natural, preservative, additive, sweetener, colorant, flavor, emulsifier, stabilizer, vitamin, mineral]
- riskLevel: one of [LOW, MEDIUM, HIGH] based on health concerns
- healthImpact: detailed health effects and considerations
- alternatives: array of healthier alternatives (if applicable)

Respond ONLY with valid JSON:
{
  "name": "${ingredientName}",
  "description": "detailed description",
  "category": "category",
  "riskLevel": "LOW|MEDIUM|HIGH",
  "healthImpact": "health impact details",
  "alternatives": ["alternative1", "alternative2"]
}
`;

    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.candidates[0].content.parts[0].text;
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from response');
    }

    return JSON.parse(jsonMatch[0]);

  } catch (error) {
    console.error('Error getting ingredient details:', error);
    return {
      name: ingredientName,
      description: `${ingredientName} is a food ingredient.`,
      category: 'natural',
      riskLevel: 'LOW',
      healthImpact: 'Generally considered safe for consumption.',
      alternatives: []
    };
  }
}

/**
 * Clear ingredient analysis cache (for testing improved categorization)
 * @param {Array} ingredients - Ingredient list to clear cache for
 */
export const clearIngredientCache = async (ingredients) => {
  try {
    const ingredientKey = ingredients.sort().join(',').toLowerCase();
    const docId = btoa(ingredientKey).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    const docRef = doc(db, 'ingredientAnalysis', docId);
    
    await setDoc(docRef, { 
      deleted: true, 
      deletedAt: new Date(),
      originalIngredients: ingredients
    });
    
    console.log('Ingredient cache cleared for:', ingredients.join(', '));
  } catch (error) {
    console.warn('Failed to clear ingredient cache:', error);
  }
};;