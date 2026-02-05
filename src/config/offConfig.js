// Configuration for OpenFoodFacts integration.
// Provide your API key via an environment variable or edit this file.

// Recommended: set EXPO_PUBLIC_OFF_API_KEY in your environment (Expo publishes env variables
// prefixed with EXPO_PUBLIC_ to the client). This file will read that first.

export const OFF_API_KEY = (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_OFF_API_KEY) ? process.env.EXPO_PUBLIC_OFF_API_KEY : '';

// Alternative: you can hard-code your key here for local testing, e.g.:
// export const OFF_API_KEY = 'your_off_api_key_here';

export default { OFF_API_KEY };
