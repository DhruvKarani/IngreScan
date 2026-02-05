import React, { useState } from 'react';
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

const ManualProductEntryScreen = ({ route, navigation }) => {
  const { barcode } = route.params;
  const [loading, setLoading] = useState(false);
  
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
        <View style={styles.infoBox}>
          <MaterialIcons name="info" size={20} color={COLORS.primary} />
          <Text style={styles.infoText}>
            This product (barcode: {barcode}) wasn't found in our database. 
            Please help us by adding the nutrition information and ingredients.
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