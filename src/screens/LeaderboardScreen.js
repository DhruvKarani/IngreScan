import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS, BORDER_RADIUS } from '../constants/theme';
import { auth, db } from '../firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

const LeaderboardScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const currentUid = auth.currentUser ? auth.currentUser.uid : null;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('points', 'desc'), limit(50));
        const snap = await getDocs(q);
        if (!mounted) return;
        const rows = [];
        snap.forEach(doc => {
          const d = doc.data();
          rows.push({ id: doc.id, name: d.name || 'Anonymous', points: d.points || 0, avatar: d.avatarUrl || null });
        });
        setUsers(rows);
      } catch (err) {
        console.warn('Leaderboard load failed', err.message);
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) return (
    <SafeAreaView style={styles.container}><ActivityIndicator size="large" color={COLORS.primary} /></SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.subtitle}>Top scanners by points</Text>
      </View>

      <FlatList
        data={users}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: SPACING.lg }}
        renderItem={({ item, index }) => (
          <View style={[styles.row, item.id === currentUid && styles.currentUserRow]}>
              <Text style={styles.rank}>{index + 1}</Text>

              <View style={styles.avatarWrap}>
                {item.avatar ? (
                  <Image source={{ uri: item.avatar }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>{(item.name || 'A').slice(0,1).toUpperCase()}</Text>
                  </View>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.points}>{item.points} pts</Text>
              </View>

              <View style={styles.medalWrap}>
                {index === 0 && <MaterialCommunityIcons name="medal" size={28} color="#FFD700" />}
                {index === 1 && <MaterialCommunityIcons name="medal" size={26} color="#C0C0C0" />}
                {index === 2 && <MaterialCommunityIcons name="medal" size={24} color="#CD7F32" />}
              </View>
            <TouchableOpacity style={styles.viewButton} onPress={() => { /* future: view profile */ }}>
              <Text style={styles.viewText}>View</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundLight },
  header: { padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: COLORS.surface },
  title: { fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: '800', color: COLORS.text },
  subtitle: { marginTop: SPACING.xs, color: COLORS.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.md, ...SHADOWS.small },
  currentUserRow: { borderColor: COLORS.primary, borderWidth: 2 },
  rank: { width: 36, fontWeight: '800', fontSize: TYPOGRAPHY.fontSize.lg, color: COLORS.primary },
  avatarWrap: { width: 56, alignItems: 'center', marginHorizontal: SPACING.sm },
  avatar: { width: 48, height: 48, borderRadius: 48 / 2 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 48 / 2, backgroundColor: COLORS.backgroundLight, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontWeight: '800', color: COLORS.text, fontSize: TYPOGRAPHY.fontSize.base },
  medalWrap: { width: 40, alignItems: 'center', justifyContent: 'center' },
  name: { fontWeight: '700', color: COLORS.text },
  points: { color: COLORS.textSecondary, marginTop: SPACING.xs },
  viewButton: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md },
  viewText: { color: COLORS.textOnPrimary, fontWeight: '700' },
});

export default LeaderboardScreen;
