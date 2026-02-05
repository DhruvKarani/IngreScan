import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';

const CategoryCard = ({ 
  title, 
  icon, 
  color = COLORS.primary, 
  onPress,
  style,
  description 
}) => {
  return (
    <TouchableOpacity 
      style={[styles.container, { backgroundColor: color }, style]} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {description && (
        <Text style={styles.description}>{description}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    ...SHADOWS.small,
  },
  iconContainer: {
    marginBottom: SPACING.sm,
  },
  icon: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textOnPrimary,
    textAlign: 'center',
  },
  description: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textOnPrimary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    opacity: 0.9,
  },
});

export default CategoryCard;