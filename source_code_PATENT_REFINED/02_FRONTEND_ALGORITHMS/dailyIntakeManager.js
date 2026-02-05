import AsyncStorage from '@react-native-async-storage/async-storage';
import notificationService from './notificationService';

class DailyIntakeManager {
  constructor() {
    this.storageKey = 'daily_intake_data';
    this.lastUpdateKey = 'intake_last_update';
    this.userLimitsKey = 'user_custom_limits';
    
    // Default healthy limits
    this.healthyLimits = {
      sugar: { limit: 25, unit: 'g', color: '#FF9800' },
      carbs: { limit: 250, unit: 'g', color: '#1976D2' },
      calories: { limit: 2000, unit: 'kcal', color: '#2196F3' },
      saturated_fat: { limit: 20, unit: 'g', color: '#1565C0' },
      caffeine: { limit: 400, unit: 'mg', color: '#0D47A1' },
      sodium: { limit: 2000, unit: 'mg', color: '#FF5722' },
    };
    
    // Condition-specific adjustments (multiple variations for each condition)
    this.conditionAdjustments = {
      // Diabetes variations
      diabetes: {
        sugar: { limit: 15, unit: 'g', color: '#FF9800' },
        carbs: { limit: 150, unit: 'g', color: '#1976D2' },
      },
      diabetic: {
        sugar: { limit: 15, unit: 'g', color: '#FF9800' },
        carbs: { limit: 150, unit: 'g', color: '#1976D2' },
      },
      'Diabetes': {
        sugar: { limit: 15, unit: 'g', color: '#FF9800' },
        carbs: { limit: 150, unit: 'g', color: '#1976D2' },
      },
      // High BP variations
      high_bp: {
        sodium: { limit: 1500, unit: 'mg', color: '#FF5722' },
      },
      'High Blood Pressure': {
        sodium: { limit: 1500, unit: 'mg', color: '#FF5722' },
      },
      // Heart risk variations
      heart_risk: {
        saturated_fat: { limit: 13, unit: 'g', color: '#1565C0' },
      },
      high_cholesterol: {
        saturated_fat: { limit: 13, unit: 'g', color: '#1565C0' },
      },
      'High Cholesterol': {
        saturated_fat: { limit: 13, unit: 'g', color: '#1565C0' },
      },
      // Pregnancy variations
      pregnant: {
        caffeine: { limit: 200, unit: 'mg', color: '#0D47A1' },
      },
      'Pregnant': {
        caffeine: { limit: 200, unit: 'mg', color: '#0D47A1' },
      },
    };
    
    // Current active limits (will be set based on user conditions)
    this.dailyLimits = { ...this.healthyLimits };
  }

  // Get today's date as string (YYYY-MM-DD)
  getTodayString() {
    return new Date().toISOString().split('T')[0];
  }

  // Apply condition-specific limits based on user's health conditions
  async applyConditionLimits(userConditions = []) {
    try {
      console.log('🔍 Applying conditions:', userConditions);
      console.log('📋 Available condition keys:', Object.keys(this.conditionAdjustments));
      
      // Start with healthy limits
      let adjustedLimits = { ...this.healthyLimits };
      let appliedConditions = [];
      
      // Apply condition-specific adjustments with fuzzy matching
      userConditions.forEach(condition => {
        console.log('🔎 Checking condition:', condition);
        
        // Try exact match first
        if (this.conditionAdjustments[condition]) {
          console.log('✅ Exact match found for:', condition);
          Object.keys(this.conditionAdjustments[condition]).forEach(nutrient => {
            adjustedLimits[nutrient] = {
              ...adjustedLimits[nutrient],
              ...this.conditionAdjustments[condition][nutrient]
            };
          });
          appliedConditions.push(condition);
        }
        // Try case-insensitive and fuzzy matching
        else {
          const conditionLower = condition.toLowerCase();
          let matched = false;
          
          Object.keys(this.conditionAdjustments).forEach(key => {
            if (!matched && (
              key.toLowerCase() === conditionLower ||
              key.toLowerCase().includes(conditionLower) ||
              conditionLower.includes(key.toLowerCase())
            )) {
              console.log('✅ Fuzzy match found:', condition, '->', key);
              Object.keys(this.conditionAdjustments[key]).forEach(nutrient => {
                adjustedLimits[nutrient] = {
                  ...adjustedLimits[nutrient],
                  ...this.conditionAdjustments[key][nutrient]
                };
              });
              appliedConditions.push(key);
              matched = true;
            }
          });
          
          if (!matched) {
            console.log('❌ No match found for condition:', condition);
          }
        }
      });
      
      // Load any user-customized limits
      const customLimits = await this.getUserCustomLimits();
      if (customLimits) {
        console.log('🎛️ Applying custom limits:', customLimits);
        Object.keys(customLimits).forEach(nutrient => {
          if (adjustedLimits[nutrient]) {
            adjustedLimits[nutrient].limit = customLimits[nutrient];
          }
        });
      }
      
      this.dailyLimits = adjustedLimits;
      
      console.log('🎯 Applied conditions:', appliedConditions);
      console.log('📊 Final limits:', {
        sugar: adjustedLimits.sugar?.limit,
        carbs: adjustedLimits.carbs?.limit,
        sodium: adjustedLimits.sodium?.limit
      });
      
      return adjustedLimits;
    } catch (error) {
      console.log('❌ Error applying condition limits:', error);
      this.dailyLimits = { ...this.healthyLimits };
      return this.dailyLimits;
    }
  }

