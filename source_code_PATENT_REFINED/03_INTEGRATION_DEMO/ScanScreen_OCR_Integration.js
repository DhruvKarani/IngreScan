// Enhanced ScanScreen.js excerpt showing OCR integration
// This demonstrates how OCR is integrated into the existing scanning flow

import OCRProcessor from '../utils/ocrProcessor';

// ... existing imports and component setup ...

const ScanScreen = ({ navigation }) => {
  // ... existing state variables ...
  const [ocrProcessor] = useState(() => new OCRProcessor());
  const [showOCROptions, setShowOCROptions] = useState(false);

  // ... existing useEffect and helper functions ...

  const handleBarCodeScanned = async ({ type, data }) => {
    // ... existing barcode processing ...

    try {
      setLoading(true);
      const barcodeKey = data.replace(/\D/g, '') || data;

      // TIER 1: Check Firebase database first
      const productRef = doc(db, 'products', barcodeKey);
      let productSnap = await getDoc(productRef);
      
      if (productSnap.exists()) {
        // Product found in Firebase - use cached analysis
        product = productSnap.data();
        product._source = 'firebase';
      } else {
        // TIER 2: Try Open Food Facts API
        const offProduct = await fetchProductFromOFF(barcodeKey);
        
        if (offProduct) {
          // Product found in OFF - process and cache
          product = normalizeOFFData(offProduct);
          product._source = 'openfoodfacts';
        } else {
          // TIER 3: Product not found anywhere - offer OCR
          Alert.alert(
            'Product Not Found',
            'This product is not in our database. How would you like to add it?',
            [
              {
                text: 'Take Photo (OCR)',
                onPress: () => handleOCRCapture(barcodeKey),
              },
              {
                text: 'Manual Entry',
                onPress: () => navigation.navigate('ManualProductEntry', { barcode: barcodeKey }),
              },
              {
                text: 'Cancel',
                onPress: () => setScanningCooldown(false),
                style: 'cancel'
              }
            ]
          );
          return;
        }
      }

      // Process the product through personalized scoring
      await analyzeAndDisplayProduct(product, barcodeKey);

    } catch (error) {
      console.error('Scan processing error:', error);
      Alert.alert('Error', 'Failed to process product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle OCR capture process - Core Innovation
   * Guides user through capturing ingredient and nutrition photos
   */
  const handleOCRCapture = async (barcodeKey) => {
    try {
      // Get user profile for condition-aware parsing
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      const userProfile = userSnap.data() || {};

      // Guide user through photo capture sequence
      const captureResult = await navigation.navigate('OCRCapture', {
        barcode: barcodeKey,
        userProfile: userProfile,
        onComplete: async (imageUris) => {
          await processOCRImages(imageUris, barcodeKey, userProfile);
        }
      });

    } catch (error) {
      console.error('OCR capture failed:', error);
      Alert.alert('OCR Error', 'Failed to process images. Please try manual entry.');
      navigation.navigate('ManualProductEntry', { barcode: barcodeKey });
    }
  };

  /**
   * Process OCR images with condition-aware analysis
   * Core personalization innovation
   */
  const processOCRImages = async (imageUris, barcodeKey, userProfile) => {
    try {
      setLoading(true);
      
      // Process images through OCR with health condition awareness
      const ocrResult = await ocrProcessor.processProductImages(imageUris, userProfile);
      
      if (ocrResult.error) {
        throw new Error(ocrResult.message);
      }

      // Apply health rules penalties to OCR data
      const healthPenalties = ocrProcessor.applyHealthRulesPenalties(ocrResult, userProfile);
      
      // Create normalized product object
      const product = {
        product_name: `OCR Product ${barcodeKey}`,
        ingredients_text: ocrResult.ingredients.join(', '),
        ingredients: ocrResult.ingredients.map(name => ({ name })),
        allergens: ocrResult.allergens?.detected || [],
        nutriments: ocrResult.nutrients,
        _source: 'ocr',
        _confidence: ocrResult.confidence,
        _ocrPenalties: healthPenalties,
        barcode: barcodeKey,
        created_at: new Date().toISOString()
      };

      // Save OCR product to Firebase for future use
      const productRef = doc(db, 'products', barcodeKey);
      await setDoc(productRef, product);

      // Analyze product with personalized scoring
      await analyzeAndDisplayProduct(product, barcodeKey);

      // Show OCR success feedback
      Alert.alert(
        'Product Added Successfully',
        `Extracted via OCR with ${ocrResult.confidence} confidence. Data saved for future scans.`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('OCR processing failed:', error);
      Alert.alert(
        'OCR Processing Failed', 
        'Could not extract product information from images. Would you like to try manual entry?',
        [
          {
            text: 'Manual Entry',
            onPress: () => navigation.navigate('ManualProductEntry', { barcode: barcodeKey })
          },
          {
            text: 'Cancel',
            onPress: () => setScanningCooldown(false),
            style: 'cancel'
          }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Analyze product with personalized health scoring
   * Works regardless of data source (Firebase/OFF/OCR)
   */
  const analyzeAndDisplayProduct = async (product, barcodeKey) => {
    try {
      // Get user's health profile
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      const userProfile = userSnap.data() || {};

      // Apply personalized scoring algorithm
      const analysis = await computeProductAnalysis(product, {
        allergens: userProfile.allergies || [],
        dietaryPreferences: userProfile.dietaryPreferences || [],
        healthConditions: userProfile.healthConditions || []
      });

      // Add OCR-specific penalties if applicable
      if (product._ocrPenalties) {
        analysis.score = Math.max(0, analysis.score - product._ocrPenalties.penalty);
        analysis.personalizedWarnings = [
          ...analysis.personalizedWarnings,
          ...product._ocrPenalties.warnings
        ];
      }

      // Save scan to user history
      await saveToScanHistory(auth.currentUser.uid, {
        barcode: barcodeKey,
        product: product,
        analysis: analysis,
        source: product._source,
        confidence: product._confidence || 'HIGH',
        timestamp: serverTimestamp()
      });

      // Navigate to results with personalized analysis
      navigation.navigate('ProductDetails', {
        product: product,
        analysis: analysis,
        barcode: barcodeKey,
        source: product._source
      });

      // Award points for scanning
      await awardScanPoints();

    } catch (error) {
      console.error('Product analysis failed:', error);
      Alert.alert('Analysis Error', 'Could not analyze product. Please try again.');
    }
  };

  // ... rest of component ...
};

export default ScanScreen;