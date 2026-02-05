import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';
import { getFoodCategoryRiskGuide } from '../constants/foodCategoryRiskGuides';

const FoodCategoryRiskGuideScreen = ({ route, navigation }) => {
  const { categoryName } = route.params;
  const riskGuide = getFoodCategoryRiskGuide(categoryName);

  if (!riskGuide) {
    Alert.alert('Error', 'Risk guide not found');
    navigation.goBack();
    return null;
  }

  const handleScanPress = () => {
    // Navigate to ScanScreen with category context
    navigation.navigate('Scan', { category: categoryName });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{riskGuide.name}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Category Header */}
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryName}>{riskGuide.name}</Text>
          <Text style={styles.categorySubtitle}>Risk Awareness Guide</Text>
        </View>

        {/* Reality of This Category */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Reality of This Category</Text>
          <Text style={styles.sectionContent}>{riskGuide.realityCheck}</Text>
        </View>

        {/* Common Mistakes People Make */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Common Mistakes People Make</Text>
          {riskGuide.commonMistakes.map((mistake, index) => (
            <View key={index} style={styles.bulletPoint}>
              <MaterialIcons 
                name="error-outline" 
                size={16} 
                color={COLORS.warning} 
                style={styles.bulletIcon}
              />
              <Text style={styles.bulletText}>{mistake}</Text>
            </View>
          ))}
        </View>

        {/* Why Scans Often Show Warnings Here */}
        <View style={styles.card}>
          <View style={styles.warningHeader}>
            <MaterialIcons name="warning" size={20} color={COLORS.error} />
            <Text style={styles.sectionTitle}>Why Scans Often Show Warnings Here</Text>
          </View>
          <Text style={styles.sectionContent}>{riskGuide.whyScansWarn}</Text>
        </View>

        {/* Hidden Ingredients Common in This Category */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Hidden Ingredients Common in This Category</Text>
          {riskGuide.hiddenIngredients.map((ingredient, index) => (
            <View key={index} style={styles.ingredientItem}>
              <Text style={styles.ingredientName}>{ingredient.name}</Text>
              <Text style={styles.ingredientReason}>{ingredient.reason}</Text>
            </View>
          ))}
        </View>

        {/* How to Read Scan Results for This Category */}
        <View style={styles.card}>
          <View style={styles.interpretationHeader}>
            <MaterialIcons name="analytics" size={20} color={COLORS.info} />
            <Text style={styles.sectionTitle}>How to Read Scan Results for This Category</Text>
          </View>
          {riskGuide.interpretationTips.map((tip, index) => (
            <View key={index} style={styles.bulletPoint}>
              <MaterialIcons 
                name="info-outline" 
                size={16} 
                color={COLORS.info} 
                style={styles.bulletIcon}
              />
              <Text style={styles.bulletText}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* Smart User Advice */}
        <View style={styles.card}>
          <View style={styles.adviceHeader}>
            <MaterialIcons name="tips-and-updates" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Smart User Advice</Text>
          </View>
          {riskGuide.smartAdvice.map((advice, index) => (
            <View key={index} style={styles.adviceItem}>
              <Text style={styles.adviceNumber}>{index + 1}</Text>
              <Text style={styles.adviceText}>{advice}</Text>
            </View>
          ))}
        </View>

        {/* Scan Button */}
        <TouchableOpacity 
          style={styles.scanButton}
          onPress={handleScanPress}
          activeOpacity={0.8}
        >
          <MaterialIcons name="qr-code-scanner" size={24} color="#fff" />
          <Text style={styles.scanButtonText}>
            Scan products from this category
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacing} />
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 34, // Same width as back button for centering
  },
  content: {
    flex: 1,
    padding: 20,
  },
  categoryHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  categoryName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  categorySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  sectionContent: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  bulletPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bulletIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  bulletText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  ingredientItem: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  ingredientReason: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  interpretationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  adviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  adviceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  adviceNumber: {
    backgroundColor: COLORS.primary,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 20,
    marginRight: 12,
  },
  adviceText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  bottomSpacing: {
    height: 20,
  },
});

export default FoodCategoryRiskGuideScreen;