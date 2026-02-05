// Test file to manually trigger notifications for testing
// This would normally be integrated into the app for testing purposes

import notificationService from '../src/utils/notificationService';

// Test function to simulate hitting 75% of sugar limit
export const testSugarAlert = async () => {
  await notificationService.initialize();
  
  // Simulate 75% sugar limit (15g limit, 11.25g consumed)
  await notificationService.sendIntakeLimitAlert('sugar', 18.75, 25, 75);
};

// Test function to simulate hitting 90% of sodium limit
export const testSodiumAlert = async () => {
  await notificationService.initialize();
  
  // Simulate 90% sodium limit (2000mg limit, 1800mg consumed)  
  await notificationService.sendIntakeLimitAlert('sodium', 1800, 2000, 90);
};

// Test daily reminder
export const testDailyReminder = async () => {
  await notificationService.initialize();
  await notificationService.sendDailyReminder();
};

// Test full intake object
export const testFullIntakeCheck = async () => {
  await notificationService.initialize();
  
  const testIntake = {
    sugar: { current: 19, limit: 25 }, // 76%
    carbs: { current: 190, limit: 250 }, // 76%  
    sodium: { current: 1600, limit: 2000 }, // 80%
    calories: { current: 1500, limit: 2000 }, // 75%
    caffeine: { current: 320, limit: 400 }, // 80%
    saturated_fat: { current: 14, limit: 20 }, // 70% - shouldn't trigger
  };
  
  await notificationService.checkIntakeLimits(testIntake);
};