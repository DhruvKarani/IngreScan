export const FOOD_CATEGORY_RISK_GUIDES = {
  'Snacks & Sweets': {
    id: 'snacks_sweets',
    name: 'Snacks & Sweets',
    realityCheck: 'Most packaged snacks are designed for taste and shelf life, not nutrition. Even products marketed as "healthy" often contain hidden sugars and additives that make them as processed as regular treats.',
    commonMistakes: [
      'Trusting "natural" or "organic" labels on processed snacks',
      'Assuming smaller packaging means healthier portions',
      'Ignoring ingredient lists when front labels say "no sugar added"',
      'Believing that "baked not fried" automatically means healthier'
    ],
    whyScansWarn: 'Snacks frequently score poorly because they are designed for maximum appeal rather than nutrition. Sugar often appears in multiple forms, and even "healthy" versions rely heavily on processing to achieve shelf stability and taste.',
    hiddenIngredients: [
      { name: 'Invert syrup', reason: 'Alternative sugar that doesn\'t have to be labeled as "sugar"' },
      { name: 'Rice syrup', reason: 'Marketed as natural but behaves like refined sugar in the body' },
      { name: 'Natural flavors', reason: 'Can contain dozens of chemical compounds to create familiar tastes' },
      { name: 'Maltodextrin', reason: 'Bulking agent that raises blood sugar faster than table sugar' }
    ],
    interpretationTips: [
      'High sugar warnings are normal for this category - focus on total ingredient count instead',
      'Additive warnings are common - prioritize products with recognizable ingredients',
      'Don\'t expect perfect scores from any packaged snacks',
      'Compare similar products rather than expecting snacks to score like whole foods'
    ],
    smartAdvice: [
      'Treat this entire category as occasional food, regardless of marketing claims',
      'Read ingredient lists completely - first 3 ingredients make up most of the product',
      'When possible, choose snacks with 5 or fewer total ingredients'
    ]
  },

  'Ready-to-Eat & Baby Foods': {
    id: 'ready_to_eat_baby',
    name: 'Ready-to-Eat & Baby Foods',
    realityCheck: 'Convenience foods prioritize shelf life and ease of preparation over fresh nutrition. Baby foods, while regulated, often contain unnecessary additives and have less nutritional density than fresh alternatives.',
    commonMistakes: [
      'Assuming "ready-to-eat" means nutritionally complete',
      'Trusting that baby food regulations guarantee optimal nutrition',
      'Not checking sodium content in convenience meals',
      'Believing preservative-free versions are always better choices'
    ],
    whyScansWarn: 'These products often score poorly due to high sodium for preservation, added thickeners for texture, and lower nutritional density compared to fresh preparation. Processing methods reduce vitamin content while adding stabilizers.',
    hiddenIngredients: [
      { name: 'Modified food starch', reason: 'Thickener that extends shelf life but provides no nutritional value' },
      { name: 'Potassium sorbate', reason: 'Prevents spoilage but may cause reactions in sensitive individuals' },
      { name: 'Ascorbic acid', reason: 'Synthetic vitamin C used as preservative, not nutrition enhancement' },
      { name: 'Guar gum', reason: 'Prevents separation but can cause digestive issues in large amounts' }
    ],
    interpretationTips: [
      'Sodium warnings are extremely common - focus on comparing similar products',
      'Preservative alerts don\'t always mean dangerous, just highly processed',
      'For baby foods, fewer ingredients usually means better despite lower convenience',
      'Texture enhancers are normal but indicate distance from whole foods'
    ],
    smartAdvice: [
      'Use convenience foods sparingly when fresh preparation isn\'t possible',
      'For babies, supplement with fresh foods when age-appropriate',
      'Check expiration dates - shorter shelf life often means fewer preservatives'
    ]
  },

  'Cereals, Grains & Staples': {
    id: 'cereals_grains_staples',
    name: 'Cereals, Grains & Staples',
    realityCheck: 'Many breakfast cereals contain more sugar than cookies, while appearing healthy due to vitamin fortification. Even "whole grain" products can be highly processed with added sugars and artificial vitamins.',
    commonMistakes: [
      'Believing fortification makes processed cereals as good as whole grains',
      'Trusting "whole grain" claims without checking ingredient order',
      'Focusing only on fiber content while ignoring sugar amounts',
      'Assuming brown color means whole grain rather than added coloring'
    ],
    whyScansWarn: 'Breakfast cereals often contain surprising amounts of added sugars, even in "healthy" varieties. Fortification with synthetic vitamins can\'t compensate for the processing that removes natural nutrients and fiber.',
    hiddenIngredients: [
      { name: 'Malt extract', reason: 'Concentrated sugar source that sounds more natural than corn syrup' },
      { name: 'BHT preservative', reason: 'Prevents rancidity but raises questions about long-term health effects' },
      { name: 'Yellow dye #6', reason: 'Makes products appear more golden and appealing' },
      { name: 'Iron phosphate', reason: 'Synthetic iron that may cause digestive upset in sensitive people' }
    ],
    interpretationTips: [
      'Sugar warnings on breakfast cereals are very common - look at grams per serving',
      'Artificial vitamin alerts indicate heavy processing, not nutritional benefit',
      'Whole grain products should list whole grains as the first ingredient',
      'Low fiber warnings suggest refinement even in "whole grain" products'
    ],
    smartAdvice: [
      'Choose cereals with whole grains listed first and minimal added sugars',
      'Consider traditional oats or other minimally processed grain options',
      'Check serving sizes - they\'re often smaller than typical bowls'
    ]
  },

  'Beverages': {
    id: 'beverages',
    name: 'Beverages',
    realityCheck: 'Most packaged beverages contain more sugar than recommended for an entire day. Even "natural" fruit juices lack the fiber that makes whole fruits healthy, while sports and energy drinks add stimulants and artificial ingredients.',
    commonMistakes: [
      'Believing fruit juice is equivalent to eating fruit',
      'Not checking serving sizes on bottles that contain multiple servings',
      'Trusting "zero sugar" claims without understanding artificial sweetener effects',
      'Assuming energy drinks are safe because they\'re widely available'
    ],
    whyScansWarn: 'Beverages frequently receive poor scores because liquid sugar is rapidly absorbed, causing blood sugar spikes. Even natural fruit sugars become problematic without the fiber found in whole fruits.',
    hiddenIngredients: [
      { name: 'Natural flavors', reason: 'Can mask the taste of artificial sweeteners or additional sugars' },
      { name: 'Citric acid', reason: 'Preservative that also enhances artificial fruit flavors' },
      { name: 'Sodium benzoate', reason: 'Prevents bacterial growth but may form harmful compounds with vitamin C' },
      { name: 'Caramel color', reason: 'Contains potentially harmful compounds formed during manufacturing' }
    ],
    interpretationTips: [
      'Extreme sugar warnings are normal for most beverages except water',
      'Artificial sweetener alerts indicate potential digestive or neurological effects',
      'Caffeine warnings help avoid accidental overdoses, especially in energy drinks',
      'Calorie density warnings show how quickly beverages add up'
    ],
    smartAdvice: [
      'Treat all sweetened beverages as liquid desserts, not hydration',
      'Check bottle sizes - many contain 2-3 servings despite appearing single-serve',
      'Water with natural flavor additions is usually the safest choice'
    ]
  },

  'Dairy Products': {
    id: 'dairy_products',
    name: 'Dairy Products',
    realityCheck: 'Flavored dairy products often contain as much sugar as desserts, while low-fat versions frequently compensate with added sugars and thickeners. Even "natural" dairy can be heavily processed.',
    commonMistakes: [
      'Assuming all dairy products are automatically healthy',
      'Choosing low-fat versions without checking added sugar content',
      'Not recognizing that flavored varieties are essentially desserts',
      'Trusting probiotic claims without checking if cultures survive processing'
    ],
    whyScansWarn: 'Flavored dairy products often score poorly due to added sugars that rival candy. Processing methods can destroy beneficial bacteria while thickeners and stabilizers replace natural texture.',
    hiddenIngredients: [
      { name: 'Carrageenan', reason: 'Seaweed extract that creates smooth texture but may cause inflammation' },
      { name: 'Natural vanilla flavor', reason: 'Often contains alcohol and other processing aids' },
      { name: 'Inulin fiber', reason: 'Added to boost fiber content but can cause digestive distress' },
      { name: 'Live cultures', reason: 'May not survive pasteurization and storage conditions' }
    ],
    interpretationTips: [
      'Sugar warnings on flavored dairy are extremely common - check plain versions',
      'Thickener alerts indicate heavy processing but aren\'t necessarily harmful',
      'Probiotic benefits require living cultures, which processing often destroys',
      'Low-fat warnings often mean added sugars to maintain palatability'
    ],
    smartAdvice: [
      'Choose plain versions and add your own fruits or natural flavoring',
      'Check culture viability dates on probiotic products',
      'Full-fat plain options often have fewer additives than low-fat flavored ones'
    ]
  },

  'Meat & Seafood': {
    id: 'meat_seafood',
    name: 'Meat & Seafood',
    realityCheck: 'Processed meats contain preservatives linked to health risks, while canned seafood often has added sodium levels that exceed daily recommendations. Even "natural" processed meats use alternative preservation methods.',
    commonMistakes: [
      'Believing "uncured" or "no nitrates added" means preservative-free',
      'Not checking sodium content in processed and canned meats',
      'Assuming all seafood is automatically healthy regardless of processing',
      'Trusting that expensive processed meats are significantly healthier'
    ],
    whyScansWarn: 'Processed meats frequently score poorly due to high sodium, preservatives, and additives used for color retention and shelf life. Even premium versions often contain surprising amounts of sodium and processing aids.',
    hiddenIngredients: [
      { name: 'Celery powder', reason: 'Natural source of nitrates used in "uncured" meats for preservation' },
      { name: 'Sodium phosphate', reason: 'Helps retain moisture but significantly increases sodium content' },
      { name: 'Natural smoke flavor', reason: 'Chemical compounds that mimic smoking without actual wood smoke' },
      { name: 'Sea salt', reason: 'Sounds healthier but contains the same sodium as regular salt' }
    ],
    interpretationTips: [
      'Sodium warnings are almost universal in processed meats - compare brands carefully',
      'Nitrate alerts apply even to "natural" preservation methods',
      'Fresh meat should have minimal ingredients beyond the meat itself',
      'Canned seafood warnings usually relate to sodium in packing liquid'
    ],
    smartAdvice: [
      'Choose fresh meats when possible, or lowest-sodium processed options',
      'Rinse canned seafood to remove excess sodium from packing liquid',
      'Limit processed meats regardless of price point or marketing claims'
    ]
  },

  'Fruits & Vegetables': {
    id: 'fruits_vegetables',
    name: 'Fruits & Vegetables',
    realityCheck: 'Canned fruits often contain more sugar than candy, while canned vegetables can exceed daily sodium recommendations in a single serving. Processing removes many beneficial compounds found in fresh produce.',
    commonMistakes: [
      'Assuming all fruit products count as healthy fruit servings',
      'Not checking for added sugars in canned and frozen fruit products',
      'Believing that canned vegetables provide the same nutrition as fresh',
      'Trusting "all natural" claims on heavily sweetened fruit products'
    ],
    whyScansWarn: 'Canned fruits often score poorly due to added syrups and sugars, while canned vegetables receive warnings for excessive sodium used in preservation. Processing reduces vitamin content and antioxidant levels.',
    hiddenIngredients: [
      { name: 'Corn syrup', reason: 'Added to fruit products to enhance sweetness and shelf appeal' },
      { name: 'Calcium chloride', reason: 'Keeps vegetables firm during canning but adds to overall sodium content' },
      { name: 'Ascorbic acid', reason: 'Prevents browning but is synthetic vitamin C, not nutritional enhancement' },
      { name: 'Natural flavoring', reason: 'Replaces flavors lost during high-heat processing' }
    ],
    interpretationTips: [
      'Sugar warnings on fruit products often exceed candy levels',
      'Sodium alerts in vegetables can represent 30-50% of daily limits',
      'Frozen options typically score better than canned for preserving nutrition',
      'Fresh produce should have no ingredient warnings beyond natural compounds'
    ],
    smartAdvice: [
      'Choose frozen vegetables over canned when fresh isn\'t available',
      'Look for fruit packed in water or its own juice rather than syrup',
      'Rinse canned vegetables to remove excess sodium before consumption'
    ]
  },

  'Condiments & Sauces': {
    id: 'condiments_sauces',
    name: 'Condiments & Sauces',
    realityCheck: 'Condiments are often the most processed items in kitchens, with single servings containing entire day\'s worth of sodium or sugar. Small serving sizes mask the intensity of additives and preservatives.',
    commonMistakes: [
      'Not adjusting for actual serving sizes vs. labeled portions',
      'Assuming savory sauces don\'t contain significant sugar',
      'Believing that expensive or gourmet versions are automatically healthier',
      'Using condiment serving sizes that exceed package recommendations'
    ],
    whyScansWarn: 'Condiments score poorly because they concentrate flavors through high levels of salt, sugar, and artificial enhancers. Small serving sizes make the intensity of additives particularly problematic.',
    hiddenIngredients: [
      { name: 'High fructose corn syrup', reason: 'Appears in unexpected savory products like ketchup and salad dressing' },
      { name: 'Xanthan gum', reason: 'Prevents separation but creates unnatural texture and mouthfeel' },
      { name: 'Potassium sorbate', reason: 'Prevents spoilage but can cause allergic reactions in sensitive people' },
      { name: 'Natural flavors', reason: 'Often contains more chemicals than the actual food being flavored' }
    ],
    interpretationTips: [
      'Serving size warnings are critical - most people use 3-4 times the labeled amount',
      'Sugar alerts in savory sauces indicate heavy processing and flavor manipulation',
      'Sodium warnings can represent 20-40% of daily limits in a single tablespoon',
      'Preservative alerts show products designed for long shelf life over nutrition'
    ],
    smartAdvice: [
      'Measure actual usage vs. serving sizes to understand real intake',
      'Make simple versions at home using basic ingredients when possible',
      'Choose products with the shortest ingredient lists available'
    ]
  }
};

// Helper function to get category risk guide by name
export const getFoodCategoryRiskGuide = (categoryName) => {
  return FOOD_CATEGORY_RISK_GUIDES[categoryName] || null;
};

// Get all category risk guides as array
export const getAllFoodCategoryRiskGuides = () => {
  return Object.values(FOOD_CATEGORY_RISK_GUIDES);
};