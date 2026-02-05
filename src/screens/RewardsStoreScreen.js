import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, Alert, ActivityIndicator, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS, BORDER_RADIUS } from '../constants/theme';
import { auth, db } from '../firebase';
import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';

const SAMPLE_COUPONS = [
  { id: 'c1', title: '10% off - Grocery', cost: 50, description: 'Use 50 points to get 10% off groceries' },
  { id: 'c2', title: '$5 off - Snacks', cost: 30, description: 'Use 30 points to get $5 off snacks' },
  { id: 'c3', title: 'Free Shipping', cost: 20, description: 'Use 20 points to get free shipping' },
];

const RewardsStoreScreen = ({ navigation }) => {
  const [points, setPoints] = useState(null);
  const [loading, setLoading] = useState(true);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;
    (async () => {
      const user = auth.currentUser;
      if (!user) {
        setPoints(0);
        setLoading(false);
        return;
      }
      try {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (!mounted) return;
        setPoints(snap.exists() ? (snap.data().points || 0) : 0);
      } catch (err) {
        console.warn('Rewards load error', err.message);
        setPoints(0);
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Bounce animation when points change
  useEffect(() => {
    if (points === null) return;
    scaleAnim.setValue(0.8);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [points]);

  const handleRedeem = async (coupon) => {
    const user = auth.currentUser;
    if (!user) return Alert.alert('Not signed in', 'Please sign in to redeem coupons');

    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error('User profile missing');
        const currentPoints = userSnap.data().points || 0;
        if (currentPoints < coupon.cost) throw new Error('Insufficient points');

        // deduct points and create coupon record
        transaction.set(userRef, { points: currentPoints - coupon.cost, updatedAt: new Date().toISOString() }, { merge: true });
        const couponRef = doc(db, 'users', user.uid, 'coupons', coupon.id);
        transaction.set(couponRef, { id: coupon.id, title: coupon.title, redeemedAt: serverTimestamp(), cost: coupon.cost });
      });

      Alert.alert('Redeemed', `You redeemed ${coupon.title} for ${coupon.cost} points`);
      // refresh local points
      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      setPoints(snap.exists() ? (snap.data().points || 0) : 0);
    } catch (err) {
      Alert.alert('Redeem failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && points === null) return (
    <SafeAreaView style={styles.container}><ActivityIndicator size="large" color={COLORS.primary} /></SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Rewards Store</Text>
          <Text style={styles.subtitle}>Redeem exciting offers with your points</Text>
        </View>

        <View style={styles.coinWrapper}>
          <Animated.View style={[styles.coin, { transform: [{ scale: scaleAnim }] }]}> 
            <LinearGradient
              colors={[COLORS.gradientStart || '#FFD36E', COLORS.gradientEnd || '#FFB84D']}
              start={[0, 0]}
              end={[1, 1]}
              style={styles.coinInner}
            >
              <MaterialCommunityIcons name="currency-usd-circle" size={34} color={COLORS.surface} />
              <Text style={styles.coinText}>{points ?? 0}</Text>
            </LinearGradient>
          </Animated.View>
          <Text style={styles.coinLabel}>Points</Text>
        </View>
      </View>

      <FlatList
        data={SAMPLE_COUPONS}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: SPACING.lg }}
        renderItem={({ item }) => (
          <View style={styles.couponCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.couponTitle}>{item.title}</Text>
              <Text style={styles.couponDesc}>{item.description}</Text>
            </View>
            <View style={{ alignItems: 'center', marginLeft: SPACING.md }}>
              <View style={styles.cost}>
                <MaterialCommunityIcons name="currency-usd" size={18} color={COLORS.primary} />
                <Text style={styles.costText}>{item.cost}</Text>
              </View>
              <TouchableOpacity
                style={[styles.redeemButton, item.cost > (points ?? 0) && { opacity: 0.5 }]}
                onPress={() => handleRedeem(item)}
                disabled={item.cost > (points ?? 0) || loading}
              >
                <Text style={styles.redeemText}>Redeem</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundLight },
  header: { padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: COLORS.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: TYPOGRAPHY.fontSize.xl + 2, fontWeight: '800', color: COLORS.text },
  points: { marginTop: SPACING.sm, color: COLORS.textSecondary },
  subtitle: { marginTop: SPACING.xs, color: COLORS.textSecondary },
  coinWrapper: { alignItems: 'center', marginLeft: SPACING.md },
  coin: {
    width: 110,
    height: 110,
    borderRadius: 110 / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.large,
    marginBottom: SPACING.xs,
  },
  coinInner: {
    width: '100%',
    height: '100%',
    borderRadius: 110 / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  coinText: { color: COLORS.surface, fontWeight: '900', marginLeft: SPACING.sm, fontSize: TYPOGRAPHY.fontSize.xl + 6 },
  coinLabel: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.textSecondary },
  couponCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.md, ...SHADOWS.small },
  couponTitle: { fontSize: TYPOGRAPHY.fontSize.base, fontWeight: '700', color: COLORS.text },
  couponDesc: { color: COLORS.textSecondary, marginTop: SPACING.xs },
  cost: { fontWeight: '700', color: COLORS.primary, marginBottom: SPACING.sm, flexDirection: 'row', alignItems: 'center' },
  costText: { fontWeight: '700', color: COLORS.primary, marginLeft: SPACING.xs },
  redeemButton: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md },
  redeemText: { color: COLORS.textOnPrimary, fontWeight: '700' },
});

export default RewardsStoreScreen;
