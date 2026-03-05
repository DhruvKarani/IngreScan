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
import { fetchProductData } from '../utils/productDataFetcher';
import RewardPopup from '../components/RewardPopup';
import DataVerificationModal from '../components/DataVerificationModal';
import { detectProductCorruption } from '../utils/dataCorruptionDetector';

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
  
  // Step 7: Data Verification Modal State
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [productToVerify, setProductToVerify] = useState(null);
  const [pendingScanResult, setPendingScanResult] = useState(null);

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
          console.log('[Scan] ✓ Product found in Firestore for', barcodeKey);
          console.log('[Scan] Firebase product data keys:', Object.keys(product));
          product._source = 'firestore';
        } else {
          console.log('[Scan] ✗ Product NOT found in Firestore, will fetch from API');
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
        console.log('[Scan] Firebase product loaded, checking trust & corruption...');
        console.log('[Scan] Product object:', JSON.stringify(product, null, 2));
        
        // NEW APPROACH: Use verification count + corruption detection
        const verifiedCount = product.verifiedCount || 0;
        const TRUST_THRESHOLD = 3; // Need 3+ user verifications to trust
        
        console.log('[Scan] Product verifiedCount:', verifiedCount, '(threshold:', TRUST_THRESHOLD + ')');
        
        // Run corruption detection
        const corruptionResult = detectProductCorruption(product);
        console.log('[Scan] Corruption check:', corruptionResult);
        
        // Decision: Show verification modal ONLY if not enough user verifications
        // If product has 3+ verifications, trust it even if corruption detected
        // (users have already verified this data multiple times)
        const needsVerification = verifiedCount < TRUST_THRESHOLD;
        
        if (needsVerification) {
          console.log('[Scan] Product needs verification - verifiedCount:', verifiedCount, ', corrupted:', corruptionResult.isCorrupted);
          
          // When verification is needed, mark ALL key fields for review  
          // (Modal will show them pre-filled with existing data for user to verify/edit)
          const missingFieldsList = [
            'ingredients_text',
            'energy-kcal',
            'sugars',
            'fat',
            'proteins',
            'carbohydrates',
            'salt',
            'brands',
            'quantity'
          ];
          
          // Prepare verification modal
          let verificationReason = 'Please verify product data';
          if (corruptionResult.isCorrupted) {
            verificationReason = 'Data corruption detected: ' + corruptionResult.issues.join('; ');
          } else if (verifiedCount === 0) {
            verificationReason = 'This product has not been verified by users yet';
          } else {
            verificationReason = `This product has only ${verifiedCount} verification(s), need ${TRUST_THRESHOLD} for trust`;
          }
          
          setProductToVerify({
            ...product,
            metadata: {
              needs_verification: true,
              verification_reason: verificationReason,
              verified_count: verifiedCount,
              is_corrupted: corruptionResult.isCorrupted,
              corruption_details: corruptionResult.issues,
              missing_fields: missingFieldsList,
              primary_source: 'Firebase',
              confidence: corruptionResult.isCorrupted ? 'CORRUPTED' : verifiedCount === 0 ? 'UNVERIFIED' : 'LOW'
            }
          });
          setShowVerificationModal(true);
          setLoading(false);
          return;
        }
        
        // Product is trusted (verifiedCount >= 3), use directly
        console.log('[Scan] ✓ Product is trusted (verified:', verifiedCount, 'times), using directly');
        
        // But warn if corruption detected in trusted product
        if (corruptionResult.isCorrupted) {
          console.warn('[Scan] ⚠️ Corruption detected in trusted product:', corruptionResult.issues);
          Alert.alert(
            '⚠️ Data Quality Notice',
            `This product has ${verifiedCount} verifications, but we detected unusual data:\n\n${corruptionResult.issues.join('\n')}\n\nThe product will load normally. If you notice errors, please report them.`,
            [{ text: 'OK', style: 'default' }]
          );
        }
      } else if (product && (product._source === 'local_storage' || product._source === 'manual_entry_local')) {
        // Product found locally, use it directly
        safeLog('debug', '[Scan] Using locally stored product for', barcodeKey);
      } else {
        // Product not in Firestore: try new multi-source fetcher (Step 7)
        try {
          console.log('[Scan] Fetching from multi-source API for', barcodeKey);
          const fetchedProduct = await fetchProductData(barcodeKey);
          
          // Check if product was found
          if (!fetchedProduct) {
            // Product not found in any source
            setLoading(false);
            setScanned(false);

            Alert.alert(
              'Product Not Found',
              `We couldn't find information for this product (barcode: ${barcodeKey}) in our database or Open Food Facts. Would you like to help us by adding the product information manually?`,
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => {
                    setScanningCooldown(false);
                  }
                },
                {
                  text: 'Add Manually',
                  onPress: () => {
                    navigation.navigate('ManualProductEntry', { barcode: barcodeKey });
                    setScanningCooldown(false);
                  }
                }
              ]
            );
            return;
          }
          
          // NEW APPROACH: ALWAYS verify API-fetched products (verifiedCount will be 0)
          console.log('[Scan] Product fetched from API - requires user verification');
          
          // Run corruption detection on API data too
          const corruptionResult = detectProductCorruption(fetchedProduct);
          console.log('[Scan] API product corruption check:', corruptionResult);
          
          // Show ALL key fields for verification (will be pre-filled if data exists)
          const missingFieldsList = [
            'ingredients_text',
            'energy-kcal',
            'sugars',
            'fat',
            'proteins',
            'carbohydrates',
            'salt',
            'brands',
            'quantity'
          ];
          
          setProductToVerify({
            ...fetchedProduct,
            verifiedCount: 0, // Initialize verification count
            metadata: {
              needs_verification: true,
              verification_reason: 'New product from API - needs user verification',
              verified_count: 0,
              is_corrupted: corruptionResult.isCorrupted,
              corruption_details: corruptionResult.issues,
              missing_fields: missingFieldsList,
              primary_source: fetchedProduct.metadata?.primary_source || 'API',
              confidence: 'UNVERIFIED'
            }
          });
          setShowVerificationModal(true);
          setLoading(false);
          return; // Exit early, modal will handle next steps
        } catch (offErr) {
          safeLog('warn', 'API fetch failed', offErr && offErr.message ? offErr.message : offErr);
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
            analysis = await scoreFromRules(nutriments, ingredientsText, userPrefs);
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

  /**
   * Step 7: Handle verified or skipped products from DataVerificationModal
   * This processes the product through scoring, saves to Firebase, and navigates to ProductDetails
   */
  const handleVerifiedProduct = async (product, wasVerified) => {
    try {
      setLoading(true);
      
      const barcodeKey = product.barcode || scannedData;
      console.log(`[Scan] Processing ${wasVerified ? 'verified' : 'skipped'} product:`, barcodeKey);
      console.log('[Scan] Product nutriments:', JSON.stringify(product.nutriments || {}, null, 2));
      console.log('[Scan] Product metadata:', JSON.stringify(product.metadata || {}, null, 2));
      
      // helper for safe logging
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
      
      // Save product to Firebase with updated verification count
      try {
        const productRef = doc(db, 'products', barcodeKey);
        
        // Increment verifiedCount if user verified (not skipped)
        if (wasVerified) {
          const currentCount = product.verifiedCount || 0;
          product.verifiedCount = currentCount + 1;
          console.log('[Scan] Incrementing verifiedCount:', currentCount, '→', product.verifiedCount);
          
          if (product.metadata) {
            product.metadata.completeness_score = 100;
            product.metadata.verified_count = product.verifiedCount;
          }
        }
        
        // Ensure _source is set so verification check runs on rescan
        product._source = 'firestore';
        product._savedAt = new Date().toISOString();
        
        console.log('[Scan] Saving to Firebase:', {
          barcode: barcodeKey,
          hasNutriments: !!product.nutriments,
          nutrimentKeys: Object.keys(product.nutriments || {}),
          verified: wasVerified,
          verifiedCount: product.verifiedCount || 0
        });
        
        await setDoc(productRef, product, { merge: true });
        safeLog('debug', `[Scan] Product saved to Firebase (verified: ${wasVerified}, count: ${product.verifiedCount || 0})`);
      } catch (saveErr) {
        safeLog('warn', 'Failed to save product to Firebase:', saveErr.message);
      }
      
      // Sanitize ingredients for scoring
      const sanitizeIngredients = (rawProduct) => {
        try {
          const arr = [];
          if (!rawProduct) return arr;
          
          if (Array.isArray(rawProduct.ingredients) && rawProduct.ingredients.length) {
            rawProduct.ingredients.forEach((it) => {
              if (!it) return;
              if (typeof it === 'string') {
                const name = it.trim();
                if (name) arr.push({ name, category: '', riskLevel: 'LOW', description: '' });
                return;
              }
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
          
          const txt = String(rawProduct.ingredients_text || rawProduct.ingredientList || '').trim();
          if (txt) {
            txt.split(/,|;|\n/).map(s => s.trim()).filter(Boolean).forEach(name => 
              arr.push({ name, category: '', riskLevel: 'LOW', description: '' })
            );
            return arr;
          }
          
          return arr;
        } catch (e) {
          console.warn('[Scan] ingredient sanitization failed', e.message);
          return [];
        }
      };
      
      // Normalize and score product
      const normalizedIngredients = sanitizeIngredients(product);
      
      // Get user preferences for personalized scoring
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
      
      // Normalize nutriments for scoring
      let rawNutr = product.nutriments || product.nutrition || {};
      if (rawNutr && rawNutr.__raw) rawNutr = rawNutr.__raw;
      
      const nutriments = {
        ...rawNutr,
        sugars_100g: Number(rawNutr.sugars_100g ?? rawNutr.sugars ?? 0),
        fat_100g: Number(rawNutr.fat_100g ?? rawNutr.fat ?? 0),
        salt_100g: Number(rawNutr.salt_100g ?? rawNutr.salt ?? rawNutr['sodium_100g'] ?? 0),
        product_name: product.product_name || product.name || '',
      };
      
      // Get ingredients text for scoring
      let ingredientsText = '';
      if (typeof product.ingredients === 'string' && product.ingredients.trim()) {
        ingredientsText = product.ingredients;
      } else if (typeof product.ingredients_text === 'string' && product.ingredients_text.trim()) {
        ingredientsText = product.ingredients_text;
      } else if (Array.isArray(product.ingredients) && product.ingredients.length) {
        ingredientsText = product.ingredients.map(i => (typeof i === 'string' ? i : i.name || '')).filter(Boolean).join(', ');
      } else if (product.ingredientList && typeof product.ingredientList === 'string') {
        ingredientsText = product.ingredientList;
      }
      
      // Score using local scoreFromRules
      let analysis = null;
      try {
        analysis = await scoreFromRules(nutriments, ingredientsText, userPrefs);
        analysis._source = 'local';
        safeLog('debug', '[Scan] Analysis complete for verified product');
        
        // Validate analysis quality - warn if still insufficient after user verification
        if (analysis.score <= 1 || analysis.Tier === 'Incomplete Data') {
          safeLog('warn', '[Scan] Product still has insufficient data after verification');
          Alert.alert(
            'More Details Needed',
            'This product still needs more nutritional information for accurate scoring. You can add more details later by editing the product.',
            [{ text: 'Continue Anyway', onPress: () => {} }]
          );
          // Continue anyway - don't block the user, just warn them
        }
      } catch (scoreErr) {
        safeLog('error', '[Scan] Scoring failed:', scoreErr.message);
        analysis = {
          score: 0,
          tier: 'Unknown',
          confidence: 'LOW',
          explanation: 'Scoring failed',
          _source: 'local-failed',
        };
      }
      
      // Save analysis to Firebase
      try {
        const productRef = doc(db, 'products', barcodeKey);
        const audit = { rulesVersion: '1', analyzedAt: new Date().toISOString(), source: analysis._source };
        await setDoc(productRef, { 
          analysis, 
          healthScore: analysis.score,
          analysisAudit: audit,
          ingredients: normalizedIngredients,
        }, { merge: true });
        product = { ...product, analysis, healthScore: analysis.score, ingredients: normalizedIngredients };
      } catch (writeErr) {
        safeLog('warn', 'Failed to persist analysis:', writeErr.message);
      }
      
      // Award points if user is logged in
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const scanRef = doc(db, 'users', user.uid, 'scans', barcodeKey);
        
        try {
          const result = await runTransaction(db, async (transaction) => {
            const [uSnap, sSnap] = await Promise.all([
              transaction.get(userRef),
              transaction.get(scanRef),
            ]);
            
            const userData = uSnap.exists() ? uSnap.data() : {};
            const alreadyScanned = sSnap.exists();
            
            let rawScore = analysis?.score ?? 0;
            let productPoints = Math.max(0, Math.min(10, Math.round(rawScore > 10 ? rawScore / 10 : rawScore)));
            
            const today = new Date().toISOString().slice(0, 10);
            const lastDaily = userData.lastDailyBonusDate || null;
            let award = 0;
            let awardedComponents = { dailyBonus: 0, productPoints: 0, uniqueBonus: 0 };
            
            if (!alreadyScanned) {
              awardedComponents.productPoints = productPoints;
              awardedComponents.uniqueBonus = 2;
              award += productPoints + 2;
              
              // Add bonus points if user verified the product
              if (wasVerified) {
                awardedComponents.verificationBonus = 5;
                award += 5;
              }
              
              transaction.set(scanRef, {
                barcode: barcodeKey,
                productName: product.product_name || product.name || barcodeKey,
                scannedAt: serverTimestamp(),
                lastScannedAt: serverTimestamp(),
                productPoints,
                uniqueBonus: 2,
                verificationBonus: wasVerified ? 5 : 0,
                userVerified: wasVerified,
                analysis: analysis || {},
                productSnapshot: product, // Use latest verified product data
                analysisAudit: { source: analysis?._source || 'local' },
                scanCount: 1,
              });
            } else {
              const prevCount = sSnap.data()?.scanCount || 1;
              
              // Update with fresh data, especially if user just verified it
              const updateData = {
                lastScannedAt: serverTimestamp(),
                scanCount: prevCount + 1,
                productSnapshot: product, // Update with latest verified data
                analysis: analysis || {},
                analysisAudit: { source: analysis?._source || 'local' },
              };
              
              // If user just verified, add verification bonus and update flags
              if (wasVerified) {
                const prevVerificationBonus = sSnap.data()?.verificationBonus || 0;
                if (prevVerificationBonus === 0) {
                  // Award verification bonus if not already given
                  awardedComponents.verificationBonus = 5;
                  award += 5;
                  updateData.verificationBonus = 5;
                  updateData.userVerified = true;
                }
              }
              
              transaction.update(scanRef, updateData);
            }
            
            if (lastDaily !== today) {
              awardedComponents.dailyBonus = 5;
              award += 5;
            }
            
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
          
          // Show reward popup if points were awarded
          if (result && result.award > 0) {
            setRewardPoints(result.award);
            setRewardDetails(result.awardedComponents);
            setRewardVisible(true);
            
            // Auto-dismiss and navigate
            setTimeout(() => {
              setRewardVisible(false);
              console.log('[Scan] Navigating to ProductDetails with nutriments:', JSON.stringify(product.nutriments || {}, null, 2));
              navigation.navigate('ProductDetails', { product: { ...product, analysis } });
            }, 2200);
          } else {
            // No points awarded, navigate immediately
            console.log('[Scan] Navigating to ProductDetails with nutriments:', JSON.stringify(product.nutriments || {}, null, 2));
            navigation.navigate('ProductDetails', { product: { ...product, analysis } });
          }
          
        } catch (txErr) {
          safeLog('warn', '[Scan] Transaction failed:', txErr.message);
          // Navigate anyway
          navigation.navigate('ProductDetails', { product: { ...product, analysis } });
        }
      } else {
        // Not logged in, just navigate
        navigation.navigate('ProductDetails', { product: { ...product, analysis } });
      }
      
    } catch (err) {
      console.error('[Scan] handleVerifiedProduct error:', err);
      Alert.alert('Error', 'Failed to process product. Please try again.');
    } finally {
      setLoading(false);
      setScanned(false);
      setScanningCooldown(false);
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
      
      {/* Step 7: Data Verification Modal */}
      <DataVerificationModal
        visible={showVerificationModal}
        product={productToVerify}
        metadata={productToVerify?.metadata}
        onSkip={(product) => {
          console.log('[Scan] User skipped verification');
          setShowVerificationModal(false);
          
          // Continue with analysis and navigation using incomplete data
          // We need to process the product through scoring and save to Firebase
          handleVerifiedProduct(product, false);
        }}
        onComplete={async (updatedProduct, editedFields) => {
          console.log('[Scan] User completed verification with edits:', editedFields);
          console.log('[Scan] Updated product nutriments:', JSON.stringify(updatedProduct.nutriments || {}, null, 2));
          setShowVerificationModal(false);
          
          // Save verified product to Firebase and navigate
          handleVerifiedProduct(updatedProduct, true);
        }}
        onCancel={() => {
          console.log('[Scan] User cancelled verification');
          setShowVerificationModal(false);
          
          // Reset scan state to allow scanning again
          setScanned(false);
          setProductToVerify(null);
          setScanningCooldown(false);
          setLoading(false);
        }}
      />
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