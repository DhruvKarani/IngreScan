import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';
import { educationManager } from '../utils/educationManager';

// Import education data
let educationData;
try {
  educationData = require('../data/education/did_you_know.json');
} catch (error) {
  console.warn('Education data not found:', error.message);
  educationData = { flashcards: [] };
}

const DailyNutritionTipsScreen = ({ navigation }) => {
  const [dailyTips, setDailyTips] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    initializeAndLoad();
  }, []);

  const initializeAndLoad = async () => {
    try {
      // Initialize education manager if not already done
      await educationManager.initialize(educationData);
      loadDailyTips();
    } catch (error) {
      console.error('Error initializing education manager:', error);
    }
  };

  const loadDailyTips = () => {
    try {
      // Get a diverse set of tips from different categories
      const freshTips = educationManager.getFreshFacts(6);
      setDailyTips(freshTips);
    } catch (error) {
      console.error('Error loading daily tips:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await initializeAndLoad();
    setIsRefreshing(false);
  };

  const getCategoryIcon = (category) => {
    const iconMap = {
      'label_reading': 'label',
      'ingredients': 'science',
      'additives': 'warning',
      'processing': 'factory',
      'healthy_choices': 'favorite',
      'nutrients': 'local-pharmacy',
      'food_safety': 'security',
      'cooking': 'restaurant',
      'sustainability': 'eco',
      'myths_facts': 'fact-check'
    };
    return iconMap[category] || 'lightbulb';
  };

  const getCategoryColor = (category) => {
    const colorMap = {
      'label_reading': COLORS.primary,
      'ingredients': COLORS.info,
      'additives': COLORS.warning,
      'processing': COLORS.error,
      'healthy_choices': '#FF6B6B',
      'nutrients': '#4ECDC4',
      'food_safety': '#45B7D1',
      'cooking': '#9C27B0',
      'sustainability': '#FF9800',
      'myths_facts': COLORS.success
    };
    return colorMap[category] || COLORS.primary;
  };

  const formatCategoryName = (category) => {
    return category.replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const renderTip = (tip, index) => (
    <View key={index} style={styles.tipCard}>
      <View style={styles.tipHeader}>
        <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(tip.category) + '20' }]}>
          <MaterialIcons 
            name={getCategoryIcon(tip.category)} 
            size={16} 
            color={getCategoryColor(tip.category)} 
          />
          <Text style={[styles.categoryText, { color: getCategoryColor(tip.category) }]}>
            {formatCategoryName(tip.category)}
          </Text>
        </View>
        <Text style={styles.tipNumber}>Tip #{index + 1}</Text>
      </View>
      
      <Text style={styles.tipTitle}>{tip.front}</Text>
      <Text style={styles.tipContent}>{tip.back}</Text>
      
      {tip.icon && (
        <View style={styles.tipFooter}>
          <Text style={styles.tipIcon}>{tip.icon}</Text>
        </View>
      )}
    </View>
  );

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
        <Text style={styles.headerTitle}>Daily Nutrition Tips</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={isRefreshing}
        >
          <MaterialIcons name="refresh" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Subtitle */}
      <View style={styles.subtitleContainer}>
        <Text style={styles.subtitle}>
          Fresh nutrition tips to improve your food awareness
        </Text>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {dailyTips.length > 0 ? (
          <>
            <View style={styles.todayHeader}>
              <MaterialIcons name="today" size={20} color={COLORS.primary} />
              <Text style={styles.todayText}>
                Today's Tips • {new Date().toLocaleDateString()}
              </Text>
            </View>
            
            {dailyTips.map((tip, index) => renderTip(tip, index))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons name="tips-and-updates" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Loading today's tips...</Text>
          </View>
        )}

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
  refreshButton: {
    padding: 5,
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
  todayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
  },
  todayText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 8,
  },
  tipCard: {
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
  tipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flex: 1,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  tipNumber: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
    lineHeight: 22,
  },
  tipContent: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  tipFooter: {
    alignItems: 'flex-end',
    marginTop: 12,
  },
  tipIcon: {
    fontSize: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  bottomSpacing: {
    height: 20,
  },
});

export default DailyNutritionTipsScreen;