import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Collapsible from 'react-native-collapsible';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';
import { RISK_LEVELS } from '../constants/data';
import { analyzeIngredientsWithGemini } from '../utils/geminiApi';

// Helper function to format ingredient names and clean up brackets, etc.
const formatIngredientName = (name) => {
  if (!name) return 'Unknown Ingredient';
  
  let formatted = String(name).trim();
  
  // Remove trailing commas and periods
  formatted = formatted.replace(/[,.]$/, '');
  
  // Handle incomplete brackets (missing opening or closing)
  const openBrackets = (formatted.match(/\(/g) || []).length;
  const closeBrackets = (formatted.match(/\)/g) || []).length;
  
  if (openBrackets > closeBrackets) {
    // Missing closing bracket - add it
    formatted = formatted + ')';
  } else if (closeBrackets > openBrackets) {
    // Missing opening bracket - remove extra closing brackets
    formatted = formatted.replace(/\)+$/, '');
  }
  
  // Clean up common formatting issues
  formatted = formatted
    // Fix spaces around brackets
    .replace(/\s*\(\s*/g, ' (')
    .replace(/\s*\)\s*/g, ') ')
    // Remove double spaces
    .replace(/\s+/g, ' ')
    // Handle E-numbers properly
    .replace(/\b(e\s*)(\d{3}[a-z]?)/gi, 'E$2')
    // Capitalize first letter
    .replace(/^[a-z]/, c => c.toUpperCase())
    // Clean up asterisks and special characters
    .replace(/^\*+/, '')
    .replace(/\*+$/, '')
    // Trim again
    .trim();
  
  return formatted;
};

// Helper function to format ingredient descriptions
const formatDescription = (description, ingredientName) => {
  if (!description) return `${formatIngredientName(ingredientName)} is commonly used in food products.`;
  
  let formatted = String(description).trim();
  
  // Clean up common issues in descriptions
  formatted = formatted
    // Ensure proper sentence structure
    .replace(/^[a-z]/, c => c.toUpperCase())
    // Add period if missing
    .replace(/([^.!?])$/, '$1.')
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    // Fix common grammar issues
    .replace(/\ba\s+([aeiou])/gi, 'an $1')
    .trim();
  
  return formatted;
};

