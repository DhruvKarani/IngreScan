import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  TextInput,
} from 'react-native';
import { Camera as CameraModule, CameraView } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { computeProductAnalysis } from '../utils/scoreProduct';
import { scoreFromRules } from '../utils/scoreFromRules';
import { SCORE_API_URL } from '../constants/config';
import { fetchProductFromOFF } from '../utils/openFoodFacts';
import RewardPopup from '../components/RewardPopup';

const ScanScreen = ({ navigation }) => {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanningCooldown, setScanningCooldown] = useState(false);
  const [rewardVisible, setRewardVisible] = useState(false);
  const [rewardPoints, setRewardPoints] = useState(0);
  const [rewardDetails, setRewardDetails] = useState({});
  const [manualBarcode, setManualBarcode] = useState('');

  useEffect(() => {
    (async () => {
      const { status } = await CameraModule.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');

      if (Platform.OS === 'web') {
        console.log('[SCAN] Checking browser barcode capabilities...');
        if (!('BarcodeDetector' in window)) {
          console.warn('[SCAN] your browser does not support the barcode detection API. Try Chrome or check Brave shields.');
        } else {
          try {
            const formats = await window.BarcodeDetector.getSupportedFormats();
            console.log('[SCAN] Browser supports formats:', formats.join(', '));
          } catch (e) {
            console.error('[SCAN] Error checking formats:', e.message);
          }
        }
      }
    })();
  }, []);

  const handleBarCodeScanned = async ({ type, data }) => {
    // We mark as scanned immediately to prevent duplicates
    setScanned(true);
    setScannedData(data);

    // Extract numeric code if present (barcodes often contain numbers)
    const numericCode = data.replace(/\D/g, '');
    const barcodeKey = numericCode.length ? numericCode : data; // fallback to raw data

    // helper to safely log arguments (stringify objects) to avoid LogBox rendering issues
    const safeStringify = (v) => {
      if (typeof v === 'string') return v;
      try {
        return JSON.stringify(v);
      } catch (e) {
        try { return String(v); } catch (__) { return '[unserializable]'; }
      }
    };

    const safeLog = (level, ...parts) => {
      try {
        const out = parts.map(p => (typeof p === 'string' ? p : safeStringify(p))).join(' ');
        switch (level) {
          case 'warn': console.warn(out); break;
          case 'error': console.error(out); break;
          case 'debug': console.debug ? console.debug(out) : console.log(out); break;
          default: console.log(out); break;
        }
      } catch (e) {
        console.log(parts[0]);
      }
    };

    try {
      setLoading(true);

      let product = null;

      // First try Firebase
      try {
        const productRef = doc(db, 'products', barcodeKey);
        let productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
          // Use the authoritative Firestore product doc if it exists.
          product = productSnap.data();
          safeLog('debug', '[Scan] Product found in Firestore for', barcodeKey);
          product._source = 'firestore';
        }
      } catch (firebaseError) {
        console.warn('Firebase error, checking local storage:', firebaseError.message);

        // Fallback to local storage
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const localProducts = await AsyncStorage.getItem('localProducts');
          if (localProducts) {
            const products = JSON.parse(localProducts);
            if (products[barcodeKey]) {
              product = products[barcodeKey];
              product._source = 'local_storage';
              safeLog('debug', '[Scan] Product found in local storage for', barcodeKey);
            }
          }
        } catch (localError) {
          console.warn('Local storage error:', localError.message);
        }
      }

      if (product && product._source === 'firestore') {
      } else if (product && (product._source === 'local_storage' || product._source === 'manual_entry_local')) {
        // Product found locally, use it directly
        safeLog('debug', '[Scan] Using locally stored product for', barcodeKey);
      } else {
        // Product not in Firestore: try OpenFoodFacts and persist if found.
        try {
          const off = await fetchProductFromOFF(barcodeKey);
          if (off) {
            // Normalize OFF data into UI-friendly fields
            try {
              const raw = off.nutriments && off.nutriments.__raw ? off.nutriments.__raw : (off.nutriments || {});
              const nutrition = {
                calories: raw.energy_kcal_100g ?? raw.energy_100g ?? undefined,
                protein: raw.proteins_100g ?? raw.proteins ?? undefined,
                carbs: raw.carbohydrates_100g ?? raw.carbohydrates ?? undefined,
                sugar: raw.sugars_100g ?? raw.sugars ?? undefined,
                fat: raw.fat_100g ?? raw.fat ?? undefined,
                sodium: (raw.salt_100g ?? raw.salt ?? raw['sodium_100g']) ? Math.round(Number(raw.salt_100g ?? raw.salt ?? raw['sodium_100g']) * 1000) : undefined,
                magnesium: raw.magnesium_100g ?? raw.magnesium ?? undefined,
                potassium: raw.potassium_100g ?? raw.potassium ?? undefined,
              };

              const txt = off.ingredients_text || off.raw?.ingredients_text || '';
              const ingredients = txt ? txt.split(/,|;|\n/).map(s => ({ name: s.trim(), riskLevel: 'LOW', description: '' })).filter(i => i.name) : [];

              product = { ...off, nutriments: off.nutriments, nutrition, ingredients, ingredients_text: txt, barcode: barcodeKey };
              await setDoc(productRef, product, { merge: true });
              safeLog('debug', '[Scan] Product fetched from OpenFoodFacts and persisted for', barcodeKey);
            } catch (w) {
              safeLog('warn', 'Failed to persist OFF product', w && w.message ? w.message : w);
              // Check if OFF data is actually useful (has nutrition or ingredients)
              const hasNutrition = off.nutriments && Object.keys(off.nutriments).some(key =>
                key.includes('100g') && off.nutriments[key] > 0
              );
              const hasIngredients = off.ingredients_text && off.ingredients_text.trim().length > 0;

              if (hasNutrition || hasIngredients) {
                // OFF has useful data, use it even if persistence failed
                product = { name: off.product_name || off.name || 'Unknown Product', barcode: barcodeKey, nutriments: off.nutriments || {}, ingredients_text: off.ingredients_text || '' };
              } else {
                // OFF data is incomplete, treat as no product found
                safeLog('debug', 'OFF product found but has no useful nutrition/ingredients data');
                product = null;
              }
            }
          }
        } catch (offErr) {
          safeLog('warn', 'OFF lookup failed', offErr && offErr.message ? offErr.message : offErr);
        }

        // If still no product, prompt user for manual entry
        if (!product) {
          setLoading(false);
          setScanned(false); // Allow scanning again

          Alert.alert(
            'Product Not Found',
            `We couldn't find information for this product (barcode: ${barcodeKey}) in our database or Open Food Facts. Would you like to help us by adding the product information manually?`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  // Reset scanning state
                  setScanningCooldown(false);
                }
              },
              {
                text: 'Add Manually',
                onPress: () => {
                  // Navigate to manual entry screen
                  navigation.navigate('ManualProductEntry', { barcode: barcodeKey });
                  setScanningCooldown(false);
                }
              }
            ]
          );
          return; // Exit early, don't continue processing
        }
      }

      // compute analysis based on provided authoritative rules (health_rules.json)
      let analysis = null;
      // --- sanitize ingredients so UI components receive a stable shape ---
      const sanitizeIngredients = (rawProduct) => {
        try {
          const arr = [];
          if (!rawProduct) return arr;

          // If product.ingredients is a prebuilt array, normalize each entry
          if (Array.isArray(rawProduct.ingredients) && rawProduct.ingredients.length) {
            rawProduct.ingredients.forEach((it) => {
              if (!it) return;
              if (typeof it === 'string') {
                const name = it.trim();
                if (name) arr.push({ name, category: '', riskLevel: 'LOW', description: '' });
                return;
              }
              // object-ish ingredient
              const name = String(it.name || it.ingredient || it.text || '').trim();
              if (!name) return;
              const category = String(it.category || it.type || '') || '';
              const riskLevel = String(it.riskLevel || it.risk || 'LOW') || 'LOW';
              const description = String(it.description || '') || '';
              const alternatives = Array.isArray(it.alternatives) ? it.alternatives : [];
              const healthImpact = it.healthImpact || it.impact || '';
              arr.push({ name, category, riskLevel, description, alternatives, healthImpact });
            });
            return arr;
          }

          // If there's an ingredients_text string, split into items
          const txt = String(rawProduct.ingredients_text || rawProduct.ingredientList || '').trim();
          if (txt) {
            txt.split(/,|;|\n/).map(s => s.trim()).filter(Boolean).forEach(name => arr.push({ name, category: '', riskLevel: 'LOW', description: '' }));
            return arr;
          }

          // As a last resort, try to pull from raw.off style
          if (rawProduct.raw && rawProduct.raw.ingredients_text) {
            String(rawProduct.raw.ingredients_text).split(/,|;|\n/).map(s => s.trim()).filter(Boolean).forEach(name => arr.push({ name, category: '', riskLevel: 'LOW', description: '' }));
            return arr;
          }

          return arr;
        } catch (e) {
          console.warn('[Scan] ingredient sanitization failed', e && e.message ? e.message : e);
          return [];
        }
      };

      // Normalize now and persist full normalized product so UI components and future scans use Firestore as the authoritative source
      try {
        const normalizedIngredients = sanitizeIngredients(product);

        const normalizedNutriments = product.nutriments && Object.keys(product.nutriments).length ? product.nutriments : (product.nutrition || {});
        const normalizedNutrition = product.nutrition || {};
        const normalizedProductName = product.product_name || product.name || product.title || '';
        const normalizedIngredientsText = product.ingredients_text || product.ingredientList || '';

        const normalizedProduct = {
          barcode: barcodeKey,
          product_name: normalizedProductName,
          nutriments: normalizedNutriments,
          nutrition: normalizedNutrition,
          ingredients_text: normalizedIngredientsText,
          ingredients: normalizedIngredients,
        };

        await setDoc(doc(db, 'products', barcodeKey), normalizedProduct, { merge: true });
        // ensure local product object reflects normalized shape
        product = { ...product, ...normalizedProduct };
      } catch (sanErr) {
        safeLog('warn', '[Scan] Failed to persist normalized product', sanErr && sanErr.message ? sanErr.message : sanErr);
      }
      try {
        const userRef = auth.currentUser ? doc(db, 'users', auth.currentUser.uid) : null;
        let userPrefs = { conditions: [], allergies: [] };
        if (userRef) {
          const uSnap = await getDoc(userRef);
          if (uSnap.exists()) {
            const d = uSnap.data();
            userPrefs.conditions = d.conditions || d.healthConditions || [];
            userPrefs.allergies = d.allergies || d.allergens || [];
          }
        }

        // Normalize nutriments and ingredients so the scorer sees consistent keys
        let rawNutr = product.nutriments || product.nutrition || {};
        if (rawNutr && rawNutr.__raw) rawNutr = rawNutr.__raw;

        const nutriments = {
          ...rawNutr,
          sugars_100g: Number(rawNutr.sugars_100g ?? rawNutr.sugars ?? rawNutr['sugars_100g'] ?? 0),
          fat_100g: Number(rawNutr.fat_100g ?? rawNutr.fat ?? 0),
          salt_100g: Number(rawNutr.salt_100g ?? rawNutr.salt ?? rawNutr['sodium_100g'] ?? 0),
          product_name: product.product_name || product.name || product.title || '',
        };

        // Normalize ingredientsText into a single string used by the scorer
        let ingredientsText = '';
        if (typeof product.ingredients === 'string' && product.ingredients.trim()) {
          ingredientsText = product.ingredients;
        } else if (typeof product.ingredients_text === 'string' && product.ingredients_text.trim()) {
          ingredientsText = product.ingredients_text;
        } else if (Array.isArray(product.ingredients) && product.ingredients.length) {
          // join array of ingredient objects or strings into a single string
          ingredientsText = product.ingredients.map(i => (typeof i === 'string' ? i : i.name || '')).filter(Boolean).join(', ');
        } else if (product.ingredientList && typeof product.ingredientList === 'string') {
          ingredientsText = product.ingredientList;
        } else {
          ingredientsText = '';
        }

        // Persist normalized ingredients_text back to product doc for future scans (best-effort)
        try {
          if (!product.ingredients_text || !product.ingredients_text.trim()) {
            await setDoc(doc(db, 'products', barcodeKey), { ingredients_text: ingredientsText }, { merge: true });
            product.ingredients_text = ingredientsText;
          }
        } catch (persistErr) {
          safeLog('warn', 'Failed to persist normalized ingredients_text', persistErr && persistErr.message ? persistErr.message : persistErr);
        }

        safeLog('debug', 'Scoring with nutriments:', nutriments, 'ingredientsText:', ingredientsText);

        // Try server-side scoring API first. If it fails, fallback to local scoreFromRules.
        let triedServer = false;
        try {
          if (SCORE_API_URL) {
            triedServer = true;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 12000);
            try {
              const body = JSON.stringify({ barcode: barcodeKey, userProfile: userPrefs });
              const resp = await fetch(SCORE_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                signal: controller.signal,
              });
              clearTimeout(timeout);
              if (resp.ok) {
                const data = await resp.json();
                // normalize server response into analysis shape expected by UI
                analysis = {
                  score: data.score ?? data.Score ?? data.healthScore ?? 0,
                  reasoning: data.reasoning || data.reasons || [],
                  tier: data.tier || data.consumptionTier || '',
                  confidence: data.confidence || 'MEDIUM',
                  nutrients: data.nutrients || data.raw_nutrients || {},
                  ingredients: data.ingredients || [],
                  additives: data.additives || [],
                  product_name: data.product_name || product.product_name || product.name || '',
                };
                // mark source
                analysis._source = 'server';
                safeLog('debug', '[Scan] Received analysis from server for', barcodeKey);
              } else {
                const text = await resp.text();
                safeLog('warn', 'Scoring API returned non-OK:', resp.status, text);
              }
            } catch (fetchErr) {
              if (fetchErr.name === 'AbortError') safeLog('warn', 'Scoring API call timed out');
              else safeLog('warn', 'Scoring API call failed, falling back to local scorer:', fetchErr && fetchErr.message ? fetchErr.message : fetchErr);
            }
          }
        } catch (apiErr) {
          console.warn('Unexpected scoring API error, falling back to local scorer:', apiErr && apiErr.message ? apiErr.message : apiErr);
        }

        if (!analysis) {
          // local fallback with defensive try/catch
          try {
            analysis = scoreFromRules(nutriments, ingredientsText, userPrefs);
            analysis._source = 'local';
            safeLog('debug', '[Scan] Using local scorer for', barcodeKey);
          } catch (localErr) {
            safeLog('error', '[Scan] Local scorer failed:', localErr && localErr.message ? localErr.message : localErr);
            // fallback to a minimal safe analysis so we can continue
            analysis = {
              score: 0,
              Score: 0,
              score10: 0,
              Tier: 'Unknown',
              Confidence: 'LOW',
              explanation: 'Local scoring failed; defaulted',
              personalizedWarnings: [],
              Warnings: [],
              breakdown: { baseScore: 0, penalty: 0 },
              _source: 'local-failed',
            };
          }
        }

        // persist analysis to product doc for future use
        try {
          // include a small audit block when persisting so we know the source
          const audit = { rulesVersion: '1', analyzedAt: new Date().toISOString(), source: analysis._source || 'local' };
          const persisted = { analysis, healthScore: analysis.score, analysisAudit: audit };
          await setDoc(doc(db, 'products', barcodeKey), persisted, { merge: true });
          // merge into local product object as well
          product = { ...product, ...persisted };
        } catch (writeErr) {
          safeLog('warn', 'Failed to persist analysis', writeErr && writeErr.message ? writeErr.message : writeErr);
        }
      } catch (e) {
        console.warn('Analysis failed', e.message);
      }

      // Award reward points based on rules using a Firestore transaction
      const user = auth.currentUser;
      if (!user) {
        // not signed in — no points awarded
        setLoading(false);
        return;
      }

      const userRef = doc(db, 'users', user.uid);
      const scanRef = doc(db, 'users', user.uid, 'scans', barcodeKey);

      // Retry transactional award up to 3 times to handle contention
      let result = null;
      const maxTries = 5;
      for (let attempt = 1; attempt <= maxTries; attempt++) {
        try {
          result = await runTransaction(db, async (transaction) => {
            const [uSnap, sSnap] = await Promise.all([
              transaction.get(userRef),
              transaction.get(scanRef),
            ]);

            const userData = uSnap.exists() ? uSnap.data() : {};
            const alreadyScanned = sSnap.exists();

            // compute product points (score out of 10) using local product/analysis
            let rawScore = 0;
            if (analysis) {
              rawScore = analysis.score ?? analysis.Score ?? 0; // analysis.score is 0-100
            } else if (product && (product.healthScore || product.score)) {
              rawScore = product.healthScore ?? product.score ?? 0;
            }
            let productPoints = 0;
            if (rawScore > 10) {
              productPoints = Math.round(rawScore / 10);
            } else {
              productPoints = Math.round(rawScore);
            }

            // ensure within 0..10
            productPoints = Math.max(0, Math.min(10, productPoints));

            // daily first scan bonus check
            const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
            const lastDaily = userData.lastDailyBonusDate || null;
            let award = 0;
            let awardedComponents = { dailyBonus: 0, productPoints: 0, uniqueBonus: 0 };

            // Unique product rule: if user has scanned the product before, they get no product/unique points
            if (!alreadyScanned) {
              awardedComponents.productPoints = productPoints;
              awardedComponents.uniqueBonus = 2;
              award += productPoints + 2;

              // create scan doc record with full snapshot and analysis for user
              transaction.set(scanRef, {
                barcode: barcodeKey,
                productName: product && (product.product_name || product.name) ? (product.product_name || product.name) : scannedData,
                scannedAt: serverTimestamp(),
                lastScannedAt: serverTimestamp(),
                productPoints,
                uniqueBonus: 2,
                analysis: analysis || {},
                // ensure snapshot includes product_name for compatibility with older UIs
                productSnapshot: ({ ...(product || {}), product_name: (product && (product.product_name || product.name)) ? (product.product_name || product.name) : '' }),
                analysisAudit: (product && product.analysisAudit) ? product.analysisAudit : { source: analysis && analysis._source ? analysis._source : 'local' },
                scanCount: 1,
              });
            } else {
              // if already scanned, update lastScannedAt and bump scan count
              const prevCount = sSnap.exists() && sSnap.data() && sSnap.data().scanCount ? Number(sSnap.data().scanCount) : 1;
              transaction.update(scanRef, {
                lastScannedAt: serverTimestamp(),
                scanCount: prevCount + 1,
                // optionally refresh analysis if missing
                analysis: analysis || (sSnap.exists() ? sSnap.data().analysis : {}),
              });
            }
            // Ensure ingredientsText is a single string for the scorer
            let ingredientsText = '';
            if (typeof product.ingredients === 'string' && product.ingredients.trim()) {
              ingredientsText = product.ingredients;
            } else if (typeof product.ingredients_text === 'string' && product.ingredients_text.trim()) {
              ingredientsText = product.ingredients_text;
            } else if (Array.isArray(product.ingredients) && product.ingredients.length) {
              // join array of ingredient objects or strings into a single string
              ingredientsText = product.ingredients.map(i => (typeof i === 'string' ? i : i.name || '')).filter(Boolean).join(', ');
            } else if (product.ingredientList && typeof product.ingredientList === 'string') {
              ingredientsText = product.ingredientList;
            } else {
              ingredientsText = '';
            }

            // Daily first scan bonus
            if (lastDaily !== today) {
              awardedComponents.dailyBonus = 5;
              award += 5;
              // update lastDailyBonusDate below
            }

            // Update user points atomically
            const previousPoints = userData.points || 0;
            const newPoints = previousPoints + award;

            const userUpdate = {
              points: newPoints,
              updatedAt: new Date().toISOString(),
            };
            if (lastDaily !== today) userUpdate.lastDailyBonusDate = today;

            transaction.set(userRef, userUpdate, { merge: true });

            return { award, newPoints, awardedComponents };
          });
          // success, break retry loop
          break;
        } catch (txErr) {
          safeLog('warn', `[Scan] Transaction attempt ${attempt} failed:`, txErr && txErr.message ? txErr.message : txErr);
          if (attempt === maxTries) throw txErr;
          // exponential backoff
          const backoff = 300 * Math.pow(1.8, attempt);
          await new Promise(r => setTimeout(r, Math.round(backoff)));
        }
      }

      // Show reward popup with transaction result then navigate
      try {
        if (result && result.awardedComponents) {
          const total = (result.awardedComponents.productPoints || 0) + (result.awardedComponents.uniqueBonus || 0) + (result.awardedComponents.dailyBonus || 0);
          setRewardPoints(total);
          setRewardDetails(result.awardedComponents);
          setRewardVisible(true);
          // auto-dismiss after 2.2s then navigate
          setTimeout(() => {
            setRewardVisible(false);
            try {
              navigation.navigate('ProductDetails', { product: { ...product, analysis }, scanResult: result });
            } catch (navErr) {
              console.warn('Navigation failed', navErr);
              setScanningCooldown(true);
              setTimeout(() => setScanningCooldown(false), 1200);
            }
          }, 2200);
        } else {
          navigation.navigate('ProductDetails', { product: { ...product, analysis }, scanResult: result });
        }
      } catch (navErr) {
        console.warn('Navigation failed', navErr);
        setScanningCooldown(true);
        setTimeout(() => setScanningCooldown(false), 1200);
      }

    } catch (err) {
      // Log full error for debugging
      console.error('Barcode handling error:', err, err && err.stack ? err.stack : 'no-stack');
      const msg = err && err.message ? String(err.message) : JSON.stringify(err);
      Alert.alert('Error', `Unable to process scanned barcode: ${msg}`);
      // Reset scanner state so user can try again; keep a longer cooldown to avoid loops
      setScanned(false);
      setScannedData(null);
      setScanningCooldown(true);
      setTimeout(() => setScanningCooldown(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.centerContent}>
        <Text style={{ color: COLORS.text }}>Requesting camera permission...</Text>
        <ActivityIndicator style={{ marginTop: 12 }} size="small" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.centerContent}>
        <Text style={{ color: COLORS.error }}>No access to camera. Please enable camera permissions in settings.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={28} color={COLORS.textOnPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Scan Product</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.scannerContainer}>
        <CameraView
          barcodeScannerSettings={{
            barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"],
          }}
          onBarcodeScanned={(scanned || scanningCooldown) ? undefined : (data) => {
            console.log('[SCAN] Barcode detected:', data.data, 'Type:', data.type);
            handleBarCodeScanned(data);
          }}
          style={StyleSheet.absoluteFillObject}
          ratio="16:9"
        />

        <View pointerEvents="none" style={styles.overlayCenter}>
          <View style={styles.scanBox} />
          <Text style={styles.hint}>Align barcode inside the frame</Text>
        </View>
      </View>

      <View style={styles.footer}>
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : scanned ? (
          <>
            <Text style={styles.scannedText}>Scanned: {scannedData}</Text>
            <TouchableOpacity style={styles.button} onPress={() => {
              setScanned(false);
              setScannedData(null);
              setScanningCooldown(true);
              setTimeout(() => setScanningCooldown(false), 1200);
            }}>
              <Text style={styles.buttonText}>Scan Again</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={{ width: '100%', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingHorizontal: 12, marginBottom: 10, width: '80%' }}>
              <TextInput
                placeholder="Enter barcode manually"
                placeholderTextColor={COLORS.textSecondary}
                style={{ flex: 1, color: COLORS.textOnPrimary, height: 40 }}
                value={manualBarcode}
                onChangeText={setManualBarcode}
                keyboardType="numeric"
                onSubmitEditing={() => handleBarCodeScanned({ type: 'manual', data: manualBarcode })}
              />
              <TouchableOpacity onPress={() => handleBarCodeScanned({ type: 'manual', data: manualBarcode })}>
                <MaterialIcons name="send" size={24} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.footerText}>Point camera at barcode or enter manually</Text>
          </View>
        )}
      </View>
      <RewardPopup visible={rewardVisible} onClose={() => setRewardVisible(false)} points={rewardPoints} details={rewardDetails} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.text },
  topBar: { height: 60, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md },
  title: { color: COLORS.textOnPrimary, fontWeight: '700', fontSize: TYPOGRAPHY.fontSize.lg },
  scannerContainer: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  overlayCenter: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  scanBox: { width: 260, height: 160, borderWidth: 2, borderColor: COLORS.primary, borderRadius: 12, backgroundColor: 'transparent' },
  hint: { color: COLORS.textOnPrimary, marginTop: 12 },
  footer: { height: 100, alignItems: 'center', justifyContent: 'center' },
  footerText: { color: COLORS.textSecondary },
  scannedText: { color: COLORS.textOnPrimary, marginBottom: 8 },
  button: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: COLORS.textOnPrimary, fontWeight: '700' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

export default ScanScreen;