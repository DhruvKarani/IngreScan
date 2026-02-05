import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

class NotificationService {
  constructor() {
    this.isInitialized = false;
    this.notificationKey = 'sent_notifications';
    
    // Configure notification behavior
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }

  // Initialize notification service and request permissions
  async initialize() {
    if (this.isInitialized) return true;

    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
        return false;
      }

      // Configure Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('intake-alerts', {
          name: 'Intake Limit Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
          description: 'Notifications for when you approach your daily nutrition limits',
        });

        await Notifications.setNotificationChannelAsync('daily-reminders', {
          name: 'Daily Reminders',
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250],
          sound: 'default',
          description: 'Daily nutrition tips and reminders',
        });
      }

      this.isInitialized = true;
      console.log('✅ Notification service initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
      return false;
    }
  }

  // Get today's date string for tracking notifications
  getTodayString() {
    return new Date().toISOString().split('T')[0];
  }

  // Check if we already sent a notification for this nutrient today
  async hasNotificationBeenSent(nutrient, threshold) {
    try {
      const today = this.getTodayString();
      const key = `${nutrient}_${threshold}_${today}`;
      const sentNotifications = await AsyncStorage.getItem(this.notificationKey);
      const sent = sentNotifications ? JSON.parse(sentNotifications) : {};
      return sent[key] === true;
    } catch (error) {
      console.error('Error checking notification status:', error);
      return false;
    }
  }

  // Mark notification as sent for this nutrient today
  async markNotificationSent(nutrient, threshold) {
    try {
      const today = this.getTodayString();
      const key = `${nutrient}_${threshold}_${today}`;
      const sentNotifications = await AsyncStorage.getItem(this.notificationKey);
      const sent = sentNotifications ? JSON.parse(sentNotifications) : {};
      
      sent[key] = true;
      await AsyncStorage.setItem(this.notificationKey, JSON.stringify(sent));
      
      // Clean up old notification records (older than 7 days)
      this.cleanupOldNotifications(sent);
    } catch (error) {
      console.error('Error marking notification as sent:', error);
    }
  }

  // Clean up notification records older than 7 days
  async cleanupOldNotifications(sent) {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const cutoffDate = sevenDaysAgo.toISOString().split('T')[0];
      
      const cleaned = {};
      Object.keys(sent).forEach(key => {
        const datePart = key.split('_').pop();
        if (datePart >= cutoffDate) {
          cleaned[key] = sent[key];
        }
      });
      
      await AsyncStorage.setItem(this.notificationKey, JSON.stringify(cleaned));
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
    }
  }

  // Send intake limit alert notification
  async sendIntakeLimitAlert(nutrient, current, limit, percentage) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Check if we already sent a notification for this threshold today
      const threshold = percentage >= 90 ? 90 : 75;
      const alreadySent = await this.hasNotificationBeenSent(nutrient, threshold);
      
      if (alreadySent) {
        console.log(`Notification already sent for ${nutrient} ${threshold}% today`);
        return;
      }

      // Create appropriate message based on nutrient and percentage
      const nutrientNames = {
        sugar: 'sugar',
        carbs: 'carbohydrates', 
        calories: 'calories',
        saturated_fat: 'saturated fat',
        caffeine: 'caffeine',
        sodium: 'sodium'
      };

      const nutrientName = nutrientNames[nutrient] || nutrient;
      const unit = this.getNutrientUnit(nutrient);
      
      let title, body, priority;
      
      if (percentage >= 90) {
        title = `⚠️ ${nutrientName.charAt(0).toUpperCase() + nutrientName.slice(1)} Limit Almost Reached!`;
        body = `You've consumed ${current}${unit} of your ${limit}${unit} daily ${nutrientName} limit (${Math.round(percentage)}%). Consider choosing lower-${nutrientName} options for the rest of the day.`;
        priority = 'high';
      } else if (percentage >= 75) {
        title = `📊 ${nutrientName.charAt(0).toUpperCase() + nutrientName.slice(1)} Alert`;
        body = `You've reached ${Math.round(percentage)}% of your daily ${nutrientName} limit (${current}${unit}/${limit}${unit}). You're doing great tracking your intake!`;
        priority = 'default';
      } else {
        return; // Don't send notification below 75%
      }

      // Send the notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { 
            type: 'intake_alert', 
            nutrient, 
            current, 
            limit, 
            percentage 
          },
          sound: priority === 'high' ? 'default' : false,
          priority: priority === 'high' ? 'high' : 'default',
        },
        trigger: null, // Send immediately
        identifier: `intake_${nutrient}_${threshold}_${Date.now()}`,
      });

      // Mark as sent
      await this.markNotificationSent(nutrient, threshold);
      
      console.log(`📱 Sent ${threshold}% notification for ${nutrient}: ${current}${unit}/${limit}${unit}`);
      
    } catch (error) {
      console.error('Error sending intake limit alert:', error);
    }
  }

  // Get appropriate unit for nutrient
  getNutrientUnit(nutrient) {
    const units = {
      sugar: 'g',
      carbs: 'g', 
      calories: 'kcal',
      saturated_fat: 'g',
      caffeine: 'mg',
      sodium: 'mg'
    };
    return units[nutrient] || '';
  }

  // Check user's notification preferences
  async getUserNotificationPreference() {
    try {
      // Lazy import to avoid circular dependencies
      const { auth, db } = await import('../firebase');
      const { doc, getDoc } = await import('firebase/firestore');
      
      const user = auth.currentUser;
      if (!user) return true; // Default to true if no user
      
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        return userData.notifications !== false; // Default to true
      }
      
      return true; // Default for new users
    } catch (error) {
      console.error('Error checking user notification preference:', error);
      return true; // Default to true on error
    }
  }

  // Check all nutrients in daily intake and send alerts if needed
  async checkIntakeLimits(dailyIntake) {
    if (!dailyIntake || typeof dailyIntake !== 'object') return;

    try {
      // Check if user has notifications enabled
      const notificationsEnabled = await this.getUserNotificationPreference();
      if (!notificationsEnabled) {
        console.log('📵 Notifications disabled by user');
        return;
      }

      const nutrientsToCheck = ['sugar', 'carbs', 'calories', 'saturated_fat', 'caffeine', 'sodium'];
      
      for (const nutrient of nutrientsToCheck) {
        const intakeData = dailyIntake[nutrient];
        if (!intakeData || !intakeData.current || !intakeData.limit) continue;

        const current = intakeData.current;
        const limit = intakeData.limit;
        const percentage = (current / limit) * 100;

        // Send notification if 75% or 90% threshold is crossed
        if (percentage >= 75) {
          await this.sendIntakeLimitAlert(nutrient, current, limit, percentage);
        }
      }
    } catch (error) {
      console.error('Error checking intake limits:', error);
    }
  }

  // Send daily reminder notification
  async sendDailyReminder(message = "Don't forget to track your meals today! Scan products to monitor your nutrition.") {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🍎 Daily Nutrition Reminder',
          body: message,
          data: { type: 'daily_reminder' },
        },
        trigger: null,
      });
      
      console.log('📱 Sent daily reminder notification');
    } catch (error) {
      console.error('Error sending daily reminder:', error);
    }
  }

  // Schedule daily reminders
  async scheduleDailyReminders() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Cancel existing daily reminders
      await Notifications.cancelScheduledNotificationAsync('daily-reminder');

      // Schedule for 8 AM daily
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌅 Good Morning!',
          body: "Start your day by tracking your breakfast. Make healthy choices!",
          data: { type: 'daily_reminder' },
        },
        trigger: {
          hour: 8,
          minute: 0,
          repeats: true,
        },
        identifier: 'daily-reminder',
      });

      console.log('📅 Scheduled daily reminder notifications');
    } catch (error) {
      console.error('Error scheduling daily reminders:', error);
    }
  }

  // Cancel all notifications
  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('❌ Cancelled all notifications');
    } catch (error) {
      console.error('Error cancelling notifications:', error);
    }
  }
}

// Export singleton instance
export default new NotificationService();