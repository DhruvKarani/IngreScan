import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  SafeAreaView,
  TouchableOpacity,
  Alert,
  RefreshControl
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ProductCard } from '../components';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';
import { SAMPLE_PRODUCTS } from '../constants/data';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { detectProductCorruption } from '../utils/dataCorruptionDetector';

const HistoryScreen = ({ navigation }) => {
  const [historyData, setHistoryData] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'favorites', 'recent'
  useEffect(() => {
    let unsub = null;
    const load = async () => {
      const user = auth.currentUser;
      if (!user) {
        setHistoryData([]);
        return;
      }

      const scansCol = collection(db, 'users', user.uid, 'scans');
      const q = query(scansCol, orderBy('lastScannedAt', 'desc'));
      unsub = onSnapshot(q, (snap) => {
        const items = [];
        snap.forEach(docSnap => {
          const d = docSnap.data() || {};
          items.push({ id: docSnap.id, ...d });
        });
        setHistoryData(items);
      }, (err) => {
        console.warn('Failed to listen for scan history', err.message || err);
      });
    };

    load();
    return () => { if (unsub) unsub(); };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    // trigger refresh by toggling the listener (or you can re-run a one-off fetch)
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleProductPress = async (product) => {
    // product is a scans doc object which may contain productSnapshot and analysis
    try {
      if (!product) return;

      // prefer barcode field from the scan doc or the scan doc id
      const barcode = product.barcode || product.id || (product.productSnapshot && (product.productSnapshot.barcode || product.productSnapshot.code)) || null;

      // Start with the scan's snapshot if present
      let merged = product.productSnapshot ? { ...product.productSnapshot } : {};

      // If snapshot lacks useful fields like ingredients/nutrition, try to fetch authoritative product doc
      const needsFetch = !(merged && (Array.isArray(merged.ingredients) && merged.ingredients.length) && (merged.nutrition || merged.nutriments));
      if (needsFetch && barcode) {
        try {
          const prodRef = doc(db, 'products', barcode);
          const pSnap = await getDoc(prodRef);
          if (pSnap && pSnap.exists()) {
            const remote = pSnap.data() || {};
            // merge remote authoritative fields, but keep any rich data already in snapshot
            merged = { ...remote, ...merged };
          }
        } catch (fetchErr) {
          console.warn('Failed to fetch authoritative product doc', fetchErr && fetchErr.message ? fetchErr.message : fetchErr);
        }
      }

      // Check verification status and corruption
      const verifiedCount = merged.verifiedCount || 0;
      const corruptionResult = detectProductCorruption(merged);
      merged.needsVerification = verifiedCount < 3 || corruptionResult.isCorrupted;
      merged.verifiedCount = verifiedCount;
      merged.isCorrupted = corruptionResult.isCorrupted;
      merged.corruptionIssues = corruptionResult.issues || [];

      // Ensure a product_name exists for display
      if (!merged.product_name) merged.product_name = product.productName || product.product_name || product.name || '';
      // prefer scannedAt from the scan doc
      if (!merged.scannedAt && product.scannedAt) merged.scannedAt = product.scannedAt;

      // Attach analysis from the scan doc (if present)
      const finalProduct = { ...merged, analysis: product.analysis || merged.analysis || {} };

      navigation.navigate('ProductDetails', { product: finalProduct, scanResult: {} });
    } catch (e) {
      console.warn('Error handling product press', e && e.message ? e.message : e);
      // fallback simple navigation
      const merged = { ...(product.productSnapshot || {}), product_name: product.productName || product.product_name || product.name || '' };
      navigation.navigate('ProductDetails', { product: { ...merged, analysis: product.analysis }, scanResult: {} });
    }
  };

  const handleToggleFavorite = (productId) => {
    // persist favourite flag to Firestore under users/{uid}/scans/{productId}
    (async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          Alert.alert('Not signed in', 'Please sign in to favorite items.');
          return;
        }
        const scanRef = doc(db, 'users', user.uid, 'scans', productId);
        // read current value locally
        const existing = historyData.find(i => i.id === productId);
        const newVal = !(existing && existing.isFavorite);
        await setDoc(scanRef, { isFavorite: newVal }, { merge: true });
        // local update to reflect immediately
        setHistoryData(prev => prev.map(item => item.id === productId ? { ...item, isFavorite: newVal } : item));
      } catch (e) {
        console.warn('Failed to toggle favorite', e && e.message ? e.message : e);
        Alert.alert('Error', 'Unable to update favorite');
      }
    })();
  };

  const handleDeleteItem = async (productId) => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to remove this item from your scan history?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const user = auth.currentUser;
              if (!user) {
                Alert.alert('Not signed in', 'Please sign in to modify your history.');
                return;
              }
              await deleteDoc(doc(db, 'users', user.uid, 'scans', productId));
            } catch (e) {
              console.warn('Failed to delete scan item', e && e.message ? e.message : e);
              Alert.alert('Error', 'Failed to delete item');
            }
          }
        }
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All History',
      'Are you sure you want to clear all scan history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: () => setHistoryData([])
        }
      ]
    );
  };

  const getFilteredData = () => {
    switch (filter) {
      case 'favorites':
        return historyData.filter(item => item.isFavorite);
      case 'recent':
        return historyData.slice(0, 5);
      default:
        return historyData;
    }
  };

  const renderFilterButton = (filterType, title, icon) => (
    <TouchableOpacity 
      style={[
        styles.filterButton, 
        filter === filterType && styles.filterButtonActive
      ]}
      onPress={() => setFilter(filterType)}
    >
      <MaterialIcons 
        name={icon} 
        size={20} 
        color={filter === filterType ? COLORS.textOnPrimary : COLORS.textSecondary} 
      />
      <Text style={[
        styles.filterButtonText,
        filter === filterType && styles.filterButtonTextActive
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const renderHistoryItem = ({ item, index }) => (
    <View style={styles.historyItem}>
      {
        (() => {
          // Ensure the ProductCard always receives a product_name field. Older scan docs may have productName at the top-level
          const snapshot = item && item.productSnapshot ? { ...item.productSnapshot } : {};
          if (!snapshot.product_name) snapshot.product_name = item.productName || item.product_name || item.name || '';
          // prefer scannedAt from the scan doc
          snapshot.scannedAt = snapshot.scannedAt || item.scannedAt || item.lastScannedAt || null;
          
          // Check verification status and corruption
          const verifiedCount = snapshot.verifiedCount || 0;
          const corruptionResult = detectProductCorruption(snapshot);
          snapshot.needsVerification = verifiedCount < 3 || corruptionResult.isCorrupted;
          snapshot.verifiedCount = verifiedCount;
          snapshot.isCorrupted = corruptionResult.isCorrupted;
          
          return (
            <ProductCard
              product={{ ...snapshot, analysis: item.analysis }}
              onPress={() => handleProductPress(item)}
              showDetails={true}
            />
          );
        })()
      }
      
      {/* Action Buttons */}
      <View style={styles.itemActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleToggleFavorite(item.id)}
        >
          <MaterialIcons 
            name={item.isFavorite ? "favorite" : "favorite-border"} 
            size={20} 
            color={item.isFavorite ? COLORS.error : COLORS.textSecondary} 
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => Alert.alert('Share', `Share ${item.productName || (item.productSnapshot && item.productSnapshot.product_name) || ''} coming soon!`)}
        >
          <MaterialIcons name="share" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleDeleteItem(item.id)}
        >
          <MaterialIcons name="delete" size={20} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="history" size={64} color={COLORS.textLight} />
      <Text style={styles.emptyStateTitle}>No Scan History</Text>
      <Text style={styles.emptyStateText}>
        {filter === 'favorites' 
          ? "You haven't favorited any products yet"
          : "Start scanning products to see your history here"
        }
      </Text>
      <TouchableOpacity 
        style={styles.scanButton}
        onPress={() => navigation.navigate('Scan')}
      >
        <MaterialIcons name="qr-code-scanner" size={24} color={COLORS.textOnPrimary} />
        <Text style={styles.scanButtonText}>Scan Product</Text>
      </TouchableOpacity>
    </View>
  );

  const filteredData = getFilteredData();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{historyData.length}</Text>
          <Text style={styles.statLabel}>Total Scans</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {historyData.filter(item => item.isFavorite).length}
          </Text>
          <Text style={styles.statLabel}>Favorites</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {Math.round(historyData.reduce((sum, item) => sum + (item.healthScore || 0), 0) / historyData.length) || 0}
          </Text>
          <Text style={styles.statLabel}>Avg Score</Text>
        </View>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {renderFilterButton('all', 'All', 'list')}
        {renderFilterButton('favorites', 'Favorites', 'favorite')}
        {renderFilterButton('recent', 'Recent', 'access-time')}
        
        {historyData.length > 0 && (
          <TouchableOpacity 
            style={styles.clearButton}
            onPress={handleClearAll}
          >
            <MaterialIcons name="clear-all" size={18} color={COLORS.error} />
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* History List */}
      {filteredData.length > 0 ? (
        <FlatList
          data={filteredData}
          renderItem={renderHistoryItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        />
      ) : (
        renderEmptyState()
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundLight,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    ...SHADOWS.small,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.borderLight,
    marginHorizontal: SPACING.md,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.backgroundLight,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  filterButtonTextActive: {
    color: COLORS.textOnPrimary,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.backgroundLight,
    marginLeft: 'auto',
  },
  clearButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.error,
    marginLeft: SPACING.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  listContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  historyItem: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  actionButton: {
    padding: SPACING.sm,
    marginLeft: SPACING.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyStateTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  emptyStateText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.base,
    marginBottom: SPACING.xl,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.medium,
  },
  scanButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textOnPrimary,
    marginLeft: SPACING.sm,
  },
});

export default HistoryScreen;