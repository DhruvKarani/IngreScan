// SCORE_API_URL: set this to the scoring API endpoint reachable by your app.
// - For Android emulator: use 10.0.2.2 (maps to host localhost)
// - For a physical phone (Expo Go): set to your computer's LAN IP, e.g. http://192.168.1.100:5000/analyze
// - For local desktop testing (if app runs on same host): use http://127.0.0.1:5000/analyze

// Auto-detect the appropriate API URL based on environment
const getScoreApiUrl = () => {
  // For Expo Go on mobile device, use LAN IP
  if (__DEV__ && typeof navigator !== 'undefined') {
    return 'http://192.168.0.100:5000/analyze';
  }
  // For web production build (bundled)
  if (typeof window !== 'undefined') {
    return 'http://127.0.0.1:5000/analyze';
  }
  // For Android emulator
  return 'http://10.0.2.2:5000/analyze';
};

export const SCORE_API_URL = getScoreApiUrl();

// Gemini API Configuration
// Replace with your actual Gemini API key from Google AI Studio
export const GEMINI_API_KEY = 'AIzaSyBiA_1yzO2kyDcq1JIgOqC-XyWVNuHk124';
export const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
