import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, Share } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const ReferEarnScreen = () => {
  const [referralCode, setReferralCode] = useState(null);

  useEffect(() => {
    (async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) setReferralCode(snap.data().referralCode || null);
      } catch (err) {
        console.warn('Failed to load referral code', err.message);
      }
    })();
  }, []);

  const handleCopy = async () => {
    try {
      await Share.share({ message: `Use my IngreScan referral code: ${referralCode}` });
    } catch (err) {
      Alert.alert('Share failed', err.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Refer & Earn</Text>
        <Text style={styles.subtitle}>Share your code and earn 50 points when someone signs up with it.</Text>
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{referralCode || '—'}</Text>
        </View>
        <TouchableOpacity style={styles.shareButton} onPress={handleCopy} disabled={!referralCode}>
          <MaterialIcons name="share" size={18} color="#fff" />
          <Text style={styles.shareText}>Share Code</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundLight, padding: SPACING.lg },
  card: { backgroundColor: COLORS.surface, padding: SPACING.lg, borderRadius: BORDER_RADIUS.md, ...SHADOWS.small },
  title: { fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text, marginBottom: SPACING.sm },
  subtitle: { color: COLORS.textSecondary, marginBottom: SPACING.md },
  codeBox: { backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginBottom: SPACING.md },
  codeText: { color: COLORS.textOnPrimary, fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: TYPOGRAPHY.fontWeight.bold },
  shareButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.primaryDark, padding: SPACING.md, borderRadius: BORDER_RADIUS.md },
  shareText: { color: '#fff', marginLeft: SPACING.sm }
});

export default ReferEarnScreen;
