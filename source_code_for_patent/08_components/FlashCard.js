import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';

const FlashCard = ({ frontText, backText, icon, onPress, style }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const fadeAnim = new Animated.Value(1);

  const handleFlip = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      // Change content when fade out completes
      setIsFlipped(!isFlipped);
      // Then fade back in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  return (
    <TouchableOpacity 
      style={[styles.container, style]} 
      onPress={handleFlip}
      activeOpacity={0.9}
    >
      <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
        {!isFlipped ? (
          <View style={[styles.gradient, { backgroundColor: COLORS.primary }]}>
            <View style={styles.content}>
              <Text style={styles.icon}>{icon || '📱'}</Text>
              <Text style={styles.text}>{frontText || 'Loading...'}</Text>
              <View style={styles.tapHint}>
                <MaterialIcons name="touch-app" size={16} color={COLORS.textOnPrimary} />
                <Text style={styles.tapText}>Tap to flip</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.gradient, { backgroundColor: COLORS.secondary }]}>
            <View style={styles.content}>
              <MaterialIcons name="lightbulb" size={24} color={COLORS.textOnPrimary} />
              <Text style={styles.answerText}>{backText || 'No explanation available'}</Text>
              <View style={styles.tapHint}>
                <MaterialIcons name="touch-app" size={16} color={COLORS.textOnPrimary} />
                <Text style={styles.tapText}>Tap again</Text>
              </View>
            </View>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 280,
    height: 160,
    marginRight: SPACING.md,
  },
  card: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.medium,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  icon: {
    fontSize: 32,
    marginBottom: SPACING.sm,
  },
  text: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textOnPrimary,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.lineHeight.normal * TYPOGRAPHY.fontSize.lg,
    marginBottom: SPACING.sm,
  },
  answerText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textOnPrimary,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.base,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.8,
  },
  tapText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textOnPrimary,
    marginLeft: 4,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});

export default FlashCard;