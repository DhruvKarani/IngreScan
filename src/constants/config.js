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
// Current setup: Server IP = 192.168.0.104 (update this if it changes!)
// ============================================================================

const SERVER_LAN_IP = '192.168.0.104'; // 👈 CHANGE THIS TO YOUR COMPUTER'S IP

// Auto-detect the appropriate API URL based on environment
const getScoreApiUrl = () => {
  // For Expo Go on mobile device, use LAN IP
  if (__DEV__ && typeof navigator !== 'undefined') {
    return `http://${SERVER_LAN_IP}:5000/analyze`;
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
