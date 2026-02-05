import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../constants/theme';

const { width } = Dimensions.get('window');

const RewardPopup = ({ visible, onClose, points = 0, details = {} }) => {
  const translateY = useRef(new Animated.Value(60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 60, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const reasonLines = [];
  if (details.productPoints) reasonLines.push(`Product: ${details.productPoints} pts`);
  if (details.uniqueBonus) reasonLines.push(`Unique bonus: ${details.uniqueBonus} pts`);
  if (details.dailyBonus) reasonLines.push(`Daily bonus: ${details.dailyBonus} pts`);

  return (
    <Animated.View style={[styles.wrapper, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.card}>
        <View style={styles.row}>
          <MaterialIcons name="card-giftcard" size={28} color={COLORS.primary} />
          <View style={{ marginLeft: SPACING.sm, flex: 1 }}>
            <Text style={styles.title}>Points credited</Text>
            {(() => {
              // Ensure we display only a safe integer number (no symbols)
              const parsed = Number(points);
              const display = Number.isFinite(parsed) ? Math.round(parsed) : 0;
              return <Text style={styles.pointsText}>{display}</Text>;
            })()}
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="close" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {reasonLines.length > 0 && (
          <View style={{ marginTop: SPACING.sm }}>
            {reasonLines.map((r, i) => (
              <Text key={i} style={styles.reasonText}>• {r}</Text>
            ))}
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 36,
    zIndex: 1000,
    alignItems: 'center',
  },
  card: {
    width: width - 32,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    ...SHADOWS.medium,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: TYPOGRAPHY.fontSize.base, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text },
  pointsText: { fontSize: TYPOGRAPHY.fontSize['2xl'], fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.primary, marginTop: 2 },
  reasonText: { color: COLORS.textSecondary, marginTop: 6 },
});

export default RewardPopup;
