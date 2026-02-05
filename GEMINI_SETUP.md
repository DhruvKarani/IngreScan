# Gemini API Setup Guide

This guide will help you set up the Google Gemini API to get enhanced ingredient descriptions and filtering in your IngreScan app.

## Step 1: Get a Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

## Step 2: Configure the API Key

1. Open `src/constants/config.js`
2. Replace `'YOUR_GEMINI_API_KEY_HERE'` with your actual API key:

```javascript
export const GEMINI_API_KEY = "your-actual-api-key-here";
```

## Step 3: Test the Integration

1. Start your app
2. Scan a product or view product details
3. Go to the "Ingredients" tab
4. You should see:
   - Loading indicator while analyzing ingredients
   - Only food ingredients displayed (non-food items filtered out)
   - Enhanced descriptions for each ingredient
   - Risk levels and health impacts
   - Better categorization (natural, preservative, additive, etc.)

## Features Added

### Enhanced Nutritional Table

- ✅ Comprehensive unit display (g, mg, kcal, µg, etc.)
- ✅ Proper categorization of nutrients (energy, macros, vitamins, minerals)
- ✅ Better formatting and ordering

### Smart Ingredient Analysis

- ✅ **Food ingredient filtering**: Non-food items (packaging, warnings, etc.) are automatically removed
- ✅ **AI-powered descriptions**: Each ingredient gets a detailed description
- ✅ **Risk assessment**: Ingredients are categorized as LOW, MEDIUM, or HIGH risk
- ✅ **Health impact information**: Detailed health effects for each ingredient
- ✅ **Better categorization**: Natural, preservative, additive, sweetener, etc.
- ✅ **Fallback support**: Works even without API key (basic analysis)

## API Usage Notes

- The Gemini API is called once per product when viewing ingredients
- Results are cached during the session
- If the API fails or is not configured, the app falls back to basic ingredient analysis
- API calls are rate-limited by Google (free tier has generous limits)

## Troubleshooting

### "Could not analyze ingredients" error

- Check your API key is correct
- Ensure you have internet connection
- Verify the API key has proper permissions

### Ingredients still showing non-food items

- The fallback mode has basic filtering
- Configure the Gemini API key for advanced filtering

### Loading takes too long

- The first analysis may take 3-5 seconds
- Subsequent views are faster due to caching
- Consider upgrading to paid tier for faster responses

## Cost Information

- Google Gemini API has a generous free tier
- Typical usage for ingredient analysis is very low cost
- Monitor usage in [Google AI Studio](https://makersuite.google.com/app/apikey)

## Security Note

- Never commit your API key to version control
- Consider using environment variables in production
- The API key is stored in plain text in the config file (for development only)
