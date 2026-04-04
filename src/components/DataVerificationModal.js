/**
 * Data Verification Modal Component
 * 
 * Shows when product data from API is incomplete and needs user verification.
 * Displays missing fields and allows user to:
 * - Skip (use incomplete data as-is)
 * - Complete (fill in missing fields)
 * - Cancel (reject the data)
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';

const DataVerificationModal = ({
  visible,
  product,
  metadata,
  onSkip,
  onComplete,
  onCancel,
}) => {
  // State for editing missing fields
  const [editedData, setEditedData] = useState({});
  
  // Pre-populate form with existing product data
  useEffect(() => {
    if (!product) return;
    
    const existingData = {};
    
    console.log('[DataVerificationModal] Product received:', {
      hasNutriments: !!product.nutriments,
      hasNutrition: !!product.nutrition,
      nutrimentKeys: Object.keys(product.nutriments || {}),
      nutritionKeys: Object.keys(product.nutrition || {}),
      productKeys: Object.keys(product).filter(k => k.includes('nutri') || k.includes('energy') || k.includes('sugar') || k.includes('fat'))
    });
    
    // Extract ingredients text if it exists
    if (product.ingredients_text) {
      existingData.ingredients_text = product.ingredients_text;
    }
    
    // Extract nutrition data from multiple possible sources
    const nutriments = product.nutriments || product.nutrition || product.raw?.nutriments || {};
    
    // Map nutriment fields to form field names - check ALL possible key variations
    const nutrimentMapping = {
      // Energy variations
      'energy-kcal_100g': 'energy-kcal',
      'energy_kcal_100g': 'energy-kcal',
      'energy-kcal': 'energy-kcal',
      'energy_100g': 'energy-kcal',
      'energy': 'energy-kcal',
      'calories_100g': 'energy-kcal',
      'calories': 'energy-kcal',
      
      // Other nutrients
      'sugars_100g': 'sugars',
      'sugars': 'sugars',
      'fat_100g': 'fat',
      'fat': 'fat',
      'proteins_100g': 'proteins',
      'proteins': 'proteins',
      'protein_100g': 'proteins',
      'protein': 'proteins',
      'carbohydrates_100g': 'carbohydrates',
      'carbohydrates': 'carbohydrates',
      'fiber_100g': 'fiber',
      'fiber': 'fiber',
      'salt_100g': 'salt',
      'salt': 'salt',
      'sodium_100g': 'sodium',
      'sodium': 'sodium',
      'saturated-fat_100g': 'saturated-fat',
      'saturated_fat_100g': 'saturated-fat',
      'saturated-fat': 'saturated-fat',
    };
    
    Object.entries(nutrimentMapping).forEach(([nutrimentKey, formField]) => {
      if (nutriments[nutrimentKey] !== undefined && nutriments[nutrimentKey] !== null && !existingData[formField]) {
        const value = nutriments[nutrimentKey];
        // Convert to kcal if needed (from kJ)
        if (formField === 'energy-kcal' && nutrimentKey.includes('energy') && value > 1000) {
          existingData[formField] = String(Math.round(value / 4.184));
        } else {
          existingData[formField] = String(value);
        }
      }
    });
    
    // Extract meta fields
    if (product.brands) existingData.brands = product.brands;
    if (product.quantity) existingData.quantity = product.quantity;
    if (product.categories) existingData.categories = product.categories;
    if (product.image_url || product.image) existingData.image_url = product.image_url || product.image;
    
    console.log('[DataVerificationModal] Pre-filled data:', existingData);
    setEditedData(existingData);
  }, [product]);
  
  if (!product || !metadata) {
    return null;
  }
  
  const missingFields = metadata.missing_fields || [];
  const completenessScore = metadata.completeness_score || 0;
  const primarySource = metadata.primary_source || 'Unknown';
  
  // Debug logging
  console.log('[DataVerificationModal] Opened with:', {
    productName: product.product_name,
    missingFieldsCount: missingFields.length,
    missingFields: missingFields,
    completenessScore: completenessScore,
  });
  
  // Field labels and input types
  const fieldConfig = {
    // Critical fields
    'ingredients_text': { 
      label: 'Ingredients List', 
      type: 'text', 
      placeholder: 'e.g., Wheat flour, sugar, vegetable oil, salt, raising agent (500ii)...' 
    },
    
    // Important nutrition fields
    'energy-kcal': { label: 'Energy (kcal/100g)', type: 'number', placeholder: 'e.g., 456' },
    'sugars': { label: 'Sugars (g/100g)', type: 'number', placeholder: 'e.g., 25.5' },
    'fat': { label: 'Fat (g/100g)', type: 'number', placeholder: 'e.g., 11.2' },
    'brands': { label: 'Brand Name', type: 'text', placeholder: 'e.g., Parle' },
    
    // Optional fields (all per 100g since that's the standard)
    'proteins': { label: 'Protein (g/100g)', type: 'number', placeholder: 'e.g., 7.1' },
    'carbohydrates': { label: 'Carbs (g/100g)', type: 'number', placeholder: 'e.g., 75.6' },
    'fiber': { label: 'Fiber (g/100g)', type: 'number', placeholder: 'e.g., 2.3' },
    'salt': { label: 'Salt (g/100g)', type: 'number', placeholder: 'e.g., 0.5' },
    'sodium': { label: 'Sodium (mg/100g)', type: 'number', placeholder: 'e.g., 130' },
    'saturated-fat': { label: 'Saturated Fat (g/100g)', type: 'number', placeholder: 'e.g., 1.5' },
    'quantity': { label: 'Package Quantity', type: 'text', placeholder: 'e.g., 250g, 500ml' },
    'categories': { label: 'Categories', type: 'text', placeholder: 'e.g., Biscuits, Snacks' },
    'image_url': { label: 'Image URL', type: 'text', placeholder: 'https://...' },
  };
  
  const handleFieldChange = (fieldName, value) => {
    setEditedData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };
  
  const handleSkip = () => {
    // User accepts incomplete data
    Alert.alert(
      'Skip Verification',
      'Are you sure you want to use this incomplete data? You can always edit it later from the product details screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          style: 'default',
          onPress: () => {
            if (onSkip) {
              onSkip(product);
            }
          }
        }
      ]
    );
  };
  
  const handleComplete = () => {
    // Check if we have at least basic data (ingredients or some nutrition)
    const hasIngredients = editedData.ingredients_text && editedData.ingredients_text.trim().length > 0;
    const hasNutrition = Object.keys(editedData).some(key => 
      ['energy-kcal', 'sugars', 'fat', 'proteins', 'carbohydrates'].includes(key) &&
      editedData[key] && String(editedData[key]).trim() !== ''
    );
    
    if (!hasIngredients && !hasNutrition) {
      Alert.alert(
        'No Data to Verify',
        'Please provide at least the ingredients list or some nutrition information to continue.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }
    
    // Build nutriments object from edited nutrition fields
    const updatedNutriments = { ...(product.nutriments || {}) };
    const updatedMetaData = {};
    
    // Map user-entered fields to proper nutriment keys
    Object.entries(editedData).forEach(([fieldName, value]) => {
      const numValue = parseFloat(value);
      
      // Nutrition fields go into nutriments with _100g suffix
      if (fieldName === 'energy-kcal') {
        updatedNutriments['energy-kcal_100g'] = numValue;
        updatedNutriments['energy_kcal_100g'] = numValue;
      } else if (['sugars', 'fat', 'proteins', 'carbohydrates', 'fiber', 'salt', 'saturated-fat'].includes(fieldName)) {
        updatedNutriments[`${fieldName}_100g`] = numValue;
      } else if (fieldName === 'sodium') {
        // Store sodium in g/100g for scoring compatibility.
        updatedNutriments['sodium_100g'] = numValue / 1000;
      } 
      // Meta fields stay at root level
      else if (['brands', 'quantity', 'categories', 'image_url'].includes(fieldName)) {
        updatedMetaData[fieldName] = value;
      }
      // Ingredients special case
      else if (fieldName === 'ingredients_text') {
        updatedMetaData.ingredients_text = value;
        // Also create clean ingredients array from the text
        const cleanIngredients = value
          .split(/,|;/)
          .map(s => s.trim())
          .filter(s => s.length > 2) // Filter out very short strings
          .map(name => ({ name, category: '', riskLevel: 'LOW', description: '' }));
        updatedMetaData.ingredients = cleanIngredients;
      }
    });
    
    console.log('[DataVerificationModal] Saving verified data:', {
      editedData,
      updatedNutriments,
      updatedMetaData
    });
    
    // Merge edited data with product
    const updatedProduct = {
      ...product,
      ...updatedMetaData,
      nutriments: updatedNutriments,
      _verified: true,
      _verified_at: new Date().toISOString(),
      _verified_by: 'user',
      metadata: {
        ...metadata,
        completeness_score: 100, // User verified the product
        needs_verification: false,
        user_verified: true,
      }
    };
    
    if (onComplete) {
      onComplete(updatedProduct, editedData);
    }
  };
  
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };
  
  const getCompletenessColor = (score) => {
    if (score >= 90) return COLORS.lowRisk;
    if (score >= 70) return COLORS.warning;
    return COLORS.highRisk;
  };
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <MaterialIcons name="info-outline" size={24} color={COLORS.primary} />
              <Text style={styles.headerTitle}>Verify Product Data</Text>
            </View>
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          
          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
            {/* Product Info */}
            <View style={styles.productInfo}>
              <Text style={styles.productName}>
                {product.product_name || product.name || product.analysis?.Product || 'Unknown Product'}
              </Text>
              {product.brands && (
                <Text style={styles.productBrands}>{product.brands}</Text>
              )}
            </View>
            
            {/* Verification Reason */}
            {metadata?.verification_reason && (
              <View style={styles.verificationReason}>
                <MaterialIcons 
                  name={metadata.is_corrupted ? "error-outline" : "verified-user"} 
                  size={18} 
                  color={metadata.is_corrupted ? COLORS.highRisk : COLORS.warning} 
                />
                <Text style={styles.verificationReasonText}>
                  {metadata.verification_reason}
                </Text>
              </View>
            )}
            
            {/* Data Quality Summary - Compact */}
            <View style={styles.qualitySummary}>
              <MaterialIcons name="verified-user" size={18} color={COLORS.primary} />
              <Text style={styles.qualitySummaryText}>
                Verification Required • {metadata.verified_count || 0}/3 user verifications
              </Text>
            </View>
            
            {/* Data Source & Completeness Info */}
            <View style={styles.dataSourceCard}>
              <View style={styles.dataSourceRow}>
                <MaterialIcons name="cloud-download" size={18} color={COLORS.primary} />
                <Text style={styles.dataSourceLabel}>Source: </Text>
                <Text style={styles.dataSourceValue}>{primarySource}</Text>
              </View>
              <View style={styles.completenessRow}>
                <View style={styles.completenessBar}>
                  <View 
                    style={[
                      styles.completenessBarFill, 
                      { 
                        width: `${completenessScore}%`,
                        backgroundColor: getCompletenessColor(completenessScore)
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.completenessText, { color: getCompletenessColor(completenessScore) }]}>
                  {completenessScore}% complete
                </Text>
              </View>
              {missingFields.length > 0 && (
                <Text style={styles.missingFieldsNote}>
                  {missingFields.length} field{missingFields.length > 1 ? 's' : ''} missing
                </Text>
              )}
            </View>
            
            {/* Product Fields - Show All Important Fields */}
            <View style={styles.fieldsSection}>
              <Text style={styles.sectionTitle}>
                Review All Product Information
              </Text>
              <Text style={styles.sectionDescription}>
                Fields are pre-filled with auto-fetched data. Please verify accuracy from the package label and fill in missing fields.
              </Text>
              
              {/* Always show critical fields - ingredients and key nutrition */}
              {['ingredients_text', 'energy-kcal', 'sugars', 'fat', 'proteins', 'carbohydrates', 'salt', 'brands', 'quantity'].map((fieldName, index) => {
                const config = fieldConfig[fieldName] || {
                  label: fieldName,
                  type: 'text',
                  placeholder: 'Enter value...'
                };
                
                const isMultiline = fieldName === 'ingredients_text';
                const isMissing = missingFields.includes(fieldName);
                const hasValue = editedData[fieldName] && String(editedData[fieldName]).trim() !== '';
                
                return (
                  <View key={index} style={styles.fieldContainer}>
                    <View style={styles.fieldLabelRow}>
                      <Text style={styles.fieldLabel}>{config.label}</Text>
                      {isMissing && !hasValue && (
                        <Text style={styles.missingBadge}>Missing</Text>
                      )}
                    </View>
                    <TextInput
                      style={[
                        styles.fieldInput, 
                        isMultiline && styles.fieldInputMultiline,
                        hasValue && styles.fieldInputFilled
                      ]}
                      placeholder={config.placeholder}
                      placeholderTextColor={COLORS.textLight}
                      value={editedData[fieldName] || ''}
                      onChangeText={(value) => handleFieldChange(fieldName, value)}
                      keyboardType={config.type === 'number' ? 'decimal-pad' : 'default'}
                      autoCorrect={false}
                      multiline={isMultiline}
                      numberOfLines={isMultiline ? 4 : 1}
                      textAlignVertical={isMultiline ? 'top' : 'center'}
                    />
                  </View>
                );
              })}
            </View>
            
            {/* Help Text - Compact */}
            <View style={styles.helpCard}>
              <MaterialIcons name="lightbulb-outline" size={16} color={COLORS.primary} />
              <Text style={styles.helpText}>
                Your contributions help improve the database for everyone!
              </Text>
            </View>
          </ScrollView>
          
          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.skipButton]}
              onPress={handleSkip}
            >
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.completeButton]}
              onPress={handleComplete}
            >
              <MaterialIcons name="check" size={20} color={COLORS.white} />
              <Text style={styles.completeButtonText}>Complete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    height: '85%',
    ...SHADOWS.large,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  productInfo: {
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  productName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  productBrands: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  verificationReason: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: '#FFF3E0',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  verificationReasonText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  qualitySummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.backgroundLight,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  qualitySummaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  dataSourceCard: {
    backgroundColor: '#F3F4F6',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  dataSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  dataSourceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  dataSourceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  completenessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  completenessBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  completenessBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  completenessText: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 80,
    textAlign: 'right',
  },
  missingFieldsNote: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  fieldsSection: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  sectionDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  fieldContainer: {
    marginBottom: SPACING.md,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  missingBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.highRisk,
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  fieldInput: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
    minHeight: 48,
  },
  fieldInputFilled: {
    backgroundColor: '#E8F5E9',
    borderColor: COLORS.lowRisk,
  },
  fieldInputMultiline: {
    minHeight: 100,
    maxHeight: 150,
  },
  emptyFieldsContainer: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  emptyFieldsText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.backgroundLight,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.sm,
  },
  helpText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.md,
    minHeight: 52,
  },
  skipButton: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  completeButton: {
    backgroundColor: COLORS.primary,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
});

export default DataVerificationModal;
