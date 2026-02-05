// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithEmailAndPassword, signInWithCredential, initializeAuth, getReactNativePersistence, browserLocalPersistence } from "firebase/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCPDs8UVvGT4sZ-WiocBfpvED7eQAxz90k",
  authDomain: "ingrescandb.firebaseapp.com",
  projectId: "ingrescandb",
  storageBucket: "ingrescandb.firebasestorage.app",
  messagingSenderId: "231835824499",
  appId: "1:231835824499:web:734fb4f178ee9c15c1d506",
  measurementId: "G-M6BERKKPFR"
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