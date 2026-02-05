// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithEmailAndPassword, signInWithCredential, initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
// For React Native, initializeAuth with AsyncStorage persistence so auth state persists across restarts
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();