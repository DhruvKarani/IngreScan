import React from 'react';
import { View, Text, SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants/theme';

const ScanDetailsScreen = ({ route }) => {
  const { scan } = route.params || {};
  const analysis = scan && scan.analysis ? scan.analysis : null;
  const product = scan && scan.productSnapshot ? scan.productSnapshot : (route.params && route.params.product) || {};

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{product.product_name || product.name || 'Product Details'}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Analysis Summary</Text>
          <Text style={styles.sectionText}>{analysis && analysis.explanation ? analysis.explanation : 'No analysis available'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Score</Text>
          <Text style={styles.sectionText}>{analysis ? (analysis.score || analysis.Score || analysis.score10 || 'N/A') : 'N/A'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personalized Warnings</Text>
          {analysis && Array.isArray(analysis.personalizedWarnings) && analysis.personalizedWarnings.length > 0 ? (
            analysis.personalizedWarnings.map((w, i) => (
              <Text key={i} style={styles.warningItem}>• {w}</Text>
            ))
          ) : (
            <Text style={styles.sectionText}>No personalized warnings</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reasoning</Text>
          {analysis && analysis.reasons && Array.isArray(analysis.reasons) && analysis.reasons.length > 0 ? (
            analysis.reasons.map((r, i) => (
              <Text key={i} style={styles.reasonItem}>• {r}</Text>
            ))
          ) : (
            <Text style={styles.sectionText}>{analysis && analysis.reasoning ? String(analysis.reasoning) : 'No reasoning available'}</Text>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundLight },
  content: { padding: SPACING.lg },
  title: { fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text, marginBottom: SPACING.md },
  section: { marginBottom: SPACING.md },
  sectionTitle: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  sectionText: { fontSize: TYPOGRAPHY.fontSize.base, color: COLORS.text },
  warningItem: { fontSize: TYPOGRAPHY.fontSize.base, color: COLORS.error, marginBottom: SPACING.xs },
  reasonItem: { fontSize: TYPOGRAPHY.fontSize.base, color: COLORS.textSecondary, marginBottom: SPACING.xs },
});

export default ScanDetailsScreen;
