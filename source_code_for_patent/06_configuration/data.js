// App-wide constants and configuration
export const APP_CONFIG = {
  name: 'IngreScan',
  version: '1.0.0',
  description: 'Personalized food ingredient scanner for healthier choices',
};

// Health conditions for personalization
export const HEALTH_CONDITIONS = [
  { id: 'diabetes', name: 'Diabetes', icon: '🍯' },
  { id: 'high_bp', name: 'High Blood Pressure', icon: '❤️' },
  { id: 'pregnant', name: 'Pregnant', icon: '🤰' },
  { id: 'high_cholesterol', name: 'High Cholesterol', icon: '🧈' },
  { id: 'kidney_disease', name: 'Kidney Disease', icon: '🫘' },
  { id: 'gout', name: 'Gout', icon: '🦴' },
  { id: 'ibs', name: 'Irritable Bowel Syndrome (IBS)', icon: '🌾' },
  { id: 'heart_disease', name: 'Heart Disease', icon: '💓' },
  { id: 'fatty_liver', name: 'Fatty Liver', icon: '🧪' },
  { id: 'osteoporosis', name: 'Osteoporosis', icon: '�' },
  { id: 'anemia', name: 'Anemia', icon: '🔴' },
  { id: 'acid_reflux', name: 'Acid Reflux', icon: '🔥' },
];

// Dietary preferences
export const DIETARY_PREFERENCES = [
  { id: 'vegetarian', name: 'Vegetarian', icon: '🥬' },
  { id: 'non_vegetarian', name: 'Non-Vegetarian', icon: '�' },
  { id: 'vegan', name: 'Vegan', icon: '�🌱' },
  { id: 'jain', name: 'Jain', icon: '🕉️' },
  { id: 'eggatrian', name: 'Eggatrian', icon: '🥚' },
  // removed specialized diet entries per user request
];

// Allergens
export const COMMON_ALLERGENS = [
  { id: 'celiac_disease', name: 'Celiac / Gluten', icon: '🌾' },
  { id: 'lactose_intolerance', name: 'Lactose Intolerance', icon: '🥛' },
  { id: 'soy_allergy', name: 'Soy Allergy', icon: '�' },
  { id: 'nut_allergy', name: 'Nut Allergy', icon: '🥜' },
  { id: 'shellfish_allergy', name: 'Shellfish Allergy', icon: '🦐' },
  { id: 'egg_allergy', name: 'Egg Allergy', icon: '�' },
  // keep some common ones for broader coverage
  { id: 'fish', name: 'Fish', icon: '🐟' },
  { id: 'peanuts', name: 'Peanuts', icon: '🥜' },
  { id: 'sesame', name: 'Sesame', icon: '🫵' },
];

// Nutritional categories for "Healthy Choices"
export const NUTRITION_CATEGORIES = [
  {
    id: 'high_protein',
    name: 'High Protein',
    icon: '💪',
    color: '#FF6B6B',
    description: 'Foods rich in protein for muscle building',
  },
  {
    id: 'high_fiber',
    name: 'High Fiber',
    icon: '🌾',
    color: '#4ECDC4',
    description: 'Fiber-rich foods for digestive health',
  },
  {
    id: 'low_sugar',
    name: 'Low Sugar',
    icon: '🍯',
    color: '#45B7D1',
    description: 'Low sugar options for better health',
  },
  {
    id: 'low_fat',
    name: 'Low Fat',
    icon: '💧',
    color: '#9C27B0',
    description: 'Low fat options for heart health',
  },
  {
    id: 'low_sodium',
    name: 'Low Sodium',
    icon: '🧂',
    color: '#FF9800',
    description: 'Low sodium foods for heart health',
  },
];

// Food categories
export const FOOD_CATEGORIES = [
  'Snacks & Sweets',
  'Ready-to-Eat & Baby Foods',
  'Cereals, Grains & Staples',
  'Beverages',
  'Dairy Products',
  'Meat & Seafood',
  'Fruits & Vegetables',
  'Condiments & Sauces',
];

// Risk levels for ingredient analysis
export const RISK_LEVELS = {
  LOW: 'Limited Risk',
  MEDIUM: 'Moderate Risk',
  HIGH: 'High Risk',
};

// Sample data for development
export const SAMPLE_PRODUCTS = [
  {
    id: '1',
    name: 'Bisleri Mineral Water With Added Minerals',
    brand: 'BISLERI',
    size: '250ml',
    image: 'https://via.placeholder.com/150',
    barcode: '8901030820001',
    ingredients: [
      {
        name: 'Minerals',
        category: 'minerals',
        riskLevel: 'LOW',
        description: 'Naturally occurring inorganic substances essential for various bodily functions.',
      },
      {
        name: 'Magnesium Sulphate',
        category: 'additive',
        riskLevel: 'LOW',
        description: 'Added mineral supplement, generally safe in regulated amounts.',
      },
      {
        name: 'Potassium Bicarbonate',
        category: 'additive',
        riskLevel: 'LOW',
        description: 'pH regulator and mineral supplement, safe for consumption.',
      },
    ],
    nutrition: {
      calories: 0,
      protein: 0,
      carbs: 0,
      sugar: 0,
      fat: 0,
      sodium: 0,
      magnesium: 0.2,
      potassium: 0.1,
    },
    healthScore: 85,
    personalizedWarnings: [],
    alternatives: [],
  },
];

// Feature cards for home screen
export const FEATURE_CARDS = [
  {
    id: 'scan_discover',
    title: 'Scan & Discover',
    subtitle: 'Scan any product barcode',
    icon: '📱',
    color: '#00C853',
    route: 'Scan',
  },
  {
    id: 'search_discover',
    title: 'Search & Discover',
    subtitle: 'Search for products',
    icon: '🔍',
    color: '#4CAF50',
    route: 'Search',
  },
  {
    id: 'rewards',
    title: 'Get Reward & Earn',
    subtitle: 'Earn points for scanning',
    icon: '🏆',
    color: '#FFC107',
    route: 'Rewards',
  },
];

// Navigation tab configuration
export const TAB_CONFIG = [
  {
    name: 'Home',
    icon: 'home',
    iconType: 'MaterialIcons',
  },
  {
    name: 'Scan',
    icon: 'qr-code-scanner',
    iconType: 'MaterialIcons',
  },
  {
    name: 'History',
    icon: 'history',
    iconType: 'MaterialIcons',
  },
  {
    name: 'Profile',
    icon: 'person',
    iconType: 'MaterialIcons',
  },
];