  // Get user's custom limit adjustments
  async getUserCustomLimits() {
    try {
      const stored = await AsyncStorage.getItem(this.userLimitsKey);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.log('Error getting user custom limits:', error);
      return null;
    }
  }

  // Save user's custom limit adjustments
  async saveUserCustomLimits(customLimits) {
    try {
      await AsyncStorage.setItem(this.userLimitsKey, JSON.stringify(customLimits));
      console.log('Saved user custom limits:', customLimits);
    } catch (error) {
      console.log('Error saving user custom limits:', error);
      throw error;
    }
  }

  // Update a specific nutrient limit
  async updateNutrientLimit(nutrient, newLimit) {
    try {
      const customLimits = await this.getUserCustomLimits() || {};
      customLimits[nutrient] = newLimit;
      await this.saveUserCustomLimits(customLimits);
      
      // Update current active limits
      if (this.dailyLimits[nutrient]) {
        this.dailyLimits[nutrient].limit = newLimit;
      }
      
      return true;
    } catch (error) {
      console.log('Error updating nutrient limit:', error);
      throw error;
    }
  }

  // Check if we need to reset daily intake (new day)
  async shouldResetDaily() {
    try {
      const lastUpdate = await AsyncStorage.getItem(this.lastUpdateKey);
      return lastUpdate !== this.getTodayString();
    } catch (error) {
      console.log('Error checking last update:', error);
      return true;
    }
  }

  // Initialize daily intake (reset to 0 if new day)
  async initializeDailyIntake(userConditions = []) {
    try {
      // Apply condition-specific limits first
      await this.applyConditionLimits(userConditions);
      
      const shouldReset = await this.shouldResetDaily();
      
      if (shouldReset) {
        // Reset all intakes to 0 for new day
        const freshIntake = {};
        Object.keys(this.dailyLimits).forEach(nutrient => {
          freshIntake[nutrient] = { 
            current: 0, 
            ...this.dailyLimits[nutrient]
          };
        });
        
        await AsyncStorage.setItem(this.storageKey, JSON.stringify(freshIntake));
        await AsyncStorage.setItem(this.lastUpdateKey, this.getTodayString());
        
        console.log('Reset daily intake for:', this.getTodayString());
        return freshIntake;
      } else {
        // Load existing intake but update limits
        const existingIntake = await this.getDailyIntake();
        
        // Update limits while preserving current values
        const updatedIntake = {};
        Object.keys(this.dailyLimits).forEach(nutrient => {
          updatedIntake[nutrient] = {
            current: existingIntake[nutrient]?.current || 0,
            ...this.dailyLimits[nutrient]
          };
        });
        
        await AsyncStorage.setItem(this.storageKey, JSON.stringify(updatedIntake));
        return updatedIntake;
      }
    } catch (error) {
      console.log('Error initializing daily intake:', error);
      // Fallback: return fresh intake
      const freshIntake = {};
      Object.keys(this.dailyLimits).forEach(nutrient => {
        freshIntake[nutrient] = { 
          current: 0, 
          ...this.dailyLimits[nutrient]
        };
      });
      return freshIntake;
    }
  }

