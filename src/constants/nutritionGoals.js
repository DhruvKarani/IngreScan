export const NUTRITION_GOALS_DATA = {
  high_protein: {
    id: 'high_protein',
    name: 'High Protein',
    icon: '💪',
    color: '#FF6B6B',
    shortDescription: 'Foods rich in protein for muscle building',
    expertExplanation: 'High protein foods support muscle growth, tissue repair, and help maintain satiety for longer periods.',
    whatItMeans: 'High protein foods contain significant amounts of complete or complementary proteins that provide essential amino acids your body needs for muscle maintenance, immune function, and enzyme production. These foods help you feel full longer and support healthy metabolism.',
    howIngreScanEvaluates: [
      'Analyzes protein content per 100g serving',
      'Checks for complete vs. incomplete protein sources',
      'Considers protein-to-calorie ratio for efficiency',
      'Evaluates amino acid profile when available',
      'Flags processed protein additives vs. natural sources'
    ],
    ingredientsToWatch: [
      { name: 'Whey Protein Isolate', note: 'High-quality complete protein, easily absorbed' },
      { name: 'Casein', note: 'Slow-release protein, good for sustained amino acid delivery' },
      { name: 'Soy Protein', note: 'Plant-based complete protein with all essential amino acids' },
      { name: 'Pea Protein', note: 'Hypoallergenic plant protein, rich in branched-chain amino acids' },
      { name: 'Hydrolyzed Protein', note: 'Pre-digested protein for faster absorption' },
      { name: 'Protein Concentrates', note: 'Check purity levels and processing methods' }
    ],
    expertTips: [
      'Aim for 20-30g protein per meal for optimal muscle protein synthesis',
      'Combine incomplete plant proteins to create complete amino acid profiles',
      'Natural protein sources are generally better than heavily processed alternatives',
      'Check if protein claims match actual nutritional content per serving'
    ]
  },
  
  high_fiber: {
    id: 'high_fiber',
    name: 'High Fiber',
    icon: '🌾',
    color: '#4ECDC4',
    shortDescription: 'Fiber-rich foods for digestive health',
    expertExplanation: 'High fiber foods promote digestive health, help control blood sugar, and support heart health through cholesterol management.',
    whatItMeans: 'High fiber foods contain significant amounts of indigestible plant material that supports digestive health, helps regulate blood sugar levels, promotes satiety, and feeds beneficial gut bacteria. Fiber comes in soluble and insoluble forms, each with unique benefits.',
    howIngreScanEvaluates: [
      'Measures total dietary fiber per 100g serving',
      'Distinguishes between soluble and insoluble fiber when possible',
      'Checks for added fiber vs. naturally occurring fiber',
      'Evaluates fiber-to-sugar ratio for blood glucose impact',
      'Identifies processed foods with synthetic fiber additives'
    ],
    ingredientsToWatch: [
      { name: 'Inulin', note: 'Prebiotic fiber that feeds beneficial gut bacteria' },
      { name: 'Psyllium Husk', note: 'Soluble fiber that helps lower cholesterol' },
      { name: 'Methylcellulose', note: 'Synthetic fiber additive, less beneficial than natural sources' },
      { name: 'Wheat Bran', note: 'High in insoluble fiber, aids digestive regularity' },
      { name: 'Oat Beta-Glucan', note: 'Soluble fiber proven to reduce cholesterol levels' },
      { name: 'Chicory Root Fiber', note: 'Natural prebiotic fiber, may cause digestive upset in sensitive individuals' }
    ],
    expertTips: [
      'Gradually increase fiber intake to avoid digestive discomfort',
      'Drink plenty of water when consuming high-fiber foods',
      'Natural fiber sources are preferable to synthetic additives',
      'A mix of soluble and insoluble fiber provides optimal benefits'
    ]
  },
  
  low_sugar: {
    id: 'low_sugar',
    name: 'Low Sugar',
    icon: '🍯',
    color: '#45B7D1',
    shortDescription: 'Low sugar options for better health',
    expertExplanation: 'Low sugar foods help maintain stable blood glucose levels, reduce diabetes risk, and prevent energy crashes throughout the day.',
    whatItMeans: 'Low sugar foods contain minimal added sugars and rely on natural sweetness or sugar alternatives. These foods help prevent blood sugar spikes, reduce cravings, and support sustained energy levels without the crash associated with high-sugar foods.',
    howIngreScanEvaluates: [
      'Analyzes total sugar content per 100g serving',
      'Identifies added sugars vs. naturally occurring sugars',
      'Checks ingredient list position of sugar-related compounds',
      'Evaluates glycemic impact of sugar alternatives used',
      'Flags hidden sugar names and sugar alcohols'
    ],
    ingredientsToWatch: [
      { name: 'High Fructose Corn Syrup', note: 'Highly processed sweetener linked to metabolic issues' },
      { name: 'Maltodextrin', note: 'Hidden sugar that raises blood glucose rapidly' },
      { name: 'Dextrose', note: 'Simple sugar that causes quick blood sugar spikes' },
      { name: 'Sucralose', note: 'Artificial sweetener, may affect gut bacteria' },
      { name: 'Stevia Extract', note: 'Natural zero-calorie sweetener, generally safe' },
      { name: 'Erythritol', note: 'Sugar alcohol with minimal blood sugar impact' }
    ],
    expertTips: [
      'Ignore "low sugar" marketing claims and check actual sugar content',
      'Natural fruit sugars paired with fiber are better than added sugars',
      'Watch for multiple sugar sources that add up to significant amounts',
      'Sugar alcohols may cause digestive issues in sensitive individuals'
    ]
  },
  
  low_fat: {
    id: 'low_fat',
    name: 'Low Fat',
    icon: '💧',
    color: '#9C27B0',
    shortDescription: 'Low fat options for heart health',
    expertExplanation: 'Low fat foods can support weight management and heart health when part of a balanced diet that includes essential fatty acids.',
    whatItMeans: 'Low fat foods contain reduced amounts of total fat, particularly saturated and trans fats that may impact cardiovascular health. However, some fats are essential for nutrient absorption and hormone production, so balance is key.',
    howIngreScanEvaluates: [
      'Measures total fat content per 100g serving',
      'Distinguishes between saturated, unsaturated, and trans fats',
      'Checks for fat replacers and their health implications',
      'Evaluates fat-to-calorie ratio for nutritional efficiency',
      'Identifies processed low-fat products with added sugars or sodium'
    ],
    ingredientsToWatch: [
      { name: 'Partially Hydrogenated Oils', note: 'Source of trans fats, avoid completely' },
      { name: 'Palm Oil', note: 'High in saturated fat, environmental concerns' },
      { name: 'Olestra', note: 'Fat substitute that may cause digestive issues' },
      { name: 'Modified Food Starch', note: 'Often used as fat replacer in low-fat products' },
      { name: 'Guar Gum', note: 'Common fat replacer and thickener in low-fat foods' },
      { name: 'Xanthan Gum', note: 'Helps maintain texture in reduced-fat products' }
    ],
    expertTips: [
      'Not all fats are bad - focus on reducing saturated and trans fats',
      'Low-fat products often contain added sugars or sodium for flavor',
      'Essential fatty acids are necessary for health and nutrient absorption',
      'Check if calorie reduction is significant enough to justify processing'
    ]
  },
  
  low_sodium: {
    id: 'low_sodium',
    name: 'Low Sodium',
    icon: '🧂',
    color: '#FF9800',
    shortDescription: 'Low sodium foods for heart health',
    expertExplanation: 'Low sodium foods help maintain healthy blood pressure, reduce cardiovascular disease risk, and prevent excess fluid retention.',
    whatItMeans: 'Low sodium foods contain reduced amounts of salt and sodium-based preservatives. Excess sodium intake is linked to high blood pressure, heart disease, and stroke. Most dietary sodium comes from processed foods rather than table salt.',
    howIngreScanEvaluates: [
      'Analyzes total sodium content per 100g serving',
      'Identifies various sodium compounds beyond table salt',
      'Checks for hidden sodium sources in ingredient lists',
      'Evaluates sodium-to-potassium ratio for optimal balance',
      'Flags high-sodium preservatives and flavor enhancers'
    ],
    ingredientsToWatch: [
      { name: 'Monosodium Glutamate (MSG)', note: 'Flavor enhancer that adds significant sodium' },
      { name: 'Sodium Benzoate', note: 'Common preservative contributing to sodium intake' },
      { name: 'Sodium Nitrite', note: 'Preservative in processed meats, linked to health concerns' },
      { name: 'Disodium Phosphate', note: 'Food additive that increases sodium content' },
      { name: 'Sodium Citrate', note: 'Preservative and flavor enhancer with sodium' },
      { name: 'Sea Salt', note: 'Often perceived as healthier but similar sodium content to table salt' }
    ],
    expertTips: [
      'Aim for less than 2,300mg sodium per day (about 1 teaspoon of salt)',
      'Processed foods account for 75% of dietary sodium intake',
      'Rinse canned foods to reduce sodium content by up to 40%',
      'Enhance flavor with herbs and spices instead of salt'
    ]
  }
};

// Helper function to get nutrition goal data by ID
export const getNutritionGoalById = (goalId) => {
  return NUTRITION_GOALS_DATA[goalId] || null;
};

// Get all nutrition goals as array
export const getAllNutritionGoals = () => {
  return Object.values(NUTRITION_GOALS_DATA);
};