const IngredientCollapsible = ({ ingredients = [], rawIngredients = [], onIngredientPress }) => {
  const [collapsed, setCollapsed] = useState({});
  const [naturalIngredients, setNaturalIngredients] = useState([]);
  const [additiveIngredients, setAdditiveIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const analyzeIngredients = async () => {
      if (!rawIngredients || rawIngredients.length === 0) {
        const fallback = Array.isArray(ingredients) ? ingredients : [];
        setNaturalIngredients(fallback.filter(i => i.type !== 'additive'));
        setAdditiveIngredients(fallback.filter(i => i.type === 'additive'));
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const analysis = await analyzeIngredientsWithGemini(rawIngredients);
        setNaturalIngredients(analysis.ingredients || []);
        setAdditiveIngredients(analysis.additives || []);
        
        if (analysis.filteredOut && analysis.filteredOut.length > 0) {
          console.log('Non-food items filtered out:', analysis.filteredOut);
        }
      } catch (err) {
        console.error('Error analyzing ingredients:', err);
        setError('Could not analyze ingredients');
        const fallback = rawIngredients.map(name => ({
          name,
          description: `${name} is a food ingredient commonly used in food products.`,
          type: 'ingredient',  
          riskLevel: 'LOW',
          purpose: 'Food component'
        }));
        setNaturalIngredients(fallback);
        setAdditiveIngredients([]);
      } finally {
        setLoading(false);
      }
    };

    analyzeIngredients();
  }, [rawIngredients, ingredients]);

  const toggleCollapsed = (index) => {
    setCollapsed(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };
  const getRiskColor = (riskLevel) => {
    const level = String(riskLevel || 'LOW').toUpperCase();
    switch (level) {
      case 'LOW':
        return COLORS.lowRisk;
      case 'MEDIUM':
        return COLORS.mediumRisk;
      case 'HIGH':
        return COLORS.highRisk;
      default:
        return COLORS.lowRisk;
    }
  };

  const getIngredientIcon = (type, name) => {
    const lowerName = String(name || '').toLowerCase();
    const itemType = String(type || '').toLowerCase();
    
    if (itemType === 'additive') {
      if (lowerName.includes('color')) return '🎨';
      if (lowerName.includes('preservative')) return '🛡️';
      if (lowerName.includes('sweetener')) return '🍯';
      if (lowerName.includes('flavor')) return '👅';
      if (lowerName.includes('emulsifier')) return '🥄';
      if (lowerName.includes('stabilizer')) return '⚖️';
      return '🧪';
    }
    
    if (lowerName.includes('flour')) return '🌾';
    if (lowerName.includes('milk')) return '🥛';
    if (lowerName.includes('egg')) return '🥚';
    if (lowerName.includes('sugar')) return '🍯';
    if (lowerName.includes('oil')) return '🫒';
    if (lowerName.includes('salt')) return '🧂';
    if (lowerName.includes('water')) return '💧';
    
    return '🌿';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>🍃</Text>
          <Text style={styles.sectionTitle}>Analyzing Ingredients...</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Getting detailed ingredient information...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>🍃</Text>
          <Text style={styles.sectionTitle}>Ingredients</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  const renderIngredientSection = (items, title, icon, sectionIndex) => {
    if (!items || items.length === 0) return null;

    return (
      <View key={sectionIndex} style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>{icon}</Text>
          <Text style={styles.sectionTitle}>{title} ({items.length})</Text>
        </View>

        {items.map((item = {}, index) => (
          <View key={`${sectionIndex}-${index}`} style={styles.ingredientContainer}>
            <TouchableOpacity
              style={[
                styles.ingredientHeader,
                { borderLeftColor: getRiskColor(item.riskLevel) }
              ]}
              onPress={() => toggleCollapsed(`${sectionIndex}-${index}`)}
              activeOpacity={0.7}
            >
              <View style={styles.ingredientInfo}>
                <View style={styles.ingredientTitleRow}>
                  <Text style={styles.ingredientIcon}>
                    {getIngredientIcon(item.type, item.name)}
                  </Text>
                  <Text style={styles.ingredientName}>
                    {formatIngredientName(item.name)}
                  </Text>
                  {onIngredientPress && (
                    <TouchableOpacity 
                      style={styles.infoButton}
                      onPress={() => onIngredientPress(item.name)}
                    >
                      <MaterialIcons name="info" size={18} color={COLORS.primary} />
                    </TouchableOpacity>
                  )}
                  <MaterialIcons
                    name={collapsed[`${sectionIndex}-${index}`] ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                    size={24}
                    color={COLORS.textSecondary}
                  />
                </View>
                <View style={styles.riskContainer}>
                  <View 
                    style={[
                      styles.riskBadge, 
                      { backgroundColor: getRiskColor(item.riskLevel) }
                    ]}
                  >
                    <Text style={styles.riskText}>
                      {(() => {
                        const rl = String(item.riskLevel || 'LOW').toUpperCase();
                        return RISK_LEVELS[rl] || rl;
                      })()}
                    </Text>
                  </View>
                  {item.purpose && (
                    <Text style={styles.purposeText}>• {item.purpose}</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>

            <Collapsible collapsed={!collapsed[`${sectionIndex}-${index}`]}>
              <View style={styles.ingredientContent}>
                <Text style={styles.ingredientDescription}>
                  {formatDescription(item.description, item.name)}
                </Text>
              </View>
            </Collapsible>
          </View>
        ))}
      </View>
    );
  };

  if (naturalIngredients.length === 0 && additiveIngredients.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>🍃</Text>
          <Text style={styles.sectionTitle}>Ingredients</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No ingredient information available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderIngredientSection(naturalIngredients, 'Natural Ingredients', '🌿', 0)}
      {renderIngredientSection(additiveIngredients, 'Additives & Preservatives', '🧪', 1)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.small,
    marginVertical: SPACING.sm,
    overflow: 'hidden',
  },
  sectionContainer: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    paddingBottom: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    padding: SPACING.md,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.border,
    elevation: 1,
  },
  sectionIcon: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    marginRight: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  ingredientContainer: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    marginHorizontal: SPACING.xs,
    marginBottom: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.surface,
    ...SHADOWS.small,
  },
  ingredientHeader: {
    padding: SPACING.md,
    borderLeftWidth: 4,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  ingredientIcon: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginRight: SPACING.sm,
  },
  ingredientName: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text,
    lineHeight: TYPOGRAPHY.lineHeight.normal * TYPOGRAPHY.fontSize.base,
    flexWrap: 'wrap',
  },
  riskContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  riskBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.sm,
  },
  riskText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textOnPrimary,
  },
  purposeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  ingredientContent: {
    padding: SPACING.md,
    paddingTop: 0,
    backgroundColor: COLORS.backgroundLight,
  },
  ingredientDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.sm,
    textAlign: 'justify',
  },
  infoButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.xs,
    marginRight: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.backgroundLight,
  },
  loadingContainer: {
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  errorContainer: {
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.error,
    textAlign: 'center',
  },
  emptyContainer: {
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default IngredientCollapsible;
