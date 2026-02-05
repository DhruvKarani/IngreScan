import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';
import { getAllNutritionGoals } from '../constants/nutritionGoals';

const NutritionGoalsOverviewScreen = ({ navigation }) => {
  const nutritionGoals = getAllNutritionGoals();

  const handleGoalPress = (goalId) => {
    navigation.navigate('NutritionGoalDetail', { goalId });
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBackPress}
        >
          <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Healthy Choices by Experts</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Subtitle */}
      <View style={styles.subtitleContainer}>
        <Text style={styles.subtitle}>
          Discover expert-backed nutrition goals to make healthier food choices
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {nutritionGoals.map((goal) => (
          <TouchableOpacity
            key={goal.id}
            style={[styles.goalCard, { borderLeftColor: goal.color }]}
            onPress={() => handleGoalPress(goal.id)}
            activeOpacity={0.8}
          >
            <View style={styles.goalHeader}>
              <View style={styles.goalIconContainer}>
                <Text style={styles.goalIcon}>{goal.icon}</Text>
              </View>
              <View style={styles.goalInfo}>
                <Text style={styles.goalName}>{goal.name}</Text>
                <Text style={styles.goalDescription}>{goal.shortDescription}</Text>
              </View>
              <MaterialIcons 
                name="chevron-right" 
                size={24} 
                color={COLORS.textSecondary}
              />
            </View>
            
            <Text style={styles.goalExplanation}>{goal.expertExplanation}</Text>
            
            <View style={styles.goalFooter}>
              <View style={[styles.learnMoreButton, { backgroundColor: goal.color + '15' }]}>
                <Text style={[styles.learnMoreText, { color: goal.color }]}>
                  Learn More
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {/* Bottom spacing for scroll */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Scan Call to Action */}
      <View style={styles.scanCTA}>
        <TouchableOpacity 
          style={styles.scanButton}
          onPress={() => navigation.navigate('ScanScreen')}
          activeOpacity={0.8}
        >
          <MaterialIcons name="qr-code-scanner" size={24} color="#fff" />
          <Text style={styles.scanButtonText}>Start scanning products</Text>
        </TouchableOpacity>
      </View>
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
  subtitleContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.surface,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  goalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  goalIcon: {
    fontSize: 24,
  },
  goalInfo: {
    flex: 1,
  },
  goalName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  goalDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  goalExplanation: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  goalFooter: {
    alignItems: 'flex-start',
  },
  learnMoreButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  learnMoreText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scanCTA: {
    padding: 20,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
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

export default NutritionGoalsOverviewScreen;