  // Get current daily intake data
  async getDailyIntake() {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      } else {
        // Initialize if no data exists
        return await this.initializeDailyIntake();
      }
    } catch (error) {
      console.log('Error getting daily intake:', error);
      return await this.initializeDailyIntake();
    }
  }

  // Add consumed nutrition to daily intake
  async addToIntake(productNutrition) {
    try {
      let currentIntake = await this.getDailyIntake();
      
      // Extract relevant nutrients from product and add to current intake
      const updates = {};
      
      // Map product nutrition keys to our tracking keys
      const nutritionMapping = {
        sugar: ['sugar', 'sugars', 'sugar_100g', 'sugars_100g'],
        carbs: ['carbohydrates', 'carbs', 'carbohydrates_100g', 'carbs_100g', 'carbohydrate'],
        calories: ['energy', 'calories', 'energy_kcal', 'energy_kcal_100g', 'kcal'],
        saturated_fat: ['saturated_fat', 'saturated_fat_100g', 'saturated-fat', 'sat_fat'],
        caffeine: ['caffeine', 'caffeine_100g'],
        sodium: ['sodium', 'sodium_100g', 'salt'] // Note: salt needs conversion (salt * 0.4 = sodium)
      };

      Object.keys(nutritionMapping).forEach(ourKey => {
        const possibleKeys = nutritionMapping[ourKey];
        let value = 0;
        
        // Find the nutrition value from product
        for (const key of possibleKeys) {
          if (productNutrition[key] !== undefined && productNutrition[key] !== null) {
            value = parseFloat(productNutrition[key]) || 0;
            
            // Special handling for salt to sodium conversion
            if (key === 'salt' && ourKey === 'sodium') {
              value = value * 0.4; // Convert salt to sodium
            }
            
            break;
          }
        }
        
        if (value > 0) {
          updates[ourKey] = value;
        }
      });

      // Update current intake
      Object.keys(updates).forEach(nutrient => {
        if (currentIntake[nutrient]) {
          currentIntake[nutrient].current += updates[nutrient];
        }
      });

      // Save updated intake
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(currentIntake));
      
      // Check for notification alerts (75%+ thresholds)
      try {
        await notificationService.checkIntakeLimits(currentIntake);
      } catch (notifyError) {
        console.log('Error checking intake limits for notifications:', notifyError);
        // Don't throw - intake update should still succeed even if notifications fail
      }
      
      console.log('Added to daily intake:', updates);
      return currentIntake;
      
    } catch (error) {
      console.log('Error adding to intake:', error);
      throw error;
    }
  }

  // Remove consumed nutrition from daily intake (if user changes mind)
  async removeFromIntake(productNutrition) {
    try {
      let currentIntake = await this.getDailyIntake();
      
      // Same mapping as addToIntake but subtract instead
      const nutritionMapping = {
        sugar: ['sugar', 'sugars', 'sugar_100g', 'sugars_100g'],
        carbs: ['carbohydrates', 'carbs', 'carbohydrates_100g', 'carbs_100g', 'carbohydrate'],
        calories: ['energy', 'calories', 'energy_kcal', 'energy_kcal_100g', 'kcal'],
        saturated_fat: ['saturated_fat', 'saturated_fat_100g', 'saturated-fat', 'sat_fat'],
        caffeine: ['caffeine', 'caffeine_100g'],
        sodium: ['sodium', 'sodium_100g', 'salt']
      };

      const updates = {};
      
      Object.keys(nutritionMapping).forEach(ourKey => {
        const possibleKeys = nutritionMapping[ourKey];
        let value = 0;
        
        for (const key of possibleKeys) {
          if (productNutrition[key] !== undefined && productNutrition[key] !== null) {
            value = parseFloat(productNutrition[key]) || 0;
            
            if (key === 'salt' && ourKey === 'sodium') {
              value = value * 0.4;
            }
            
            break;
          }
        }
        
        if (value > 0) {
          updates[ourKey] = value;
        }
      });

      // Subtract from current intake (don't go below 0)
      Object.keys(updates).forEach(nutrient => {
        if (currentIntake[nutrient]) {
          currentIntake[nutrient].current = Math.max(0, currentIntake[nutrient].current - updates[nutrient]);
        }
      });

      await AsyncStorage.setItem(this.storageKey, JSON.stringify(currentIntake));
      
      console.log('Removed from daily intake:', updates);
      return currentIntake;
      
    } catch (error) {
      console.log('Error removing from intake:', error);
      throw error;
    }
  }

  // Get formatted intake data for display
  getFormattedIntake(intakeData) {
    const formatted = {};
    
    Object.keys(intakeData).forEach(nutrient => {
      const data = intakeData[nutrient];
      const percentage = Math.round((data.current / data.limit) * 100);
      
      formatted[nutrient] = {
        ...data,
        percentage,
        displayText: `${Math.round(data.current * 10) / 10}${data.unit} / ${data.limit}${data.unit} (${percentage}%)`,
        isOverLimit: percentage > 100
      };
    });
    
    return formatted;
  }

  // Reset intake (for testing or manual reset)
  async resetIntake() {
    try {
      const freshIntake = {};
      Object.keys(this.dailyLimits).forEach(nutrient => {
        freshIntake[nutrient] = { 
          current: 0, 
          ...this.dailyLimits[nutrient]
        };
      });
      
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(freshIntake));
      await AsyncStorage.setItem(this.lastUpdateKey, this.getTodayString());
      
      return freshIntake;
    } catch (error) {
      console.log('Error resetting intake:', error);
      throw error;
    }
  }

  // Get the current limits being used
  getCurrentLimits() {
    return { ...this.dailyLimits };
  }

  // Get healthy (default) limits
  getHealthyLimits() {
    return { ...this.healthyLimits };
  }

  // Get condition-specific recommendations
  getConditionLimits(userConditions = []) {
    let conditionLimits = { ...this.healthyLimits };
    
    userConditions.forEach(condition => {
      if (this.conditionAdjustments[condition]) {
        Object.keys(this.conditionAdjustments[condition]).forEach(nutrient => {
          conditionLimits[nutrient] = {
            ...conditionLimits[nutrient],
            ...this.conditionAdjustments[condition][nutrient]
          };
        });
      }
    });
    
    return conditionLimits;
  }

  // Reset user customizations
  async resetCustomLimits() {
    try {
      await AsyncStorage.removeItem(this.userLimitsKey);
      console.log('Reset user custom limits');
    } catch (error) {
      console.log('Error resetting custom limits:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const dailyIntakeManager = new DailyIntakeManager();
export default dailyIntakeManager;