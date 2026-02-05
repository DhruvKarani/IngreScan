import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';

const NutritionalTable = ({ nutrition = {}, showPerUnit = '100g' }) => {
  // Comprehensive nutrient mapping with proper units and labels
  const KNOWN = {
    // Energy
    energy_kcal_100g: { label: 'Energy', unit: 'kcal', category: 'energy' },
    energy_100g: { label: 'Energy', unit: 'kcal', category: 'energy' },
    energy_kj_100g: { label: 'Energy', unit: 'kJ', category: 'energy' },
    calories: { label: 'Calories', unit: 'kcal', category: 'energy' },
    energy: { label: 'Energy', unit: 'kcal', category: 'energy' },
    
    // Macronutrients
    proteins_100g: { label: 'Protein', unit: 'g', category: 'macro' },
    protein: { label: 'Protein', unit: 'g', category: 'macro' },
    proteins: { label: 'Protein', unit: 'g', category: 'macro' },
    carbohydrates_100g: { label: 'Carbohydrates', unit: 'g', category: 'macro' },
    carbohydrates: { label: 'Carbohydrates', unit: 'g', category: 'macro' },
    carbs: { label: 'Carbohydrates', unit: 'g', category: 'macro' },
    fat_100g: { label: 'Total Fat', unit: 'g', category: 'macro' },
    fat: { label: 'Total Fat', unit: 'g', category: 'macro' },
    
    // Sugars and Fiber
    sugars_100g: { label: 'Sugars', unit: 'g', category: 'carb' },
    sugars: { label: 'Sugars', unit: 'g', category: 'carb' },
    sugar: { label: 'Sugars', unit: 'g', category: 'carb' },
    fiber_100g: { label: 'Dietary Fiber', unit: 'g', category: 'carb' },
    fiber: { label: 'Dietary Fiber', unit: 'g', category: 'carb' },
    
    // Fats
    'saturated-fat_100g': { label: 'Saturated Fat', unit: 'g', category: 'fat' },
    saturated_fat_100g: { label: 'Saturated Fat', unit: 'g', category: 'fat' },
    'trans-fat_100g': { label: 'Trans Fat', unit: 'g', category: 'fat' },
    trans_fat_100g: { label: 'Trans Fat', unit: 'g', category: 'fat' },
    'monounsaturated-fat_100g': { label: 'Monounsaturated Fat', unit: 'g', category: 'fat' },
    'polyunsaturated-fat_100g': { label: 'Polyunsaturated Fat', unit: 'g', category: 'fat' },
    
    // Minerals
    salt_100g: { label: 'Salt', unit: 'g', category: 'mineral' },
    salt: { label: 'Salt', unit: 'g', category: 'mineral' },
    sodium_100g: { label: 'Sodium', unit: 'mg', category: 'mineral' },
    sodium: { label: 'Sodium', unit: 'mg', category: 'mineral' },
    potassium_100g: { label: 'Potassium', unit: 'mg', category: 'mineral' },
    potassium: { label: 'Potassium', unit: 'mg', category: 'mineral' },
    calcium_100g: { label: 'Calcium', unit: 'mg', category: 'mineral' },
    calcium: { label: 'Calcium', unit: 'mg', category: 'mineral' },
    magnesium_100g: { label: 'Magnesium', unit: 'mg', category: 'mineral' },
    magnesium: { label: 'Magnesium', unit: 'mg', category: 'mineral' },
    iron_100g: { label: 'Iron', unit: 'mg', category: 'mineral' },
    iron: { label: 'Iron', unit: 'mg', category: 'mineral' },
    zinc_100g: { label: 'Zinc', unit: 'mg', category: 'mineral' },
    zinc: { label: 'Zinc', unit: 'mg', category: 'mineral' },
    phosphorus_100g: { label: 'Phosphorus', unit: 'mg', category: 'mineral' },
    phosphorus: { label: 'Phosphorus', unit: 'mg', category: 'mineral' },
    
    // Vitamins
    vitamin_c_100g: { label: 'Vitamin C', unit: 'mg', category: 'vitamin' },
    vitamin_c: { label: 'Vitamin C', unit: 'mg', category: 'vitamin' },
    vitamin_a_100g: { label: 'Vitamin A', unit: 'µg', category: 'vitamin' },
    vitamin_a: { label: 'Vitamin A', unit: 'µg', category: 'vitamin' },
    vitamin_d_100g: { label: 'Vitamin D', unit: 'µg', category: 'vitamin' },
    vitamin_d: { label: 'Vitamin D', unit: 'µg', category: 'vitamin' },
    vitamin_e_100g: { label: 'Vitamin E', unit: 'mg', category: 'vitamin' },
    vitamin_e: { label: 'Vitamin E', unit: 'mg', category: 'vitamin' },
    vitamin_k_100g: { label: 'Vitamin K', unit: 'µg', category: 'vitamin' },
    vitamin_k: { label: 'Vitamin K', unit: 'µg', category: 'vitamin' },
    vitamin_b1_100g: { label: 'Thiamine (B1)', unit: 'mg', category: 'vitamin' },
    vitamin_b2_100g: { label: 'Riboflavin (B2)', unit: 'mg', category: 'vitamin' },
    vitamin_b6_100g: { label: 'Vitamin B6', unit: 'mg', category: 'vitamin' },
    vitamin_b12_100g: { label: 'Vitamin B12', unit: 'µg', category: 'vitamin' },
    folate_100g: { label: 'Folate', unit: 'µg', category: 'vitamin' },
    niacin_100g: { label: 'Niacin (B3)', unit: 'mg', category: 'vitamin' },
    
    // Other
    cholesterol_100g: { label: 'Cholesterol', unit: 'mg', category: 'other' },
    cholesterol: { label: 'Cholesterol', unit: 'mg', category: 'other' },
    alcohol_100g: { label: 'Alcohol', unit: 'g', category: 'other' },
    alcohol: { label: 'Alcohol', unit: 'g', category: 'other' },
    caffeine_100g: { label: 'Caffeine', unit: 'mg', category: 'other' },
    caffeine: { label: 'Caffeine', unit: 'mg', category: 'other' },
    
    // Additional common variations
    total_fat: { label: 'Total Fat', unit: 'g', category: 'macro' },
    total_carbs: { label: 'Total Carbohydrates', unit: 'g', category: 'macro' },
    total_protein: { label: 'Protein', unit: 'g', category: 'macro' },
    dietary_fiber: { label: 'Dietary Fiber', unit: 'g', category: 'carb' },
    total_sugars: { label: 'Total Sugars', unit: 'g', category: 'carb' },
    added_sugars: { label: 'Added Sugars', unit: 'g', category: 'carb' },
  };

  // Normalize nutrition into entries
  const entries = Object.entries(nutrition || {}).filter(([k, v]) => v !== undefined && v !== null && v !== '');

  // Use a preferred order for common keys
  const preferredOrder = [
    'calories', 'energy_kcal_100g', 'energy_100g',
    'protein', 'proteins', 'proteins_100g',
    'fat', 'fat_100g', 'saturated-fat_100g', 'saturated_fat_100g',
    'carbs', 'carbohydrates', 'carbohydrates_100g',
    'sugars', 'sugars_100g', 'salt', 'salt_100g', 'sodium', 'sodium_100g',
  ];

  const byKey = {};
  entries.forEach(([k, v]) => { byKey[k] = v; });

  const ordered = [];
  preferredOrder.forEach((k) => { if (k in byKey) { ordered.push([k, byKey[k]]); delete byKey[k]; } });
  // remaining keys alphabetically
  const rest = Object.keys(byKey).sort();
  rest.forEach(k => ordered.push([k, byKey[k]]));

  const nutritionItems = ordered.map(([key, rawValue]) => {
    const lower = key.toLowerCase();
    const known = KNOWN[lower] || KNOWN[key];
    const label = known ? known.label : key.replace(/[_\-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    // Assign unit with fallback logic
    let unit = known ? known.unit : '';
    if (!unit) {
      // Smart fallback unit assignment based on key patterns
      if (/energy|calorie|kcal/i.test(key)) unit = 'kcal';
      else if (/kj/i.test(key)) unit = 'kJ';
      else if (/protein|fat|carb|sugar|fiber|salt|alcohol/i.test(key)) unit = 'g';
      else if (/sodium|potassium|calcium|magnesium|iron|zinc|phosphorus|vitamin_c|vitamin_e|caffeine|cholesterol/i.test(key)) unit = 'mg';
      else if (/vitamin_a|vitamin_d|vitamin_k|vitamin_b12|folate/i.test(key)) unit = 'µg';
      else if (/vitamin_b|thiamine|riboflavin|niacin/i.test(key)) unit = 'mg';
      else unit = 'g'; // default fallback
    }
    
    const valueNum = typeof rawValue === 'number' ? rawValue : (rawValue && !Number.isNaN(Number(rawValue)) ? Number(rawValue) : rawValue);
    // format numeric to max 2 decimals
    const value = typeof valueNum === 'number' ? (Math.round(valueNum * 100) / 100) : String(rawValue);
    
    // Debug logging to check unit mapping
    if (!known) {
      console.log(`Unknown nutrient key: ${key}, using fallback label: ${label}`);
    }
    
    return { key, label, value, unit };
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nutritional Information</Text>
      </View>

      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderText}>Nutrients</Text>
          <Text style={styles.tableHeaderText}>Per {showPerUnit}</Text>
        </View>

        <ScrollView style={styles.tableBody}>
          {nutritionItems.map((item, index) => (
            <View
              key={item.key}
              style={[
                styles.tableRow,
                index % 2 === 0 && styles.tableRowEven,
                index === nutritionItems.length - 1 && styles.tableRowLast
              ]}
            >
              <Text style={styles.nutrientName}>{item.label}</Text>
              <View style={styles.valueContainer}>
                <Text style={styles.nutrientValue}>{item.value}</Text>
                {item.unit ? <Text style={styles.nutrientUnit}> {item.unit}</Text> : null}
              </View>
            </View>
          ))}
        </ScrollView>

        <Text style={styles.disclaimer}>*Approximate values</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.small,
    marginVertical: SPACING.sm,
  },
  header: {
    backgroundColor: COLORS.backgroundSecondary,
    padding: SPACING.md,
    borderTopLeftRadius: BORDER_RADIUS.md,
    borderTopRightRadius: BORDER_RADIUS.md,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    textAlign: 'center',
  },
  tableContainer: {
    padding: SPACING.md,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  tableHeaderText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  tableBody: {
    maxHeight: 300,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  tableRowEven: {
    backgroundColor: COLORS.backgroundLight,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  nutrientName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text,
    flex: 1,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
  },
  nutrientValue: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  nutrientUnit: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  disclaimer: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
});

export default NutritionalTable;