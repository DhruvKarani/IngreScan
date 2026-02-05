import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, SafeAreaView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { auth, db } from '../firebase';
import { collection, getDocs, doc, query, orderBy } from 'firebase/firestore';
import { ProductCard } from '../components';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS, BORDER_RADIUS } from '../constants/theme';

const MyReviewsScreen = ({ navigation }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) { setReviews([]); setLoading(false); return; }
      try {
        const scansCol = collection(db, 'users', user.uid, 'scans');
        const scansSnap = await getDocs(scansCol);
        const list = [];
        for (const s of scansSnap.docs) {
          const sData = s.data() || {};
          // try to read reviews subcollection under this scan
          try {
            const reviewsCol = collection(db, 'users', user.uid, 'scans', s.id, 'reviews');
            const rSnap = await getDocs(query(reviewsCol, orderBy('createdAt', 'desc')));
            rSnap.forEach(rDoc => {
              list.push({ id: `${s.id}_${rDoc.id}`, scanId: s.id, ...rDoc.data(), productSnapshot: sData.productSnapshot || {}, productName: sData.productName || sData.product_snapshot || sData.product_name });
            });
          } catch (e) {
            // ignore per-scan review read errors
          }
        }
        setReviews(list.sort((a,b) => (b.createdAt && a.createdAt) ? (b.createdAt.seconds - a.createdAt.seconds) : 0));
      } catch (e) {
        console.warn('Failed to load reviews', e.message || e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <ProductCard product={{ product_name: item.productName || (item.productSnapshot && item.productSnapshot.product_name) || 'Unnamed', ...item.productSnapshot }} onPress={() => navigation.navigate('ProductDetails', { product: { ...item.productSnapshot, analysis: item.analysis } })} />
      <View style={styles.reviewBody}>
        <Text style={styles.reviewRating}>Rating: {item.rating}/5</Text>
        <Text style={styles.reviewText}>{item.text}</Text>
      </View>
    </View>
  );

  if (loading) return <SafeAreaView style={{flex:1,justifyContent:'center',alignItems:'center'}}><ActivityIndicator /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={reviews}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: SPACING.lg }}
        ListEmptyComponent={<View style={{alignItems:'center',padding:SPACING.lg}}><Text style={{color:COLORS.textSecondary}}>You have not written any reviews yet.</Text></View>}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundLight },
  item: { marginBottom: SPACING.md, backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, ...SHADOWS.small },
  reviewBody: { padding: SPACING.sm },
  reviewRating: { fontWeight: '700', color: COLORS.text },
  reviewText: { color: COLORS.textSecondary, marginTop: SPACING.xs }
});

export default MyReviewsScreen;
