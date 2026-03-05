import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants/theme';
import { db, auth } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { fetchProductData } from '../utils/productDataFetcher';

const ManualProductEntryScreen = ({ route, navigation }) => {
  const { barcode } = route.params;
  const [loading, setLoading] = useState(false);
  
  // Step 8: Auto-fetch state
  const [fetchingData, setFetchingData] = useState(true);
  const [fetchedProduct, setFetchedProduct] = useState(null);
  const [dataSource, setDataSource] = useState(null);
  const [completenessScore, setCompletenessScore] = useState(0);
  const [autoFilledFields, setAutoFilledFields] = useState(new Set());
  
  // Product info state
  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  
  // Nutrition state (per 100g)
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [sugar, setSugar] = useState('');
  const [fat, setFat] = useState('');
  const [saturatedFat, setSaturatedFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [sodium, setSodium] = useState('');
  const [caffeine, setCaffeine] = useState('');
  
  // Ingredients state
  const [ingredientsList, setIngredientsList] = useState('');
  
  // Step 8: Auto-fetch product data on screen load
  useEffect(() => {
    const fetchAvailableData = async () => {
      try {
        setFetchingData(true);
        console.log('[ManualEntry] Attempting to fetch data for barcode:', barcode);
        
        const product = await fetchProductData(barcode);
        
        if (product) {
          console.log('[ManualEntry] Product data fetched:', product.product_name);
          console.log('[ManualEntry] Completeness:', product.metadata?.completeness_score + '%');
          
          setFetchedProduct(product);
          setDataSource(product.metadata?.primary_source || 'Unknown');
          setCompletenessScore(product.metadata?.completeness_score || 0);
          
          // Pre-fill basic information
          const fieldsSet = new Set();
          
          if (product.product_name) {
            setProductName(product.product_name);
            fieldsSet.add('productName');
          }
          if (product.brands) {
            setBrand(product.brands);
            fieldsSet.add('brand');
          }
          if (product.categories) {
            setCategory(product.categories);
            fieldsSet.add('category');
          }
          
          // Pre-fill nutrition from multiple possible field names
          const nutr = product.nutriments || product.nutrition || {};
          
          if (nutr['energy-kcal'] || nutr.energy_kcal_100g) {
            setCalories(String(nutr['energy-kcal'] || nutr.energy_kcal_100g));
            fieldsSet.add('calories');
          }
          if (nutr.proteins || nutr.proteins_100g) {
            setProtein(String(nutr.proteins || nutr.proteins_100g));
            fieldsSet.add('protein');
          }
          if (nutr.carbohydrates || nutr.carbohydrates_100g) {
            setCarbs(String(nutr.carbohydrates || nutr.carbohydrates_100g));
            fieldsSet.add('carbs');
          }
          if (nutr.sugars || nutr.sugars_100g) {
            setSugar(String(nutr.sugars || nutr.sugars_100g));
            fieldsSet.add('sugar');
          }
          if (nutr.fat || nutr.fat_100g) {
            setFat(String(nutr.fat || nutr.fat_100g));
            fieldsSet.add('fat');
          }
          if (nutr['saturated-fat'] || nutr.saturated_fat_100g) {
            setSaturatedFat(String(nutr['saturated-fat'] || nutr.saturated_fat_100g));
            fieldsSet.add('saturatedFat');
          }
          if (nutr.fiber || nutr.fiber_100g) {
            setFiber(String(nutr.fiber || nutr.fiber_100g));
            fieldsSet.add('fiber');
          }
          if (nutr.sodium || nutr.sodium_100g || nutr.salt || nutr.salt_100g) {
            const sodiumValue = nutr.sodium || nutr.sodium_100g || (nutr.salt || nutr.salt_100g) * 1000;
            setSodium(String(sodiumValue));
            fieldsSet.add('sodium');
          }
          
          // Pre-fill ingredients
          if (product.ingredients_text) {
            setIngredientsList(product.ingredients_text);
            fieldsSet.add('ingredients');
          }
          
          setAutoFilledFields(fieldsSet);
          console.log('[ManualEntry] Auto-filled fields:', Array.from(fieldsSet).join(', '));
        } else {
          console.log('[ManualEntry] No product data available from API');
        }
      } catch (error) {
        console.error('[ManualEntry] Error fetching product data:', error);
        // Don't show error to user, just continue with empty form
      } finally {
        setFetchingData(false);
      }
    };
    
    fetchAvailableData();
  }, [barcode]);

  const validateInputs = () => {
    if (!productName.trim()) {
      Alert.alert('Validation Error', 'Product name is required');
      return false;
    }
    
    if (!ingredientsList.trim()) {
      Alert.alert('Validation Error', 'Ingredients list is required');
      return false;
    }

    // At least some nutrition info should be provided
    const hasNutrition = [calories, protein, carbs, sugar, fat].some(val => val.trim() !== '');
    if (!hasNutrition) {
      Alert.alert('Validation Error', 'Please provide at least some nutrition information');
      return false;
    }

    return true;
  };

  const parseIngredients = (ingredientsText) => {
    // Common typo corrections mapping
    const typoCorrections = {
      'oass': 'oats',
      'suger': 'sugar',
      'suagar': 'sugar',
      'whaet': 'wheat',
      'wheeat': 'wheat',
      'milf': 'milk',
      'sallt': 'salt',
      'flor': 'flour',
      'flowur': 'flour',
      'choclate': 'chocolate',
      'chocolatte': 'chocolate'
    };

    // Split by comma and clean up each ingredient
    const ingredients = ingredientsText
      .split(',')
      .map(ingredient => {
        let cleanedIngredient = ingredient.trim();
        
        // Check for typos and correct them
        Object.keys(typoCorrections).forEach(typo => {
          const regex = new RegExp(`\\b${typo}\\b`, 'gi');
          cleanedIngredient = cleanedIngredient.replace(regex, typoCorrections[typo]);
        });
        
        return cleanedIngredient;
      })
      .filter(ingredient => ingredient.length > 0)
      .map((ingredient, index) => ({
        id: `ingredient_${index}`,
        text: ingredient,
        percent: null, // User didn't specify percentages
        rank: index + 1
      }));
    
    return ingredients;
  };

  const formatNutrition = () => {
    const nutrition = {};
    
    // Convert string inputs to numbers, only if they have values
    if (calories.trim()) nutrition.energy_kcal_100g = parseFloat(calories);
    if (protein.trim()) nutrition.proteins_100g = parseFloat(protein);
    if (carbs.trim()) nutrition.carbohydrates_100g = parseFloat(carbs);
    if (sugar.trim()) nutrition.sugars_100g = parseFloat(sugar);
    if (fat.trim()) nutrition.fat_100g = parseFloat(fat);
    if (saturatedFat.trim()) nutrition.saturated_fat_100g = parseFloat(saturatedFat);
    if (fiber.trim()) nutrition.fiber_100g = parseFloat(fiber);
    if (sodium.trim()) nutrition.sodium_100g = parseFloat(sodium);
    if (caffeine.trim()) nutrition.caffeine_100g = parseFloat(caffeine);

    return nutrition;
  };

  const handleSaveProduct = async () => {
    if (!validateInputs()) return;

    try {
      setLoading(true);
      
      // Check if user is authenticated, if not, sign in anonymously
      let user = auth.currentUser;
      if (!user) {
        console.log('No user found, signing in anonymously...');
        const { signInAnonymously } = require('firebase/auth');
        const userCredential = await signInAnonymously(auth);
        user = userCredential.user;
        console.log('Signed in anonymously:', user.uid);
      }

      const ingredients = parseIngredients(ingredientsList);
      const nutrition = formatNutrition();
      
      // Step 8: Track which fields were user-edited vs auto-filled
      const userEditedFields = [];
      const autoFilledFieldsList = [];
      
      // Check each field to see if it was modified from auto-filled value
      ['productName', 'brand', 'category', 'calories', 'protein', 'carbs', 'sugar', 
       'fat', 'saturatedFat', 'fiber', 'sodium', 'ingredients'].forEach(field => {
        if (autoFilledFields.has(field)) {
          autoFilledFieldsList.push(field);
        } else {
          userEditedFields.push(field);
        }
      });
      
      const productData = {
        // Basic info
        product_name: productName.trim(),
        productName: productName.trim(),
        name: productName.trim(),
        barcode: barcode,
        barcodeKey: barcode,
        code: barcode,
        
        // Nutrition
        nutriments: nutrition,
        nutrition: nutrition,
        
        // Ingredients
        ingredients: ingredients,
        ingredients_text: ingredientsList.trim(),
        
        // Metadata
        _source: 'manual_entry',
        addedBy: user.uid,
        addedAt: serverTimestamp(),
        isManualEntry: true,
        
        // Step 8: Enhanced metadata
        _verified: true,
        _verified_by: 'user',
        _verified_at: serverTimestamp(),
        metadata: {
          original_source: dataSource || 'none',
          original_completeness: completenessScore,
          auto_filled_fields: autoFilledFieldsList,
          user_edited_fields: userEditedFields,
          entry_type: fetchedProduct ? 'auto_fill_enhanced' : 'fully_manual',
          completeness_score: 100, // User completed the product
          needs_verification: false,
          user_verified: true,
        },
        
        // Set a default health score (will be calculated later)
        healthScore: 0,
      };

      // Only add optional fields if they have values (avoid undefined)
      if (brand.trim()) {
        productData.brand = brand.trim();
      }
      
      if (category.trim()) {
        productData.category = category.trim();
      }

      // Save to Firebase
      console.log('Saving product to Firebase:', barcode);
      const productRef = doc(db, 'products', barcode);
      await setDoc(productRef, productData);
      console.log('Product saved successfully to Firebase');
      
      Alert.alert(
        'Success!', 
        'Product added successfully and is now available to everyone! You can scan this product again to view your entry.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to ProductDetails with the new product
              navigation.navigate('ProductDetails', { 
                product: productData 
              });
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error saving product:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      // Provide more specific error messages
      let errorMessage = 'Failed to save product to database. ';
      if (error.code === 'permission-denied') {
        errorMessage += 'Permission denied. Trying to fix authentication...';
      } else if (error.code === 'unavailable') {
        errorMessage += 'Firebase service unavailable. Check your internet connection.';
      } else if (error.code === 'network-request-failed') {
        errorMessage += 'Network error. Please check your internet connection.';
      } else {
        errorMessage += `Error: ${error.message}`;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderNutritionInput = (label, value, setValue, unit = 'g', placeholder = '') => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label} (per 100{unit})</Text>
      <TextInput
        style={styles.nutritionInput}
        value={value}
        onChangeText={setValue}
        keyboardType="decimal-pad"
        placeholder={placeholder || `Enter ${label.toLowerCase()}`}
        placeholderTextColor={COLORS.textSecondary}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Product Manually</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Step 8: Loading state while fetching data */}
        {fetchingData && (
          <View style={styles.fetchingBox}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.fetchingText}>
              Searching for available product data...
            </Text>
          </View>
        )}
        
        {/* Step 8: Data quality banner (if data was fetched) */}
        {!fetchingData && fetchedProduct && (
          <View style={styles.dataQualityBox}>
            <View style={styles.dataQualityHeader}>
              <MaterialIcons name="cloud-download" size={20} color={COLORS.success} />
              <Text style={styles.dataQualityTitle}>Data Auto-Filled</Text>
              <View style={[
                styles.completenessbadge,
                { backgroundColor: completenessScore >= 70 ? COLORS.success : COLORS.warning }
              ]}>
                <Text style={styles.completenessBadgeText}>{completenessScore}%</Text>
              </View>
            </View>
            <Text style={styles.dataQualityText}>
              Found data from {dataSource}. {autoFilledFields.size} field{autoFilledFields.size !== 1 ? 's' : ''} pre-filled.
              Please review and complete any missing information.
            </Text>
          </View>
        )}
        
        <View style={styles.infoBox}>
          <MaterialIcons name="info" size={20} color={COLORS.primary} />
          <Text style={styles.infoText}>
            {fetchedProduct 
              ? `Review the auto-filled data and complete any missing fields for barcode: ${barcode}`
              : `This product (barcode: ${barcode}) wasn't found. Please add the nutrition information and ingredients.`
            }
          </Text>
        </View>

        {/* Basic Product Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Product Name *</Text>
            <TextInput
              style={styles.textInput}
              value={productName}
              onChangeText={setProductName}
              placeholder="Enter product name"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Brand</Text>
            <TextInput
              style={styles.textInput}
              value={brand}
              onChangeText={setBrand}
              placeholder="Enter brand name (optional)"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Category</Text>
            <TextInput
              style={styles.textInput}
              value={category}
              onChangeText={setCategory}
              placeholder="e.g., Snacks, Beverages, Dairy (optional)"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>
        </View>

        {/* Nutrition Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nutrition Information</Text>
          <Text style={styles.sectionSubtitle}>Enter values per 100g/100ml (at least some fields required)</Text>
          
          {renderNutritionInput('Calories', calories, setCalories, 'g', 'kcal')}
          {renderNutritionInput('Protein', protein, setProtein)}
          {renderNutritionInput('Carbohydrates', carbs, setCarbs)}
          {renderNutritionInput('Sugar', sugar, setSugar)}
          {renderNutritionInput('Total Fat', fat, setFat)}
          {renderNutritionInput('Saturated Fat', saturatedFat, setSaturatedFat)}
          {renderNutritionInput('Fiber', fiber, setFiber)}
          {renderNutritionInput('Sodium', sodium, setSodium, 'g', 'mg')}
          {renderNutritionInput('Caffeine', caffeine, setCaffeine, 'g', 'mg')}
        </View>

        {/* Ingredients */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingredients *</Text>
          <Text style={styles.sectionSubtitle}>
            List all ingredients separated by commas (in order of quantity)
          </Text>
          
          <View style={styles.inputGroup}>
            <TextInput
              style={styles.textAreaInput}
              value={ingredientsList}
              onChangeText={setIngredientsList}
              placeholder="e.g., Water, Sugar, Wheat flour, Salt, Natural flavors"
              placeholderTextColor={COLORS.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity 
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSaveProduct}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <MaterialIcons name="save" size={20} color="white" />
              <Text style={styles.saveButtonText}>Save Product</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.primaryLight,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  infoText: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.sm,
  },
  // Step 8: New styles for data quality display
  fetchingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundLight,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  fetchingText: {
    marginLeft: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
  },
  dataQualityBox: {
    backgroundColor: COLORS.success + '15', // 15 = ~8% opacity
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.success + '40',
  },
  dataQualityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  dataQualityTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.success,
    marginLeft: SPACING.xs,
    flex: 1,
  },
  completenessbadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  completenessBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.white,
  },
  dataQualityText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.sm,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  sectionSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  nutritionInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    width: 120,
  },
  textAreaInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    height: 100,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginLeft: SPACING.xs,
  },
  bottomSpacer: {
    height: SPACING.xl,
  },
});

export default ManualProductEntryScreen;