// ============================================================================
// 🔧 CONFIGURE YOUR SERVER IP HERE
// ============================================================================
// IMPORTANT: Update this IP address when your network or device changes!
// 
// How to find your IP:
// - Windows: Run "ipconfig" in terminal, look for "IPv4 Address"
// - Mac/Linux: Run "ifconfig" or "ip addr", look for inet address
// - The IP starts with 192.168.x.x or 10.0.x.x
//
// Current setup: Server IP = 192.168.0.105 (update this if it changes!)
// ============================================================================

export const SERVER_LAN_IP = '192.168.0.105'; // 👈 CHANGE THIS TO YOUR COMPUTER'S IP

// Auto-detect the appropriate API URL based on environment
const getScoreApiUrl = () => {
  // For Expo Go on mobile device, use LAN IP
  if (__DEV__ && typeof navigator !== 'undefined') {
    return `http://${SERVER_LAN_IP}:5001/analyze`;
  }
  // For web production build (bundled)
  if (typeof window !== 'undefined') {
    return 'http://127.0.0.1:5001/analyze';
  }
  // For Android emulator
  return 'http://10.0.2.2:5001/analyze';
};

export const SCORE_API_URL = getScoreApiUrl();

// Gemini API Configuration
// Replace with your actual Gemini API key from Google AI Studio
// Gemini API Configuration
// IMPORTANT: Do NOT hardcode API keys in public repositories.
// Use environment variables or a secure config file (excluded via .gitignore).
// Example for React Native (with react-native-dotenv):
//   import { GEMINI_API_KEY } from '@env';
// For Node.js: process.env.GEMINI_API_KEY
// Fallback to empty string if not set.
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
export const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
