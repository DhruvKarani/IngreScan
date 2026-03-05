import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';

const ProductCard = ({ 
  product, 
  onPress,
  showDetails = true,
  style 
}) => {
  const getHealthScoreColor = (score) => {
    if (score >= 80) return COLORS.lowRisk;
    if (score >= 60) return COLORS.mediumRisk;
    return COLORS.highRisk;
  };

  const formatDate = (dateLike) => {
    if (!dateLike) return '';
    try {
      // Firestore Timestamps have a toDate() method
      let dateObj = dateLike;
      if (dateLike && typeof dateLike.toDate === 'function') {
        dateObj = dateLike.toDate();
      } else if (typeof dateLike === 'string') {
        dateObj = new Date(dateLike);
      } else if (typeof dateLike === 'number') {
        dateObj = new Date(dateLike);
      }
      if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return '';
      return dateObj.toLocaleDateString();
    } catch (e) {
      return '';
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.container, style]} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        {product.image ? (
          <Image source={{ uri: product.image }} style={styles.image} />
        ) : (
          <View style={styles.placeholderImage}>
            <MaterialIcons name="fastfood" size={32} color={COLORS.textLight} />
          </View>
        )}
      </View>
      
      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.productName} numberOfLines={2}>
              {product.product_name || product.name || product.title || 'Unnamed Product'}
            </Text>
            {product.brand && (
              <Text style={styles.brandName}>{product.brand}</Text>
            )}
          </View>
          
          {showDetails && product.healthScore && (
            <View style={styles.scoreContainer}>
              <View 
                style={[
                  styles.scoreBadge, 
                  { backgroundColor: getHealthScoreColor(product.healthScore) }
                ]}
              >
                <Text style={styles.scoreText}>{product.healthScore}</Text>
              </View>
            </View>
          )}
        </View>
        
        <View style={styles.detailsContainer}>
          {product.size && (
            <Text style={styles.productSize}>{product.size}</Text>
          )}
          
          {product.scannedAt && (
            <Text style={styles.scannedDate}>
              Scanned: {formatDate(product.scannedAt)}
            </Text>
          )}
        </View>
        
        {/* Verification Status Badge */}
        {product.needsVerification && (
          <View style={styles.verificationContainer}>
            <MaterialIcons 
              name={product.isCorrupted ? "error-outline" : "verified-user"} 
              size={14} 
              color={product.isCorrupted ? COLORS.highRisk : COLORS.warning} 
            />
            <Text style={styles.verificationText}>
              {product.isCorrupted 
                ? 'Data needs verification (corrupted)' 
                : `Needs verification (${product.verifiedCount || 0}/3)`
              }
            </Text>
          </View>
        )}
        
        {showDetails && product.personalizedWarnings && product.personalizedWarnings.length > 0 && (
          <View style={styles.warningsContainer}>
            <MaterialIcons name="warning" size={16} color={COLORS.warning} />
            <Text style={styles.warningText} numberOfLines={1}>
              {product.personalizedWarnings[0]}
            </Text>
          </View>
        )}
      </View>
      
      <MaterialIcons 
        name="chevron-right" 
        size={24} 
        color={COLORS.textSecondary} 
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginVertical: SPACING.xs,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  imageContainer: {
    marginRight: SPACING.md,
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: BORDER_RADIUS.sm,
  },
  placeholderImage: {
    width: 60,
    height: 60,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
  },
  titleContainer: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  productName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  brandName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    minWidth: 32,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textOnPrimary,
  },
  detailsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  productSize: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginRight: SPACING.md,
  },
  scannedDate: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textLight,
  },
  verificationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.xs,
  },
  verificationText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text,
    marginLeft: SPACING.xs,
    flex: 1,
    fontWeight: '500',
  },
  warningsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  warningText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.warning,
    marginLeft: SPACING.xs,
    flex: 1,
  },
  chevron: {
    marginLeft: SPACING.sm,
  },
});

export default ProductCard;