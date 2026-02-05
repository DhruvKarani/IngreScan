import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Collapsible from 'react-native-collapsible';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';

// Import label guide data with fallback
let labelGuideData;
try {
  labelGuideData = require('../data/education/label_guide.json');
} catch (error) {
  console.warn('Label guide data not found, using fallback');
  labelGuideData = {
    label_reading_guide: [],
    myths_vs_facts: []
  };
}

const LabelGuideScreen = ({ navigation }) => {
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const renderMythFact = (myth, index) => (
    <View key={index} style={styles.mythFactCard}>
      <View style={styles.mythSection}>
        <MaterialIcons name="close" size={20} color={COLORS.error} />
        <Text style={styles.mythTitle}>Myth</Text>
      </View>
      <Text style={styles.mythText}>{myth.myth}</Text>
      
      <View style={styles.factSection}>
        <MaterialIcons name="check" size={20} color={COLORS.success} />
        <Text style={styles.factTitle}>Fact</Text>
      </View>
      <Text style={styles.factText}>{myth.fact}</Text>
      
      {myth.explanation && (
        <Text style={styles.explanationText}>{myth.explanation}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Food Label Guide</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Introduction */}
        <View style={styles.introSection}>
          <Text style={styles.introTitle}>🏷️ Learn to Read Food Labels</Text>
          <Text style={styles.introText}>
            Understanding food labels helps you make informed choices about what you eat. 
            This guide will teach you how to decode ingredient lists, nutrition facts, and marketing claims.
          </Text>
        </View>

        {/* Label Reading Guide */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Label Reading Basics</Text>
          {labelGuideData && labelGuideData.label_reading_guide && labelGuideData.label_reading_guide.length > 0 ? (
            labelGuideData.label_reading_guide.map((guide) => (
              <View key={guide.id} style={styles.guideCard}>
                <TouchableOpacity
                  style={styles.guideHeader}
                  onPress={() => toggleSection(`guide-${guide.id}`)}
                  activeOpacity={0.8}
                >
                  <View style={styles.guideHeaderLeft}>
                    <Text style={styles.guideIcon}>{guide.icon}</Text>
                    <Text style={styles.guideTitle}>{guide.title}</Text>
                  </View>
                  <MaterialIcons
                    name={expandedSections[`guide-${guide.id}`] ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                    size={24}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
                
                <Collapsible collapsed={!expandedSections[`guide-${guide.id}`]}>
                  <View style={styles.guideContent}>
                    <Text style={styles.guideContentText}>{guide.content}</Text>
                    <View style={styles.tipContainer}>
                      <MaterialIcons name="lightbulb" size={16} color={COLORS.secondary} />
                      <Text style={styles.tipText}>{guide.tip}</Text>
                    </View>
                  </View>
                </Collapsible>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>Label reading guide content not available</Text>
          )}
        </View>

        {/* Myths vs Facts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔍 Food Myths vs Facts</Text>
          {labelGuideData && labelGuideData.myths_vs_facts && labelGuideData.myths_vs_facts.length > 0 ? (
            labelGuideData.myths_vs_facts.map((myth, index) => renderMythFact(myth, index))
          ) : (
            <Text style={styles.noDataText}>Myths vs facts content not available</Text>
          )}
        </View>

        {/* Quick Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 Quick Tips</Text>
          <View style={styles.tipsContainer}>
            <View style={styles.tipCard}>
              <Text style={styles.tipIcon}>⏱️</Text>
              <Text style={styles.tipCardText}>
                Spend 30 seconds reading labels - it becomes a habit quickly!
              </Text>
            </View>
            <View style={styles.tipCard}>
              <Text style={styles.tipIcon}>🔢</Text>
              <Text style={styles.tipCardText}>
                Focus on the first 3-5 ingredients - they make up most of the product.
              </Text>
            </View>
            <View style={styles.tipCard}>
              <Text style={styles.tipIcon}>⚖️</Text>
              <Text style={styles.tipCardText}>
                Compare similar products to find the healthiest option.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  introSection: {
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    margin: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.small,
  },
  introTitle: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  introText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.base,
  },
  section: {
    margin: SPACING.lg,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  guideCard: {
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  guideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.backgroundLight,
  },
  guideHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  guideIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  guideTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
    flex: 1,
  },
  guideContent: {
    padding: SPACING.md,
  },
  guideContentText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.base,
    marginBottom: SPACING.md,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.backgroundLight,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.secondary,
  },
  tipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
    marginLeft: SPACING.sm,
    flex: 1,
    lineHeight: TYPOGRAPHY.lineHeight.normal * TYPOGRAPHY.fontSize.sm,
  },
  mythFactCard: {
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    ...SHADOWS.small,
  },
  mythSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  mythTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.error,
    marginLeft: SPACING.xs,
  },
  mythText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    fontStyle: 'italic',
  },
  factSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  factTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.success,
    marginLeft: SPACING.xs,
  },
  factText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.sm,
  },
  explanationText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    backgroundColor: COLORS.backgroundLight,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  tipsContainer: {
    gap: SPACING.md,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.small,
  },
  tipIcon: {
    fontSize: 24,
    marginRight: SPACING.md,
  },
  tipCardText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text,
    flex: 1,
    lineHeight: TYPOGRAPHY.lineHeight.normal * TYPOGRAPHY.fontSize.base,
  },
  noDataText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    textAlign: 'center',
    padding: SPACING.lg,
    fontStyle: 'italic',
  },
  bottomSpacing: {
    height: SPACING.xl,
  },
});

export default LabelGuideScreen;