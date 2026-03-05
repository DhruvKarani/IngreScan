import React, { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';

// Import navigators and screens
import TabNavigator from './TabNavigator';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ProductDetailsScreen from '../screens/ProductDetailsScreen';
import ManualProductEntryScreen from '../screens/ManualProductEntryScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import RewardsStoreScreen from '../screens/RewardsStoreScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ContactUsScreen from '../screens/ContactUsScreen';
import TermsPrivacyScreen from '../screens/TermsPrivacyScreen';
import ReferEarnScreen from '../screens/ReferEarnScreen';
import FaqChatScreen from '../screens/FaqChatScreen';
import ScanDetailsScreen from '../screens/ScanDetailsScreen';
import MyReviewsScreen from '../screens/MyReviewsScreen';
import LabelGuideScreen from '../screens/LabelGuideScreen';
import NutritionGoalDetailScreen from '../screens/NutritionGoalDetailScreen';
import NutritionGoalsOverviewScreen from '../screens/NutritionGoalsOverviewScreen';
import FoodCategoryRiskGuideScreen from '../screens/FoodCategoryRiskGuideScreen';
import FoodCategoriesOverviewScreen from '../screens/FoodCategoriesOverviewScreen';
import MythsFactsScreen from '../screens/MythsFactsScreen';
import DailyNutritionTipsScreen from '../screens/DailyNutritionTipsScreen';

// Import theme
import { COLORS } from '../constants/theme';
import notificationService from '../utils/notificationService';

const Stack = createStackNavigator();

const AuthLoading = () => null;

const AppNavigator = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let unsubAuth = null;
    let unsubUserDoc = null;
    // lazy import to avoid circular imports
    const { auth, db } = require('../firebase');
    const { onAuthStateChanged } = require('firebase/auth');
    const { doc, getDoc } = require('firebase/firestore');

    unsubAuth = onAuthStateChanged(auth, async (user) => {
      console.log('[NAVIGATOR] Auth state changed. User:', user ? user.email : 'None');
      if (user) {
        setIsAuthenticated(true);

        // Initialize notification service for authenticated users (Skip on Web as it can hang)
        if (Platform.OS !== 'web') {
          try {
            const notificationInitialized = await notificationService.initialize();
            if (notificationInitialized) {
              console.log('✅ Notifications ready for user:', user.uid);
              // Setup daily reminders
              await notificationService.scheduleDailyReminders();
            }
          } catch (notifyError) {
            console.warn('Failed to initialize notifications:', notifyError.message);
          }
        } else {
          console.log('ℹ️ Skipping notifications on web');
        }

        // check user doc to see if onboarding needed
        try {
          const ref = doc(db, 'users', user.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const data = snap.data();
            // if user has no profile selections, show onboarding
            const missingPrefs = !(data.healthConditions || data.dietaryPreferences || data.allergens);
            setNeedsOnboarding(!!missingPrefs);
          } else {
            setNeedsOnboarding(true);
          }
        } catch (err) {
          console.warn('Error checking user doc for onboarding', err.message);
          setNeedsOnboarding(true);
        }
      } else {
        setIsAuthenticated(false);
        setNeedsOnboarding(false);
      }
      setAuthChecked(true);
    });

    return () => {
      if (unsubAuth) unsubAuth();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  const handleLogin = () => setIsAuthenticated(true);
  const handleSignup = () => setIsAuthenticated(true);

  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor={COLORS.primary} />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      >
        {!authChecked ? (
          // You can show a loading screen here while auth state is checked
          <Stack.Screen name="AuthLoading" component={AuthLoading} />
        ) : !isAuthenticated ? (
          // Auth Stack
          <>
            <Stack.Screen
              name="Login"
              options={{
                animationTypeForReplace: 'push',
              }}
            >
              {(props) => <LoginScreen {...props} onLogin={handleLogin} />}
            </Stack.Screen>
            <Stack.Screen
              name="Signup"
              options={{
                gestureDirection: 'horizontal',
              }}
            >
              {(props) => <SignupScreen {...props} onSignup={handleSignup} />}
            </Stack.Screen>
            {/* Make Terms/Privacy available before auth */}
            <Stack.Screen name="TermsPrivacy" component={TermsPrivacyScreen} />
          </>
        ) : (
          // Main App Stack
          <>
            {needsOnboarding ? (
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            ) : null}
            <Stack.Screen
              name="MainTabs"
              component={TabNavigator}
            />
            <Stack.Screen name="TermsPrivacy" component={TermsPrivacyScreen} />
            <Stack.Screen name="RewardsStore" component={RewardsStoreScreen} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
            <Stack.Screen name="ContactUs" component={ContactUsScreen} />
            <Stack.Screen name="ReferEarn" component={ReferEarnScreen} />
            <Stack.Screen name="FaqChat" component={FaqChatScreen} />
            <Stack.Screen name="ScanDetails" component={ScanDetailsScreen} />
            <Stack.Screen
              name="ProductDetails"
              component={ProductDetailsScreen}
              options={{
                headerShown: true,
                title: 'Product Details',
                headerStyle: {
                  backgroundColor: COLORS.primary,
                },
                headerTintColor: COLORS.textOnPrimary,
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            />
            <Stack.Screen
              name="ManualProductEntry"
              component={ManualProductEntryScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen name="MyReviews" component={MyReviewsScreen} />
            <Stack.Screen
              name="LabelGuide"
              component={LabelGuideScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="NutritionGoalDetail"
              component={NutritionGoalDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="NutritionGoalsOverview"
              component={NutritionGoalsOverviewScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="FoodCategoryRiskGuide"
              component={FoodCategoryRiskGuideScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="FoodCategoriesOverview"
              component={FoodCategoriesOverviewScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="MythsFacts"
              component={MythsFactsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="DailyNutritionTips"
              component={DailyNutritionTipsScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;