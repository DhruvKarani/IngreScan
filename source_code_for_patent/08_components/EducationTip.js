import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';

const EducationTip = ({ tip, style }) => {
  const [expanded, setExpanded] = useState(false);

  // Format category for display
  const formatCategory = (category) => {
    if (!category) return 'Did You Know?';
    return category
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  // Get category color
  const getCategoryColor = (category) => {
    const colors = {
      'label_reading': COLORS.info,
      'ingredients': COLORS.success,
      'additives': COLORS.warning,
      'processing': COLORS.secondary,
      'healthy_choices': COLORS.primary,
      'nutrients': COLORS.error,
      'default': COLORS.primary
    };
    return colors[category] || colors.default;
  };

  const categoryColor = getCategoryColor(tip.category);

  return (
    <TouchableOpacity 
      style={[styles.container, style]} 
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.8}
    >
      <View style={[styles.card, expanded && styles.expandedCard, { borderLeftColor: categoryColor }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{tip.icon || '💡'}</Text>
          </View>
          <View style={styles.headerContent}>
            <View style={[styles.categoryBadge, { backgroundColor: `${categoryColor}15` }]}>
              <Text style={[styles.category, { color: categoryColor }]}>
                {formatCategory(tip.category)}
              </Text>
            </View>
            <Text style={styles.question} numberOfLines={expanded ? 0 : 2}>
              {tip.front || 'Loading question...'}
            </Text>
          </View>
          <View style={styles.expandIcon}>
            <MaterialIcons 
              name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
              size={24} 
              color={categoryColor} 
            />
          </View>
        </View>

        {/* Expandable Answer */}
        {expanded && (
          <View style={styles.answerContainer}>
            <View style={styles.divider} />
            <View style={styles.answerContent}>
              <MaterialIcons name="lightbulb" size={20} color={categoryColor} />
              <Text style={styles.answer}>{tip.back || 'Loading answer...'}</Text>
            </View>
          </View>
        )}

        {/* Tap hint */}
        <View style={styles.tapHint}>
          <Text style={styles.tapText}>
            {expanded ? 'Tap to collapse' : 'Tap to learn more'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginRight: SPACING.md,
    width: 300,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.primary,
    ...SHADOWS.small,
    minHeight: 130,
  },
  expandedCard: {
    ...SHADOWS.medium,
    borderLeftWidth: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: SPACING.sm,
  },
  icon: {
    fontSize: 24,
  },
  headerContent: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs / 2,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.sm,
  },
  category: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    letterSpacing: 0.5,
  },
  question: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    lineHeight: TYPOGRAPHY.lineHeight.tight * TYPOGRAPHY.fontSize.lg,
  },
  expandIcon: {
    marginTop: SPACING.xs,
  },
  answerContainer: {
    marginTop: SPACING.sm,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: SPACING.sm,
  },
  answerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  answer: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.base,
    marginLeft: SPACING.sm,
    flex: 1,
    fontWeight: TYPOGRAPHY.fontWeight.normal,
  },
  tapHint: {
    marginTop: SPACING.md,
    alignItems: 'center',
    opacity: 0.7,
  },
  tapText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});

export default EducationTip;