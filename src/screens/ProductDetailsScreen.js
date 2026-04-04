import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Collapsible from 'react-native-collapsible';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NutritionalTable, IngredientCollapsible, ProductCard, IngredientInfoModal } from '../components';
import ReviewForm from '../components/ReviewForm';
import { auth, db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';
import { SAMPLE_PRODUCTS } from '../constants/data';
import { dailyIntakeManager } from '../utils/dailyIntakeManager';
import { detectCorruptedIngredients } from '../utils/dataCorruptionDetector';
import { getPersonalizedScore } from '../utils/mlApi';

// Import ingredient data with fallback
let ingredientData;
try {
  ingredientData = require('../data/education/ingredient_cards.json');
} catch (error) {
  console.warn('Ingredient data not found, using fallback');
  ingredientData = { ingredients: {} };
}

const { width: screenWidth } = Dimensions.get('window');

const ProductDetailsScreen = ({ route, navigation }) => {
  const initialProduct = route.params && route.params.product ? route.params.product : {};
  
  console.log('[ProductDetails] Screen opened with product:', {
    productName: initialProduct.product_name,
    hasNutriments: !!initialProduct.nutriments,
    nutrimentKeys: Object.keys(initialProduct.nutriments || {}),
    hasAnalysis: !!initialProduct.analysis
  });
  console.log('[ProductDetails] Full nutriments:', JSON.stringify(initialProduct.nutriments || {}, null, 2));
  
  const [productState, setProductState] = useState(initialProduct);
  const product = productState;
  const analysis = product.analysis || null;

  // Component state
  const [activeTab, setActiveTab] = useState('ingredients');
  const [isFavorite, setIsFavorite] = useState(false);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [showRawNutrition, setShowRawNutrition] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [ingredientModalVisible, setIngredientModalVisible] = useState(false);

  // User profile state for personalized scoring
  const [userProfile, setUserProfile] = useState({
    healthConditions: [],
    allergens: []
  });
  const [personalizedScoreLoading, setPersonalizedScoreLoading] = useState(false);

  // Daily intake tracking state
  const [dailyIntake, setDailyIntake] = useState({});
  const [isConsumed, setIsConsumed] = useState(false);
  const [intakeLoading, setIntakeLoading] = useState(true);

  useEffect(() => {
    // If product has no name but we have a barcode, try to fetch the authoritative product doc
    const tryFetch = async () => {
      try {
        const barcode = product.barcode || product.barcodeKey || product.code || product.id || product.product_code || product.barcodeNumber || null;
        const missingName = !(product.product_name || product.productName || product.name || product.title);
        if (missingName && barcode) {
          const pRef = doc(db, 'products', String(barcode));
          const snap = await getDoc(pRef);
          if (snap && snap.exists()) {
            const remote = snap.data() || {};
            // Merge remote fields into current product, but preserve any existing analysis on the product
            const merged = { ...remote, ...product, analysis: product.analysis || remote.analysis };
            setProductState(merged);
            // Trigger personalized scoring for fetched product
            loadUserProfileAndScore();
          }
        }
      } catch (e) {
        console.warn('ProductDetails: failed to fetch product doc', e && e.message ? e.message : e);
      }
    };
    tryFetch();
  }, []);

  // Load daily intake data - reload when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadDailyIntake();
      loadUserProfileAndScore();
    }, [])
  );

  // Load user profile and get personalized score
  const loadUserProfileAndScore = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.log('[PersonalizedScore] No authenticated user');
        return;
      }

      // Load user profile from Firebase
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const profile = {
          healthConditions: userData.healthConditions || userData.conditions || [],
          allergens: userData.allergens || []
        };
        
        setUserProfile(profile);
        console.log('[PersonalizedScore] User profile loaded:', profile);

        // Get personalized score if we have product data
        if (product && (product.nutriments || product.ingredients_text)) {
          setPersonalizedScoreLoading(true);
          
          try {
            const scoreResult = await getPersonalizedScore(product, profile);
            console.log('[PersonalizedScore] Score received:', scoreResult);
            
            // Update product with personalized score in analysis
            setProductState(prev => ({
              ...prev,
              analysis: {
                ...(prev.analysis || {}),
                ...scoreResult,
                // Keep backward compatibility
                score: scoreResult.final_score,
                Score: scoreResult.final_score
              }
            }));
          } catch (error) {
            console.error('[PersonalizedScore] Failed to get score:', error);
          } finally {
            setPersonalizedScoreLoading(false);
          }
        }
      } else {
        console.log('[PersonalizedScore] User document not found');
      }
    } catch (error) {
      console.error('[PersonalizedScore] Error loading profile:', error);
    }
  };

  const loadDailyIntake = async () => {
    try {
      setIntakeLoading(true);

      // Get user conditions from Firebase
      let userConditions = [];
      try {
        const user = auth.currentUser;
        console.log('Loading intake for user:', user?.uid);

        if (user) {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            userConditions = userData.conditions || userData.healthConditions || [];
            console.log('User conditions loaded:', userConditions);
          } else {
            console.log('User document does not exist');
          }
        } else {
          console.log('No authenticated user');
        }
      } catch (error) {
        console.log('Could not load user conditions:', error);
      }

      const intake = await dailyIntakeManager.initializeDailyIntake(userConditions);
      setDailyIntake(intake);
      console.log('Daily intake initialized with limits:', dailyIntakeManager.getCurrentLimits());
    } catch (error) {
      console.log('Error loading daily intake:', error);
    } finally {
      setIntakeLoading(false);
    }
  };

  // Handle consumption confirmation
  const handleConsumption = async () => {
    try {
      if (isConsumed) {
        // Remove from intake if already consumed
        const updatedIntake = await dailyIntakeManager.removeFromIntake(displayNutrition);
        setDailyIntake(updatedIntake);
        setIsConsumed(false);
        Alert.alert('Updated', 'Removed from your daily intake.');
      } else {
        // Add to intake
        const updatedIntake = await dailyIntakeManager.addToIntake(displayNutrition);
        setDailyIntake(updatedIntake);
        setIsConsumed(true);
        Alert.alert('Added!', 'Added to your daily intake tracking.');
      }
    } catch (error) {
      console.log('Error updating consumption:', error);
      Alert.alert('Error', 'Failed to update your daily intake. Please try again.');
    }
  };

  // Handle not consuming
  const handleNotConsuming = () => {
    if (isConsumed) {
      handleConsumption(); // This will remove it from intake
    } else {
      Alert.alert('Noted', 'Marked as will not consume.');
    }
  };

  // Render dynamic Today's Intake section
  const renderTodaysIntake = () => {
    const formattedIntake = dailyIntakeManager.getFormattedIntake(dailyIntake);

    // Display labels for nutrients
    const nutrientLabels = {
      sugar: 'Sugar',
      carbs: 'Net Carbohydrates',
      calories: 'Calories',
      saturated_fat: 'Saturated + Trans Fat',
      caffeine: 'Caffeine',
      sodium: 'Sodium'
    };

    return (
      <View style={{
        backgroundColor: COLORS.surface,
        margin: SPACING.lg,
        padding: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
        ...SHADOWS.small
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }}>
          <Text style={{
            fontSize: TYPOGRAPHY.fontSize.lg,
            fontWeight: TYPOGRAPHY.fontWeight.bold,
            color: COLORS.text
          }}>Today's Intake</Text>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity
              onPress={async () => {
                // Debug button - show current user data
                try {
                  const user = auth.currentUser;
                  if (user) {
                    const userRef = doc(db, 'users', user.uid);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                      const userData = userSnap.data();
                      Alert.alert('Debug Info',
                        `User ID: ${user.uid}\n` +
                        `Conditions: ${JSON.stringify(userData.conditions || [])}\n` +
                        `Health Conditions: ${JSON.stringify(userData.healthConditions || [])}\n` +
                        `Current Sugar Limit: ${dailyIntakeManager.getCurrentLimits().sugar?.limit}g`
                      );
                    } else {
                      Alert.alert('Debug Info', 'No user document found');
                    }
                  } else {
                    Alert.alert('Debug Info', 'No authenticated user');
                  }
                } catch (error) {
                  Alert.alert('Debug Error', error.message);
                }
              }}
              style={{ padding: SPACING.xs, marginRight: 4 }}
            >
              <MaterialIcons name="bug-report" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={loadDailyIntake}
              disabled={intakeLoading}
              style={{ padding: SPACING.xs }}
            >
              <MaterialIcons
                name="refresh"
                size={20}
                color={intakeLoading ? COLORS.textSecondary : COLORS.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {intakeLoading ? (
          <View style={{ alignItems: 'center', padding: SPACING.lg }}>
            <Text style={{ color: COLORS.textSecondary }}>Loading intake data...</Text>
          </View>
        ) : (
          <>
            {Object.keys(formattedIntake).map((nutrient) => {
              const data = formattedIntake[nutrient];
              const label = nutrientLabels[nutrient] || nutrient;

              return (
                <View key={nutrient} style={{ marginBottom: SPACING.sm }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontWeight: '600', fontSize: 14, color: COLORS.text }}>{label}</Text>
                    <Text style={{
                      fontSize: 14,
                      color: data.isOverLimit ? '#F44336' : data.color,
                      fontWeight: '600'
                    }}>
                      {data.displayText}
                    </Text>
                  </View>
                  <View style={{ height: 8, backgroundColor: COLORS.backgroundSecondary, borderRadius: 4 }}>
                    <View style={{
                      height: 8,
                      width: `${Math.min(data.percentage, 100)}%`,
                      backgroundColor: data.isOverLimit ? '#F44336' : data.color,
                      borderRadius: 4
                    }} />
                  </View>
                </View>
              );
            })}
            <View style={{ backgroundColor: COLORS.backgroundLight, padding: 12, borderRadius: 8, marginTop: 8 }}>
              <Text style={{ fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' }}>
                {isConsumed ? 'This product has been added to your daily intake' : 'Tap "Yes" when consuming products to update your intake'}
              </Text>
              {Object.keys(dailyIntakeManager.getCurrentLimits()).some(key => {
                const current = dailyIntakeManager.getCurrentLimits()[key]?.limit;
                const healthy = dailyIntakeManager.getHealthyLimits()[key]?.limit;
                return current !== healthy;
              }) && (
                  <Text style={{ fontSize: 10, color: COLORS.primary, textAlign: 'center', marginTop: 4, fontWeight: '600' }}>
                    ⚕️ Condition-specific limits active
                  </Text>
                )}
            </View>
          </>
        )}
      </View>
    );
  };

  // Score for display: Use 0-100 scale for personalized scoring
  // Check if we have personalized score (final_score) or fall back to old scores
  const rawScore = analysis?.final_score ?? analysis?.Score ?? analysis?.score10 ?? analysis?.score ?? product.healthScore ?? 0;
  // Keep 0-100 scale, only convert old 0-10 scores
  const scoreValue = analysis?.breakdown?.net_penalty != null
    ? Math.round(100 - Number(analysis.breakdown.net_penalty || 0))
    : ((rawScore <= 10 && rawScore > 0) ? Math.round(rawScore * 10) : Math.round(rawScore));
  const scoreFillValue = Math.min(100, Math.max(0, scoreValue));
  // Normalize image, nutrition and ingredients for products coming from OFF or Firestore
  const imageUri = product.image || product.image_url || (product.raw && (product.raw.image_small_url || product.raw.image_url)) || null;

  // Build nutrition object expected by NutritionalTable
  const buildNutrition = () => {
    console.log('[ProductDetails] buildNutrition called');
    
    // Merge all potential nutrition sources (productSnapshot, product.nutriments/nutrition, product.raw, analysis)
    const collect = (obj) => {
      if (!obj || typeof obj !== 'object') return {};
      if (obj.__raw && typeof obj.__raw === 'object') return obj.__raw;
      return obj;
    };

    const sources = [
      collect(product && product.productSnapshot && (product.productSnapshot.nutriments || product.productSnapshot.nutrition)),
      collect(product && product.nutriments),
      collect(product && product.nutrition),
      collect(product && product.raw && product.raw.nutriments),
      collect(analysis && analysis.nutrients),
      collect(analysis && analysis.raw_nutrients),
    ];
    
    console.log('[ProductDetails] Nutrition sources:', {
      source1_snapshot: Object.keys(sources[0] || {}),
      source2_nutriments: Object.keys(sources[1] || {}),
      source3_nutrition: Object.keys(sources[2] || {}),
      source4_raw: Object.keys(sources[3] || {}),
      source5_analysis: Object.keys(sources[4] || {}),
      source6_rawAnalysis: Object.keys(sources[5] || {})
    });

    // Merge with later sources overriding earlier ones
    const merged = Object.assign({}, ...sources.filter(s => s && typeof s === 'object'));

    // Coerce numeric-looking strings to numbers for display & sorting
    Object.keys(merged).forEach((k) => {
      const v = merged[k];
      if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
        merged[k] = Number(v);
      }
    });

    // Deduplicate: prefer canonical keys for each nutrient
    // Map of canonical nutrient keys to possible aliases
    const canonicalMap = {
      energy: ['energy_kcal_100g', 'energy_100g', 'calories', 'energy'],
      protein: ['proteins_100g', 'protein', 'proteins', 'total_protein'],
      fat: ['fat_100g', 'fat', 'total_fat'],
      saturated_fat: ['saturated-fat_100g', 'saturated_fat_100g'],
      trans_fat: ['trans-fat_100g', 'trans_fat_100g'],
      carbs: ['carbohydrates_100g', 'carbohydrates', 'carbs', 'total_carbs'],
      sugars: ['sugars_100g', 'sugars', 'sugar', 'total_sugars', 'added_sugars'],
      fiber: ['fiber_100g', 'fiber', 'dietary_fiber'],
      salt: ['salt_100g', 'salt'],
      sodium: ['sodium_100g', 'sodium'],
      cholesterol: ['cholesterol_100g', 'cholesterol'],
      // Add more canonical mappings as needed
    };

    const deduped = {};
    // For each canonical, pick the first present alias
    Object.entries(canonicalMap).forEach(([canonical, aliases]) => {
      for (const alias of aliases) {
        if (merged[alias] !== undefined && merged[alias] !== null && merged[alias] !== '') {
          deduped[canonical] = merged[alias];
          break;
        }
      }
    });
    
    // ONLY add remaining keys that look like actual nutrition data (prevent garbage fields)
    const VALID_NUTRITION_PATTERNS = [
      /^energy/i, /^calories/i, /^protein/i, /^fat/i, /^carb/i, /^sugar/i, 
      /^fiber/i, /^salt/i, /^sodium/i, /^cholesterol/i, /^vitamin/i, /^mineral/i,
      /^calcium/i, /^iron/i, /^potassium/i, /^magnesium/i
    ];
    
    Object.keys(merged).forEach((k) => {
      // Skip if already in canonical map
      if (Object.values(canonicalMap).flat().includes(k)) return;
      
      // Only include if it matches valid nutrition patterns
      const isValidNutrition = VALID_NUTRITION_PATTERNS.some(pattern => pattern.test(k));
      if (isValidNutrition) {
        deduped[k] = merged[k];
      }
    });

    console.log('[ProductDetails] Final deduped nutrition:', JSON.stringify(deduped, null, 2));
    return deduped;
  };

  const displayNutrition = buildNutrition();
  console.log('[ProductDetails] displayNutrition keys:', Object.keys(displayNutrition));

  // Build ingredients array expected by IngredientCollapsible (array of objects)
  // Get raw ingredients text for Gemini API analysis
  const getRawIngredientsText = () => {
    // Look for ingredients text in various locations
    const txtCandidates = [
      analysis && analysis.ingredients_text,
      product.ingredients_text,
      product.ingredientList,
      product.raw && product.raw.ingredients_text,
      product.productSnapshot && product.productSnapshot.ingredients_text,
      product.productSnapshot && product.productSnapshot.ingredientList,
    ];

    const txt = txtCandidates.find(t => typeof t === 'string' && t.trim()) || '';
    return txt;
  };

  // Get raw ingredients as array for Gemini API
  const getRawIngredientsArray = () => {
    const txt = getRawIngredientsText();
    if (!txt) return [];

    // Split by common delimiters and clean up
    return txt.split(/,|;|\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  };

  const buildIngredients = () => {
    // Prefer analysis ingredients from server (strings or objects)
    if (analysis) {
      if (Array.isArray(analysis.ingredients) && analysis.ingredients.length) {
        const ingredients = analysis.ingredients.map(i => (typeof i === 'string' ? { name: i } : i));
        // Filter corrupted ingredients
        const cleanIngredients = ingredients.filter(ing => {
          const name = ing.name || ing;
          return !detectCorruptedIngredients([name]).isCorrupted;
        });
        if (cleanIngredients.length > 0) return cleanIngredients;
      }
      if (typeof analysis.ingredients === 'string' && analysis.ingredients.trim()) {
        const ingredients = String(analysis.ingredients).split(/,|;|\n/).map(s => ({ name: s.trim(), riskLevel: 'LOW', description: '' })).filter(i => i.name);
        // Filter corrupted ingredients
        const cleanIngredients = ingredients.filter(ing => {
          return !detectCorruptedIngredients([ing.name]).isCorrupted;
        });
        if (cleanIngredients.length > 0) return cleanIngredients;
      }
    }

    // product.ingredients array
    if (Array.isArray(product.ingredients) && product.ingredients.length) {
      const ingredients = product.ingredients.map(i => (typeof i === 'string' ? { name: i } : i));
      // Filter corrupted ingredients
      const cleanIngredients = ingredients.filter(ing => {
        const name = ing.name || ing;
        return !detectCorruptedIngredients([name]).isCorrupted;
      });
      if (cleanIngredients.length > 0) return cleanIngredients;
    }

    // check nested raw fields
    const txt = getRawIngredientsText();
    if (!txt) return [];
    // split by comma/semicolon/newline and create simple ingredient items
    const ingredients = String(txt).split(/,|;|\n/).map(s => ({ name: s.trim(), riskLevel: 'LOW', description: '' })).filter(i => i.name);
    // Filter corrupted ingredients
    const cleanIngredients = ingredients.filter(ing => {
      return !detectCorruptedIngredients([ing.name]).isCorrupted;
    });
    return cleanIngredients;
  };

  const ingredientList = buildIngredients();
  const rawIngredientsArray = getRawIngredientsArray();
  const getHealthScoreColor = (score) => {
    // Handle both 0-10 and 0-100 scales
    const normalizedScore = score <= 10 ? score * 10 : score;
    
    if (normalizedScore >= 90) return '#2ecc71'; // Excellent - dark green
    if (normalizedScore >= 75) return '#3498db'; // Good - blue
    if (normalizedScore >= 60) return '#f39c12'; // Fair - yellow
    if (normalizedScore >= 45) return '#e67e22'; // Moderate - orange
    if (normalizedScore >= 30) return '#e74c3c'; // Poor - red
    return '#c0392b'; // Very Poor/Dangerous - dark red
  };

  const getHealthScoreText = (score) => {
    // Handle both 0-10 and 0-100 scales
    const normalizedScore = score <= 10 ? score * 10 : score;
    
    if (normalizedScore >= 90) return '✅ Excellent';
    if (normalizedScore >= 75) return '👍 Good';
    if (normalizedScore >= 60) return '⚠️ Fair';
    if (normalizedScore >= 45) return '⚠️ Moderate';
    if (normalizedScore >= 30) return '⚠️ Poor';
    if (normalizedScore >= 10) return '🚫 Very Poor';
    return '🚫 Dangerous';
  };

  const handleFavoritePress = () => {
    setIsFavorite(!isFavorite);
    Alert.alert(
      isFavorite ? 'Removed from Favorites' : 'Added to Favorites',
      isFavorite ? 'Product removed from your favorites' : 'Product added to your favorites'
    );
  };

  const handleSharePress = () => {
    Alert.alert('Share', 'Share functionality coming soon!');
  };

  const handleAlternativePress = (alternative) => {
    Alert.alert('Alternative Product', `${alternative.name} details coming soon!`);
  };

  const handleIngredientPress = (ingredient) => {
    const normalizedName = ingredient.toLowerCase();
    const ingredientInfo = ingredientData.ingredients[normalizedName] || null;
    setSelectedIngredient(ingredient);
    setIngredientModalVisible(true);
  };

  const getScoreExplanation = () => {
    if (!analysis || !analysis.score) return [];

    const explanations = [];
    const score = analysis.score;
    // Normalize to 0-100 if needed
    const normalizedScore = (score <= 10 && score > 0) ? score * 10 : score;

    // Add explanations based on analysis data
    if (analysis.high_sodium) {
      explanations.push("🧂 High sodium content affects cardiovascular health");
    }
    if (analysis.high_sugar || analysis.added_sugars) {
      explanations.push("🍬 Contains high sugar or added sugars");
    }
    if (analysis.preservatives && analysis.preservatives.length > 0) {
      explanations.push("🧪 Contains preservatives for shelf life");
    }
    if (analysis.allergen_warnings && analysis.allergen_warnings.length > 0) {
      explanations.push("⚠️ Contains known allergens");
    }
    if (analysis.processing_level === 'highly processed') {
      explanations.push("⚗️ Highly processed food product");
    }

    // Generic explanations based on score range (0-100 scale)
    if (normalizedScore >= 75) {
      explanations.push("✅ Generally healthy ingredient profile");
    } else if (normalizedScore >= 45) {
      explanations.push("⚠️ Moderate health concerns identified");
    } else {
      explanations.push("❌ Multiple health concerns detected");
    }

    return explanations;
  };

  // Sample alternatives for demo
  const alternatives = [
    { id: '2', name: 'Natural Spring Water', brand: 'HIMALAYAN', healthScore: 90 },
    { id: '3', name: 'Alkaline Water', brand: 'EVOCUS', healthScore: 85 },
  ];

  // Normalize a display name to handle different shapes coming from history or product docs
  const displayName = product.product_name || product.productName || product.name || product.title || 'Unnamed Product';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Product Header */}
        <View style={styles.productHeader}>
          <View style={styles.productImageContainer}>
            {product.image ? (
              <Image source={{ uri: product.image }} style={styles.productImage} />
            ) : (
              <View style={styles.placeholderImage}>
                <MaterialIcons name="fastfood" size={48} color={COLORS.textLight} />
              </View>
            )}

            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={handleFavoritePress}
            >
              <MaterialIcons
                name={isFavorite ? "favorite" : "favorite-border"}
                size={24}
                color={isFavorite ? COLORS.error : COLORS.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.productInfo}>
            <Text style={styles.productName}>{displayName}</Text>
            <Text style={styles.brandName}>{product.brand}</Text>
            {product.size && <Text style={styles.productSize}>{product.size}</Text>}

            <View style={styles.originContainer}>
              <Text style={styles.originFlag}>🇮🇳</Text>
              <Text style={styles.originText}>स्वदेशी • {product.size}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleSharePress}
          >
            <MaterialIcons name="share" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>


        {/* Health Score */}
        <View style={styles.healthScoreContainer}>
          <View style={styles.healthScoreCard}>
            <View style={styles.scoreDisplay}>
              <View
                style={[
                  styles.scoreCircle,
                  { backgroundColor: getHealthScoreColor(scoreValue) }
                ]}
              >
                <Text style={styles.scoreNumber}>{scoreValue}</Text>
                <Text style={{ fontSize: 10, color: COLORS.textOnPrimary, opacity: 0.8 }}>/100</Text>
              </View>
              <View style={styles.scoreInfo}>
                <Text style={styles.scoreTitle}>Health Score</Text>
                {personalizedScoreLoading ? (
                  <Text style={[styles.scoreStatus, { color: COLORS.textSecondary, fontSize: 12 }]}>
                    Calculating personalized score...
                  </Text>
                ) : (
                  <Text style={[
                    styles.scoreStatus,
                    { color: getHealthScoreColor(scoreValue) }
                  ]}>
                    {getHealthScoreText(scoreValue)}
                  </Text>
                )}
              </View>
            </View>

            {/* Visual score range indicator */}
            {!personalizedScoreLoading && (
              <View style={{ marginTop: SPACING.md }}>
                <View style={{ 
                  height: 8, 
                  backgroundColor: COLORS.border,
                  borderRadius: 4,
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  {/* Score fill */}
                  <View style={{ 
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${scoreFillValue}%`,
                    backgroundColor: getHealthScoreColor(scoreValue),
                    borderRadius: 4
                  }} />
                </View>
                {/* Score range labels */}
                <View style={{ 
                  flexDirection: 'row', 
                  justifyContent: 'space-between',
                  marginTop: 4
                }}>
                  <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>0</Text>
                  <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>Dangerous</Text>
                  <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>Poor</Text>
                  <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>Moderate</Text>
                  <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>Good</Text>
                  <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>100</Text>
                </View>
              </View>
            )}

            {/* Show personalized scoring indicator if user has health conditions */}
            {userProfile.healthConditions && userProfile.healthConditions.length > 0 && (
              <View style={{ 
                marginTop: SPACING.sm, 
                padding: SPACING.sm, 
                backgroundColor: COLORS.primary + '15',
                borderRadius: BORDER_RADIUS.sm,
                flexDirection: 'row',
                alignItems: 'center'
              }}>
                <MaterialIcons name="person" size={16} color={COLORS.primary} />
                <Text style={{ 
                  marginLeft: SPACING.xs, 
                  fontSize: 12, 
                  color: COLORS.primary,
                  flex: 1
                }}>
                  Personalized for: {userProfile.healthConditions.map(c => 
                    c.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
                  ).join(', ')}
                </Text>
              </View>
            )}

            {/* Critical health warning for very low scores */}
            {analysis?.critical_warning && !personalizedScoreLoading && (
              <View style={{ 
                marginTop: SPACING.md,
                padding: SPACING.md,
                backgroundColor: '#ffebee',
                borderRadius: BORDER_RADIUS.md,
                borderWidth: 2,
                borderColor: '#c0392b'
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <Text style={{ fontSize: 24, marginRight: SPACING.sm }}>⚠️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ 
                      fontSize: 14, 
                      fontWeight: '700', 
                      color: '#c0392b',
                      marginBottom: 4
                    }}>
                      CRITICAL HEALTH WARNING
                    </Text>
                    <Text style={{ fontSize: 13, color: '#d32f2f', lineHeight: 18 }}>
                      This product contains harmful levels of ingredients that pose significant risks for your health condition. Strongly avoid consumption and consult your doctor if consumed regularly.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Recommendation from personalized score */}
            {analysis?.recommendation && !personalizedScoreLoading && (
              <View style={{ 
                marginTop: SPACING.md, 
                padding: SPACING.md, 
                backgroundColor: COLORS.backgroundLight,
                borderRadius: BORDER_RADIUS.md,
                borderLeftWidth: 4,
                borderLeftColor: getHealthScoreColor(scoreValue)
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <Text style={{ fontSize: 20, marginRight: SPACING.sm }}>
                    {analysis.emoji || '💡'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ 
                      fontSize: 14, 
                      fontWeight: '600', 
                      color: COLORS.text,
                      marginBottom: SPACING.xs
                    }}>
                      Recommendation
                    </Text>
                    <Text style={{ 
                      fontSize: 13, 
                      color: COLORS.text,
                      lineHeight: 18
                    }}>
                      {analysis.recommendation}
                    </Text>
                  </View>
                </View>
                
                {/* Guideline details */}
                {analysis.guideline && (
                  <View style={{ 
                    marginTop: SPACING.sm, 
                    paddingTop: SPACING.sm,
                    borderTopWidth: 1,
                    borderTopColor: COLORS.border
                  }}>
                    <Text style={{ 
                      fontSize: 12, 
                      color: COLORS.textSecondary,
                      fontStyle: 'italic'
                    }}>
                      {analysis.guideline}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {((analysis?.personalizedWarnings?.length > 0) || (product?.personalizedWarnings?.length > 0)) && (
              <View style={[styles.warningContainer, { flexDirection: 'column', alignItems: 'stretch' }]}>
                {(analysis?.personalizedWarnings || product?.personalizedWarnings || []).map((warning, idx) => (
                  <View
                    key={idx}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: idx < (analysis?.personalizedWarnings || product?.personalizedWarnings || []).length - 1 ? 8 : 0
                    }}
                  >
                    <MaterialIcons name="warning" size={18} color={COLORS.warning} />
                    <Text style={styles.warningText}>{warning}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* One-line explanation (collapsible) */}
            {analysis && (
              <View style={{ marginTop: SPACING.md }}>
                <TouchableOpacity
                  onPress={() => setExplanationOpen(!explanationOpen)}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.backgroundLight, padding: 10, borderRadius: 8 }}
                >
                  <MaterialIcons name="insights" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                  <Text style={{ fontWeight: '700', color: COLORS.text, flex: 1 }}>Why this score?</Text>
                  <MaterialIcons name={explanationOpen ? "expand-less" : "expand-more"} size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>
                {explanationOpen && (
                  <View style={{ marginTop: SPACING.sm, paddingLeft: 10 }}>
                    {analysis.breakdown ? (
                      <>
                        {/* ML Penalties */}
                        {analysis.breakdown.ml_penalties && analysis.breakdown.ml_penalties.length > 0 && (
                          <View style={{ marginBottom: SPACING.sm }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 4 }}>
                              🔬 Ingredient Analysis
                            </Text>
                            {analysis.breakdown.ml_penalties.map((item, idx) => (
                              <View key={`ml-${idx}`} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2, paddingLeft: 8 }}>
                                <Text style={{ fontSize: 12, color: COLORS.text, flex: 1 }}>
                                  • {item.ingredient} ({item.category})
                                </Text>
                                <Text style={{ fontSize: 12, color: COLORS.error, fontWeight: 'bold' }}>
                                  -{item.adjusted_penalty || item.final_penalty || 0}
                                </Text>
                              </View>
                            ))}
                            <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2, paddingLeft: 8 }}>
                              Total: -{analysis.breakdown.total_ml_penalty || 0} pts
                            </Text>
                          </View>
                        )}

                        {/* Nutrition Penalties */}
                        {analysis.breakdown.nutrition_penalties && analysis.breakdown.nutrition_penalties.length > 0 && (
                          <View style={{ marginBottom: SPACING.sm }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 4 }}>
                              🥗 Nutritional Impact
                            </Text>
                            {analysis.breakdown.nutrition_penalties.map((item, idx) => (
                              <View key={`nutr-${idx}`} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2, paddingLeft: 8 }}>
                                {(() => {
                                  const isMilliUnit = item.nutrient === 'sodium' || item.nutrient === 'cholesterol';
                                  const displayValue = Number(item.value || 0);
                                  const formattedValue = isMilliUnit
                                    ? Math.round(displayValue * 1000)
                                    : Math.round(displayValue * 100) / 100;
                                  const displayUnit = isMilliUnit ? 'mg/100g' : 'g/100g';

                                  return (
                                    <Text style={{ fontSize: 12, color: COLORS.text, flex: 1 }}>
                                      • {item.nutrient}: {formattedValue}{displayUnit}
                                    </Text>
                                  );
                                })()}
                                <Text style={{ fontSize: 12, color: COLORS.error, fontWeight: 'bold' }}>
                                  -{item.adjusted_penalty || item.penalty || 0}
                                </Text>
                              </View>
                            ))}
                            <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2, paddingLeft: 8 }}>
                              Total: -{analysis.breakdown.total_nutrition_penalty || 0} pts
                            </Text>
                          </View>
                        )}

                        {/* Bonuses */}
                        {analysis.breakdown.bonuses && analysis.breakdown.bonuses.length > 0 && (
                          <View style={{ marginBottom: SPACING.sm }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.success, marginBottom: 4 }}>
                              ✨ Health Bonuses
                            </Text>
                            {analysis.breakdown.bonuses.map((item, idx) => (
                              <View key={`bonus-${idx}`} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2, paddingLeft: 8 }}>
                                <Text style={{ fontSize: 12, color: COLORS.text, flex: 1 }}>
                                  • {item.nutrient}: {item.value}g/100g
                                </Text>
                                <Text style={{ fontSize: 12, color: COLORS.success, fontWeight: 'bold' }}>
                                  +{item.adjusted_bonus || item.bonus || 0}
                                </Text>
                              </View>
                            ))}
                            <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2, paddingLeft: 8 }}>
                              Total: +{analysis.breakdown.total_bonus || 0} pts
                            </Text>
                          </View>
                        )}

                        {/* Summary */}
                        <View style={{ 
                          marginTop: SPACING.sm, 
                          paddingTop: SPACING.sm, 
                          borderTopWidth: 1, 
                          borderTopColor: COLORS.border 
                        }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text }}>
                              Total Score Calculation
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 8 }}>
                            <Text style={{ fontSize: 12, color: COLORS.text }}>
                              100 - {analysis.breakdown.net_penalty || 0} penalty pts
                            </Text>
                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: getHealthScoreColor(scoreValue) }}>
                              = {scoreValue}/100
                            </Text>
                          </View>
                        </View>
                      </>
                    ) : (
                      <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>
                        Analysis breakdown not available
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Consumption Prompt */}
        <View style={{ alignItems: 'center', marginVertical: SPACING.md }}>
          <Text style={{ color: COLORS.text, fontWeight: '600', fontSize: 16, marginBottom: 8 }}>Are you going to consume this?</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
            <TouchableOpacity
              style={{
                backgroundColor: isConsumed ? COLORS.success : COLORS.surface,
                paddingHorizontal: 24,
                paddingVertical: 10,
                borderRadius: 8,
                marginHorizontal: 8,
                borderWidth: 1,
                borderColor: isConsumed ? COLORS.success : COLORS.border
              }}
              onPress={handleConsumption}
              disabled={intakeLoading}
            >
              <Text style={{ color: isConsumed ? COLORS.textOnPrimary : COLORS.text, fontWeight: '700' }}>
                {isConsumed ? '✓ Consumed' : 'Yes'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                backgroundColor: COLORS.surface,
                paddingHorizontal: 24,
                paddingVertical: 10,
                borderRadius: 8,
                marginHorizontal: 8,
                borderWidth: 1,
                borderColor: COLORS.border
              }}
              onPress={handleNotConsuming}
              disabled={intakeLoading}
            >
              <Text style={{ color: COLORS.text, fontWeight: '700' }}>No</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'ingredients' && styles.activeTab
            ]}
            onPress={() => setActiveTab('ingredients')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'ingredients' && styles.activeTabText
            ]}>
              Ingredients
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'nutrition' && styles.activeTab
            ]}
            onPress={() => setActiveTab('nutrition')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'nutrition' && styles.activeTabText
            ]}>
              Nutrients
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'ingredients' ? (
            <>
              <IngredientCollapsible
                ingredients={ingredientList}
                rawIngredients={rawIngredientsArray}
                onIngredientPress={handleIngredientPress}
              />
              
              {/* Warning when ingredients are empty/corrupted */}
              {ingredientList.length === 0 && (
                <View style={styles.dataWarningBox}>
                  <MaterialIcons name="info-outline" size={20} color={COLORS.warning} />
                  <Text style={styles.dataWarningText}>
                    Ingredients data needs verification. Corrupted or missing ingredient information has been filtered out.
                  </Text>
                </View>
              )}

              {/* Why This Score? Section */}
              {analysis && analysis.score && (
                <View style={styles.educationSection}>
                  <TouchableOpacity
                    style={styles.educationHeader}
                    onPress={() => setExplanationOpen(!explanationOpen)}
                  >
                    <Text style={styles.educationTitle}>🎯 Why this score?</Text>
                    <MaterialIcons
                      name={explanationOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                      size={24}
                      color={COLORS.primary}
                    />
                  </TouchableOpacity>

                  <Collapsible collapsed={!explanationOpen}>
                    <View style={styles.educationContent}>
                      {getScoreExplanation().map((explanation, index) => (
                        <Text key={index} style={styles.explanationText}>
                          {explanation}
                        </Text>
                      ))}
                    </View>
                  </Collapsible>
                </View>
              )}
            </>
          ) : (
            <>
              {/* Warning when nutrition data is empty */}
              {(!displayNutrition || Object.keys(displayNutrition).length === 0) && (
                <View style={styles.dataWarningBox}>
                  <MaterialIcons name="info-outline" size={20} color={COLORS.warning} />
                  <Text style={styles.dataWarningText}>
                    Nutrition data is missing or incomplete. Please help verify product information through the scan screen.
                  </Text>
                </View>
              )}
              
              <NutritionalTable
                nutrition={displayNutrition}
                showPerUnit={product.size || '100ml'}
              />
              <TouchableOpacity style={{ marginTop: 8 }} onPress={() => setShowRawNutrition(s => !s)}>
                <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Show raw nutrition ({Object.keys(displayNutrition || {}).length})</Text>
              </TouchableOpacity>
              {showRawNutrition && (
                <ScrollView style={{ marginTop: 8, maxHeight: 220, backgroundColor: COLORS.surface, padding: SPACING.sm, borderRadius: 8 }}>
                  <Text style={{ color: COLORS.text, fontSize: 12 }}>{JSON.stringify(displayNutrition, null, 2)}</Text>
                </ScrollView>
              )}
            </>
          )}
        </View>

        {/* Sustainability Info */}
        <View style={styles.sustainabilityContainer}>
          <View style={styles.sustainabilityCard}>
            <View style={styles.sustainabilityHeader}>
              <MaterialIcons name="eco" size={24} color={COLORS.success} />
              <Text style={styles.sustainabilityTitle}>Environmental Impact</Text>
            </View>
            <Text style={styles.sustainabilityText}>
              🌍 Medium carbon footprint - packaged in plastic. Consider recycling after use.
            </Text>
          </View>
        </View>

        {/* Alternatives Section */}
        {alternatives.length > 0 && (
          <View style={styles.alternativesSection}>
            <Text style={styles.sectionTitle}>Better Alternatives</Text>
            <Text style={styles.sectionSubtitle}>
              Similar products with higher health scores
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.alternativesContainer}
            >
              {alternatives.map((alternative) => (
                <View key={alternative.id} style={styles.alternativeItem}>
                  <ProductCard
                    product={alternative}
                    onPress={() => handleAlternativePress(alternative)}
                    showDetails={true}
                    style={styles.alternativeCard}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Today's Intake Section */}
        {renderTodaysIntake()}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => Alert.alert('Report', 'Report functionality coming soon!')}
          >
            <MaterialIcons name="flag" size={20} color={COLORS.textSecondary} />
            <Text style={styles.secondaryButtonText}>Report Issue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Scan' })}
          >
            <MaterialIcons name="qr-code-scanner" size={20} color={COLORS.textOnPrimary} />
            <Text style={styles.primaryButtonText}>Scan Another</Text>
          </TouchableOpacity>
        </View>

        {/* Review Section */}
        <View style={{ paddingHorizontal: SPACING.lg, marginTop: SPACING.md }}>
          {!showReviewForm ? (
            <TouchableOpacity style={[styles.saveButton, { backgroundColor: COLORS.surface }]} onPress={() => setShowReviewForm(true)}>
              <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Write a Review</Text>
            </TouchableOpacity>
          ) : (
            <ReviewForm
              initialRating={5}
              onSubmit={async ({ rating, text }) => {
                const user = auth.currentUser;
                if (!user) { Alert.alert('Sign in required', 'Please sign in to submit reviews'); return; }
                setSubmittingReview(true);
                try {
                  const scanId = product.barcode || product.barcodeKey || product.id || String(product.product_code || product.code || product.barcodeNumber || 'unknown');
                  const reviewsCol = collection(db, 'users', user.uid, 'scans', String(scanId), 'reviews');
                  await addDoc(reviewsCol, { rating, text, createdAt: serverTimestamp(), author: { uid: user.uid, email: user.email, name: user.displayName || '' } });
                  Alert.alert('Thanks!', 'Your review was saved.');
                  setShowReviewForm(false);
                } catch (e) {
                  console.warn('Failed to save review', e && e.message ? e.message : e);
                  Alert.alert('Error', 'Failed to save review');
                } finally {
                  setSubmittingReview(false);
                }
              }}
              submitting={submittingReview}
            />
          )}
        </View>

        {/* What You Learned Section */}
        <View style={styles.learningSection}>
          <Text style={styles.learningSectionTitle}>🎓 What you learned from this product</Text>
          <View style={styles.learningItems}>
            <Text style={styles.learningItem}>• Ingredient order reflects quantity - first ingredients make up most of the product</Text>
            {analysis?.preservatives && analysis.preservatives.length > 0 && (
              <Text style={styles.learningItem}>• Additives and preservatives help extend shelf life but should be consumed in moderation</Text>
            )}
            {analysis?.high_sugar && (
              <Text style={styles.learningItem}>• High sugar products should be enjoyed occasionally as part of a balanced diet</Text>
            )}
            <Text style={styles.learningItem}>• Reading ingredient lists helps you make informed food choices</Text>
          </View>
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Ingredient Info Modal */}
      <IngredientInfoModal
        visible={ingredientModalVisible}
        onClose={() => setIngredientModalVisible(false)}
        ingredient={selectedIngredient}
        ingredientData={selectedIngredient ? ingredientData.ingredients[selectedIngredient.toLowerCase()] : null}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundLight,
  },
  scrollView: {
    flex: 1,
  },
  productHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    alignItems: 'flex-start',
    ...SHADOWS.small,
  },
  productImageContainer: {
    position: 'relative',
    marginRight: SPACING.md,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
  },
  placeholderImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.full,
    padding: SPACING.xs,
    ...SHADOWS.small,
  },
  productInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  productName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  brandName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
  },
  productSize: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  originContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  originFlag: {
    fontSize: TYPOGRAPHY.fontSize.base,
    marginRight: SPACING.xs,
  },
  originText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
  },
  shareButton: {
    padding: SPACING.sm,
  },
  healthScoreContainer: {
    padding: SPACING.lg,
  },
  healthScoreCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.medium,
  },
  scoreDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  scoreCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  scoreNumber: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textOnPrimary,
  },
  scoreInfo: {
    flex: 1,
  },
  scoreTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  scoreStatus: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundLight,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  warningText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.warning,
    marginLeft: SPACING.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  dataWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3E0',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginVertical: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  dataWarningText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
    marginLeft: SPACING.sm,
    lineHeight: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.xs,
    ...SHADOWS.small,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
  },
  activeTab: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  activeTabText: {
    color: COLORS.textOnPrimary,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  tabContent: {
    paddingHorizontal: SPACING.lg,
  },
  sustainabilityContainer: {
    paddingHorizontal: SPACING.lg,
  },
  sustainabilityCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    ...SHADOWS.small,
  },
  sustainabilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sustainabilityTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  sustainabilityText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.sm,
  },
  alternativesSection: {
    paddingTop: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  sectionSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  alternativesContainer: {
    paddingLeft: SPACING.lg,
  },
  alternativeItem: {
    width: screenWidth * 0.8,
    marginRight: SPACING.md,
  },
  alternativeCard: {
    marginVertical: 0,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    gap: SPACING.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.small,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  primaryButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginLeft: SPACING.sm,
  },
  secondaryButtonText: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginLeft: SPACING.sm,
  },
  bottomSpacing: {
    height: SPACING.xl,
  },
  educationSection: {
    backgroundColor: COLORS.surface,
    marginTop: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  educationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.backgroundLight,
  },
  educationTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
  },
  educationContent: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  explanationText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.base,
    marginBottom: SPACING.xs,
  },
  learningSection: {
    backgroundColor: COLORS.surface,
    margin: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.small,
  },
  learningSectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  learningItems: {
    gap: SPACING.sm,
  },
  learningItem: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.base,
  },
});

export default ProductDetailsScreen;