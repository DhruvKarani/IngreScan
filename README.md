IngreScan – Ingredient Awareness App

IngreScan is a barcode-based food awareness app designed to help people make informed choices about what they eat.
Unlike calorie or fitness trackers, IngreScan focuses on ingredient transparency and health impact:

📊 Health Score (1–10) – simple numeric rating of overall product healthiness.

🏷 Consumption Tier – Daily, Weekly, Occasional, or Avoid, for easy decision-making.

⚠ Smart Warnings – flags excess sugar, preservatives, stabilizers, and allergens.

👤 Personalized Feedback – adapts results based on user’s health profile (e.g., diabetes, allergies).

🥗 Ingredient Awareness – highlights what you’re really consuming, not just numbers on the nutrition label.

The goal: make food choices simpler, safer, and healthier by turning complex nutrition and ingredient data into clear, actionable insights.
---

## 🚨 Troubleshooting Network Issues

### "Network request failed" Error?

This happens when your device can't reach the ML scoring server. **Most common cause:** Your computer's IP address changed.

#### Quick Fix:

1. **Find your current IP:**
   ```powershell
   # Run this in PowerShell:
   .\check-ip.ps1
   # Or manually:
   ipconfig
   ```
   Look for "IPv4 Address" under WiFi/Ethernet (e.g., `192.168.0.104`)

2. **Update the IP in config:**
   Open `src/constants/config.js` and change line 15:
   ```javascript
   const SERVER_LAN_IP = '192.168.0.104'; // 👈 Put your IP here
   ```

3. **Restart both:**
   - Restart the Python server: `python server/score_api.py`
   - Restart your Expo app (might need to clear cache: `r` in Expo terminal)

#### When do you need to update the IP?
- ✅ After connecting to a different WiFi network
- ✅ After restarting your router
- ✅ When running the server on a different computer
- ✅ When the IP changes (if using DHCP)

#### Pro tip: Set a static IP
Configure your router to always give your computer the same IP address (called "DHCP reservation") to avoid this issue.