// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithEmailAndPassword, signInWithCredential, initializeAuth, getReactNativePersistence, browserLocalPersistence } from "firebase/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Firebase configuration. Keep secrets out of source control by using local env values.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "ingrescandb.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "ingrescandb",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "ingrescandb.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "",
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || ""
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Platform-specific Auth initialization
console.log('[FIREBASE] Initialization starting...');
let firebaseAuth;
try {
  if (Platform.OS === 'web') {
    console.log('[FIREBASE] Using web initialization...');
    firebaseAuth = initializeAuth(app, {
      persistence: browserLocalPersistence
    });
  } else {
    console.log('[FIREBASE] Using native initialization...');
    firebaseAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  }
  console.log('[FIREBASE] Auth initialized successfully');
} catch (e) {
  console.error('[FIREBASE] Init Error:', e.message);
}

export const auth = firebaseAuth;
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();