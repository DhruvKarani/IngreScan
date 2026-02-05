import React, { useState } from 'react';
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
import { getNutritionGoalById } from '../constants/nutritionGoals';

const NutritionGoalDetailScreen = ({ route, navigation }) => {
  const { goalId } = route.params;
  const goalData = getNutritionGoalById(goalId);

  if (!goalData) {
    Alert.alert('Error', 'Nutrition goal not found');
    navigation.goBack();
    return null;
  }

  const handleScanPress = () => {
    // Navigate to ScanScreen
    navigation.navigate('ScanScreen');
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
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerIcon}>{goalData.icon}</Text>
          <Text style={styles.headerTitle}>{goalData.name}</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Overview Card */}
        <View style={[styles.card, { borderLeftColor: goalData.color }]}>
          <Text style={styles.sectionTitle}>What does this mean?</Text>
          <Text style={styles.description}>{goalData.whatItMeans}</Text>
        </View>

        {/* How IngreScan Evaluates */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>How IngreScan evaluates this</Text>
          {goalData.howIngreScanEvaluates.map((point, index) => (
            <View key={index} style={styles.evaluationPoint}>
              <MaterialIcons 
                name="check-circle" 
                size={16} 
                color={goalData.color} 
                style={styles.checkIcon}
              />
              <Text style={styles.evaluationText}>{point}</Text>
            </View>
          ))}
        </View>

        {/* Ingredients to Watch */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Key ingredients to watch</Text>
          {goalData.ingredientsToWatch.map((ingredient, index) => (
            <View key={index} style={styles.ingredientItem}>
              <View style={styles.ingredientHeader}>
                <Text style={[styles.ingredientName, { color: goalData.color }]}>
                  {ingredient.name}
                </Text>
              </View>
              <Text style={styles.ingredientNote}>{ingredient.note}</Text>
            </View>
          ))}
        </View>

        {/* Expert Tips */}
        <View style={styles.card}>
          <View style={styles.expertTipsHeader}>
            <MaterialIcons name="lightbulb" size={20} color={goalData.color} />
            <Text style={styles.sectionTitle}>Expert tips</Text>
          </View>
          {goalData.expertTips.map((tip, index) => (
            <View key={index} style={styles.tipItem}>
              <Text style={styles.tipNumber}>{index + 1}</Text>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* Scan Button */}
        <TouchableOpacity 
          style={[styles.scanButton, { backgroundColor: goalData.color }]}
          onPress={handleScanPress}
          activeOpacity={0.8}
        >
          <MaterialIcons name="qr-code-scanner" size={24} color="#fff" />
          <Text style={styles.scanButtonText}>
            Scan products for {goalData.name.toLowerCase()} analysis
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
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  headerIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  placeholder: {
    width: 34, // Same width as back button for centering
  },
  content: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.border,
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
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  evaluationPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  checkIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  evaluationText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  ingredientItem: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  ingredientHeader: {
    marginBottom: 4,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: '600',
  },
  ingredientNote: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  expertTipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tipNumber: {
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
  tipText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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

export default NutritionGoalDetailScreen;