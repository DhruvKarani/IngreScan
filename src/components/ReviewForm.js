import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';

const ReviewForm = ({ initialRating = 5, initialText = '', onSubmit, submitting }) => {
  const [rating, setRating] = useState(initialRating);
  const [text, setText] = useState(initialText);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Your rating</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
          <TouchableOpacity key={i} onPress={() => setRating(i)} style={{ padding: 2 }}>
            <MaterialIcons name={i <= rating ? 'star' : 'star-border'} size={24} color={COLORS.primary} />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { marginTop: SPACING.md }]}>Your review</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Share your thoughts about this product"
        multiline
        numberOfLines={4}
        style={styles.textInput}
      />

      <TouchableOpacity style={styles.submit} onPress={() => onSubmit({ rating, text })} disabled={submitting}>
        <Text style={styles.submitText}>{submitting ? 'Saving...' : 'Submit Review'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, ...SHADOWS.small },
  label: { color: COLORS.text, fontWeight: '700' },
  starsRow: { flexDirection: 'row', marginTop: SPACING.sm },
  textInput: { marginTop: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.backgroundLight, padding: SPACING.sm, borderRadius: BORDER_RADIUS.sm, minHeight: 80 },
  submit: { marginTop: SPACING.md, backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, alignItems: 'center' },
  submitText: { color: COLORS.textOnPrimary, fontWeight: '700' },
});

export default ReviewForm;
