import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Switch,
  TextInput
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';
import { HEALTH_CONDITIONS, DIETARY_PREFERENCES, COMMON_ALLERGENS } from '../constants/data';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import notificationService from '../utils/notificationService';

const ProfileScreen = ({ navigation }) => {
  const [userProfile, setUserProfile] = useState({
    name: 'John Doe',
    email: 'john.doe@example.com',
    healthConditions: [],
    dietaryPreferences: [],
    allergens: [],
    notifications: true,
    darkMode: false,
  });

  useEffect(() => {
    const loadProfile = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setUserProfile(prev => ({
            ...prev,
            name: data.name || prev.name,
            email: data.email || user.email || prev.email,
            healthConditions: data.healthConditions || [],
            dietaryPreferences: data.dietaryPreferences || [],
            allergens: data.allergens || [],
          }));
        } else {
          // initialize with email
          setUserProfile(prev => ({ ...prev, email: user.email || prev.email }));
        }
      } catch (err) {
        console.warn('Profile load error', err.message);
      }
    };
    loadProfile();
  }, []);

  const [editMode, setEditMode] = useState(false);
  // custom inputs are handled in isolated components to avoid losing focus

  const handleToggleCondition = (conditionId) => {
    setUserProfile(prev => ({
      ...prev,
      healthConditions: prev.healthConditions.includes(conditionId)
        ? prev.healthConditions.filter(id => id !== conditionId)
        : [...prev.healthConditions, conditionId]
    }));
  };

  const handleTogglePreference = (preferenceId) => {
    setUserProfile(prev => ({
      ...prev,
      dietaryPreferences: prev.dietaryPreferences.includes(preferenceId)
        ? prev.dietaryPreferences.filter(id => id !== preferenceId)
        : [...prev.dietaryPreferences, preferenceId]
    }));
  };

  const handleToggleAllergen = (allergenId) => {
    setUserProfile(prev => ({
      ...prev,
      allergens: prev.allergens.includes(allergenId)
        ? prev.allergens.filter(id => id !== allergenId)
        : [...prev.allergens, allergenId]
    }));
  };

  const handleSaveProfile = () => {
    setEditMode(false);
    // save to Firestore
    (async () => {
      try {
        const user = auth.currentUser;
        if (!user) throw new Error('No authenticated user');
        await setDoc(doc(db, 'users', user.uid), {
          name: userProfile.name,
          email: userProfile.email,
          healthConditions: userProfile.healthConditions,
          dietaryPreferences: userProfile.dietaryPreferences,
          allergens: userProfile.allergens,
          notifications: userProfile.notifications,
          darkMode: userProfile.darkMode,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        Alert.alert('Profile Updated', 'Your profile has been saved successfully!');
      } catch (err) {
        Alert.alert('Error', err.message);
      }
    })();
  };

  const handleLogout = () => {
    console.log('Logout requested');
    if (Platform.OS === 'web') {
      // Direct confirm on web as Alert.alert button array can be buggy
      if (window.confirm('Are you sure you want to logout?')) {
        (async () => {
          try {
            console.log('Calling auth.signOut()...');
            await auth.signOut();
            console.log('Sign out successful');
            alert('You have been logged out successfully');
          } catch (err) {
            console.error('Sign out error:', err.message);
            alert('Failed to logout: ' + err.message);
          }
        })();
      }
      return;
    }

    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout', style: 'destructive', onPress: async () => {
            try {
              console.log('Calling auth.signOut()...');
              await auth.signOut();
              console.log('Sign out successful');
              Alert.alert('Logged Out', 'You have been logged out successfully');
            } catch (err) {
              console.error('Sign out error:', err.message);
              Alert.alert('Error', 'Failed to logout: ' + err.message);
            }
          }
        }
      ]
    );
  };

  const MenuSection = ({ title, children }) => (
    <View style={styles.menuSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const MenuItem = ({ icon, title, subtitle, onPress, rightComponent }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <MaterialIcons name={icon} size={24} color={COLORS.textSecondary} />
      <View style={styles.menuItemContent}>
        <Text style={styles.menuItemTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuItemSubtitle}>{subtitle}</Text>}
      </View>
      {rightComponent || (
        <MaterialIcons name="chevron-right" size={24} color={COLORS.textLight} />
      )}
    </TouchableOpacity>
  );

  const ToggleItemInner = ({ item, isSelected, onToggle, showIcon = true }) => (
    <TouchableOpacity
      style={[styles.toggleItem, isSelected && styles.toggleItemSelected]}
      onPress={() => onToggle(item.id)}
      activeOpacity={0.8}
    >
      {showIcon && <Text style={styles.toggleItemIcon}>{item.icon}</Text>}
      <Text style={[
        styles.toggleItemText,
        isSelected && styles.toggleItemTextSelected
      ]}>
        {item.name}
      </Text>
      {isSelected && (
        <MaterialIcons name="check" size={20} color={COLORS.textOnPrimary} />
      )}
    </TouchableOpacity>
  );

  const ToggleItem = React.memo(ToggleItemInner);

  const CustomAddField = React.memo(({ placeholder, onAdd }) => {
    const [local, setLocal] = React.useState('');
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          value={local}
          onChangeText={setLocal}
          placeholder={placeholder}
          style={styles.customInput}
          blurOnSubmit={false}
          returnKeyType="done"
          onSubmitEditing={() => { }}
        />
        <TouchableOpacity
          style={styles.addSmallButton}
          onPress={() => {
            const normalized = (local || '').trim();
            if (!normalized) return;
            onAdd(normalized);
            setLocal('');
          }}
        >
          <MaterialIcons name="add" size={20} color={COLORS.textOnPrimary} />
        </TouchableOpacity>
      </View>
    );
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <MaterialIcons name="person" size={48} color={COLORS.textOnPrimary} />
            </View>
            <TouchableOpacity style={styles.editAvatarButton}>
              <MaterialIcons name="camera-alt" size={16} color={COLORS.textOnPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{userProfile.name}</Text>
            <Text style={styles.userEmail}>{userProfile.email}</Text>
          </View>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setEditMode(!editMode)}
          >
            <MaterialIcons
              name={editMode ? "save" : "edit"}
              size={24}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        </View>

        {editMode ? (
          /* Edit Mode */
          <>
            {/* Health Conditions */}
            <MenuSection title="Health Conditions">
              <Text style={styles.sectionDescription}>
                Select your health conditions for personalized recommendations
              </Text>
              <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm }}>
                <CustomAddField
                  placeholder="Add other health condition"
                  onAdd={(value) => {
                    const normalized = value.trim();
                    if (!normalized) return;
                    const nLower = normalized.toLowerCase();
                    const exists = userProfile.healthConditions.some(c => String(c).toLowerCase() === nLower);
                    if (exists) {
                      Alert.alert('Duplicate', 'This condition is already added.');
                      return;
                    }
                    setUserProfile(prev => ({
                      ...prev,
                      healthConditions: [...prev.healthConditions, normalized]
                    }));
                  }}
                />
              </View>
              <View style={styles.toggleGrid}>
                {HEALTH_CONDITIONS.map((condition) => (
                  <ToggleItem
                    key={condition.id}
                    item={condition}
                    isSelected={userProfile.healthConditions.includes(condition.id)}
                    onToggle={handleToggleCondition}
                  />
                ))}
                {/* Render custom health conditions (strings) */}
                {userProfile.healthConditions
                  .filter(c => !HEALTH_CONDITIONS.some(h => h.id === c))
                  .map((custom) => (
                    <ToggleItem
                      key={custom}
                      item={{ id: custom, name: custom, icon: '⚕️' }}
                      isSelected={userProfile.healthConditions.includes(custom)}
                      onToggle={handleToggleCondition}
                    />
                  ))}
              </View>
            </MenuSection>

            {/* Dietary Preferences */}
            <MenuSection title="Dietary Preferences">
              <Text style={styles.sectionDescription}>
                Choose your dietary preferences
              </Text>
              <View style={styles.toggleGrid}>
                {DIETARY_PREFERENCES.map((preference) => (
                  <ToggleItem
                    key={preference.id}
                    item={preference}
                    isSelected={userProfile.dietaryPreferences.includes(preference.id)}
                    onToggle={handleTogglePreference}
                  />
                ))}
              </View>
            </MenuSection>

            {/* Allergens */}
            <MenuSection title="Allergens">
              <Text style={styles.sectionDescription}>
                Select ingredients you're allergic to
              </Text>
              <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm }}>
                <CustomAddField
                  placeholder="Add other allergy"
                  onAdd={(value) => {
                    const normalized = value.trim();
                    if (!normalized) return;
                    const nLower = normalized.toLowerCase();
                    const exists = userProfile.allergens.some(a => String(a).toLowerCase() === nLower);
                    if (exists) {
                      Alert.alert('Duplicate', 'This allergy is already added.');
                      return;
                    }
                    setUserProfile(prev => ({
                      ...prev,
                      allergens: [...prev.allergens, normalized]
                    }));
                  }}
                />
              </View>
              <View style={styles.toggleGrid}>
                {COMMON_ALLERGENS.map((allergen) => (
                  <ToggleItem
                    key={allergen.id}
                    item={allergen}
                    isSelected={userProfile.allergens.includes(allergen.id)}
                    onToggle={handleToggleAllergen}
                  />
                ))}
                {/* Render custom allergies (strings) */}
                {userProfile.allergens
                  .filter(a => !COMMON_ALLERGENS.some(x => x.id === a))
                  .map((customAll) => (
                    <ToggleItem
                      key={customAll}
                      item={{ id: customAll, name: customAll, icon: '⚠️' }}
                      isSelected={userProfile.allergens.includes(customAll)}
                      onToggle={handleToggleAllergen}
                    />
                  ))}
              </View>
            </MenuSection>

            {/* Save Button */}
            <View style={styles.saveButtonContainer}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveProfile}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          /* View Mode */
          <>
            {/* My Activities */}
            <MenuSection title="My Activities">
              <MenuItem
                icon="favorite"
                title="Favorites"
                subtitle="Your saved products"
                onPress={() => Alert.alert('Favorites', 'Coming soon!')}
              />
              <MenuItem
                icon="history"
                title="Scan History"
                subtitle="Previously scanned items"
                onPress={() => navigation.navigate('History')}
              />
              <MenuItem
                icon="rate-review"
                title="My Reviews"
                subtitle="Products you've reviewed"
                onPress={() => navigation.navigate('MyReviews')}
              />
              <MenuItem
                icon="shopping-bag"
                title="My Orders"
                subtitle="Track your purchases"
                onPress={() => Alert.alert('Orders', 'Coming soon!')}
              />
            </MenuSection>

            {/* Community */}
            <MenuSection title="Community">
              <MenuItem
                icon="leaderboard"
                title="Leaderboard"
                subtitle="See top scanners"
                onPress={() => navigation.navigate('Leaderboard')}
              />
              <MenuItem
                icon="card-giftcard"
                title="Refer & Earn"
                subtitle="Invite friends and earn rewards"
                onPress={() => navigation.navigate('ReferEarn')}
              />
              <MenuItem
                icon="redeem"
                title="Rewards Store"
                subtitle="Redeem your points"
                onPress={() => navigation.navigate('RewardsStore')}
              />
            </MenuSection>

            {/* Education & Awareness */}
            <MenuSection title="Education & Awareness">
              <MenuItem
                icon="school"
                title="Label Reading Guide"
                subtitle="Learn to read food labels"
                onPress={() => navigation.navigate('LabelGuide')}
              />
              <MenuItem
                icon="quiz"
                title="Food Myths vs Facts"
                subtitle="Debunk common food myths"
                onPress={() => navigation.navigate('MythsFacts')}
              />
              <MenuItem
                icon="tips-and-updates"
                title="Daily Nutrition Tips"
                subtitle="Get daily food awareness tips"
                onPress={() => navigation.navigate('DailyNutritionTips')}
                rightComponent={
                  <Switch
                    value={userProfile.dailyTips || true}
                    onValueChange={(value) => setUserProfile(prev => ({
                      ...prev,
                      dailyTips: value
                    }))}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                    thumbColor={COLORS.surface}
                  />
                }
              />
            </MenuSection>

            {/* Settings */}
            <MenuSection title="Settings">
              <MenuItem
                icon="notifications"
                title="Notifications"
                subtitle="Intake alerts and reminders"
                onPress={async () => {
                  Alert.alert(
                    'Notification Settings',
                    'Intake limit alerts notify you when you reach 75% of your daily nutrition limits (sugar, sodium, etc.). Daily reminders help you track your meals.',
                    [
                      { text: 'OK', style: 'default' }
                    ]
                  );
                }}
                rightComponent={
                  <Switch
                    value={userProfile.notifications}
                    onValueChange={async (value) => {
                      try {
                        if (value) {
                          // Enable notifications - initialize service
                          const initialized = await notificationService.initialize();
                          if (initialized) {
                            await notificationService.scheduleDailyReminders();
                            setUserProfile(prev => ({
                              ...prev,
                              notifications: true
                            }));
                            Alert.alert('Notifications Enabled', 'You will now receive intake alerts and daily reminders!');
                          } else {
                            Alert.alert('Permission Required', 'Please enable notifications in your device settings to receive intake alerts.');
                          }
                        } else {
                          // Disable notifications
                          await notificationService.cancelAllNotifications();
                          setUserProfile(prev => ({
                            ...prev,
                            notifications: false
                          }));
                          Alert.alert('Notifications Disabled', 'You will no longer receive intake alerts.');
                        }
                      } catch (error) {
                        console.error('Error toggling notifications:', error);
                        Alert.alert('Error', 'Failed to update notification settings. Please try again.');
                      }
                    }}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                    thumbColor={COLORS.surface}
                  />
                }
              />
              <MenuItem
                icon="dark-mode"
                title="Dark Mode"
                subtitle="Toggle dark theme"
                onPress={() => setUserProfile(prev => ({
                  ...prev,
                  darkMode: !prev.darkMode
                }))}
                rightComponent={
                  <Switch
                    value={userProfile.darkMode}
                    onValueChange={(value) => setUserProfile(prev => ({
                      ...prev,
                      darkMode: value
                    }))}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                    thumbColor={COLORS.surface}
                  />
                }
              />
              <MenuItem
                icon="language"
                title="Language"
                subtitle="English"
                onPress={() => Alert.alert('Language', 'Coming soon!')}
              />
            </MenuSection>

            {/* Support */}
            <MenuSection title="Support & Information">
              <MenuItem
                icon="help"
                title="Help & FAQ"
                subtitle="Get help and answers"
                onPress={() => navigation.navigate('FaqChat')}
              />
              <MenuItem
                icon="phone"
                title="Contact Us"
                subtitle="Get in touch with support"
                onPress={() => navigation.navigate('ContactUs')}
              />
              <MenuItem
                icon="info"
                title="About IngreScan"
                subtitle="Version 1.0.0"
                onPress={() => Alert.alert('About', 'IngreScan v1.0.0\nYour personalized food companion')}
              />
              <MenuItem
                icon="privacy-tip"
                title="Privacy Policy"
                onPress={() => Alert.alert('Privacy Policy', 'Coming soon!')}
              />
              <MenuItem
                icon="description"
                title="Terms & Conditions"
                onPress={() => navigation.navigate('TermsPrivacy')}
              />
            </MenuSection>

            {/* Logout */}
            <View style={styles.logoutContainer}>
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <MaterialIcons name="logout" size={24} color={COLORS.error} />
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Bottom spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundLight,
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: SPACING.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primaryDark,
    borderRadius: BORDER_RADIUS.full,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  userEmail: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
  },
  editButton: {
    padding: SPACING.sm,
  },
  menuSection: {
    backgroundColor: COLORS.surface,
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
    ...SHADOWS.small,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  sectionDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  menuItemContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  menuItemTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text,
  },
  menuItemSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  toggleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
    minWidth: '45%',
  },
  toggleItemSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  toggleItemIcon: {
    fontSize: TYPOGRAPHY.fontSize.base,
    marginRight: SPACING.sm,
  },
  toggleItemText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  toggleItemTextSelected: {
    color: COLORS.textOnPrimary,
  },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  addSmallButton: {
    marginLeft: SPACING.sm,
    backgroundColor: COLORS.primary,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  saveButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textOnPrimary,
  },
  logoutContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    ...SHADOWS.small,
  },
  logoutText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.error,
    marginLeft: SPACING.sm,
  },
  bottomSpacing: {
    height: SPACING.xl,
  },
});

export default ProfileScreen;