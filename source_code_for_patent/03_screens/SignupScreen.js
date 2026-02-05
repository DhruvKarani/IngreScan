import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView,
  Alert,
  Image,
  Dimensions
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs, updateDoc, increment } from 'firebase/firestore';

const { width: screenWidth } = Dimensions.get('window');

const SignupScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    referralCode: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showReferralInput, setShowReferralInput] = useState(false);
  

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    const { name, email, password, confirmPassword } = formData;
    
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return false;
    }
    if (!email.trim()) {
      Alert.alert('Error', 'Email is required');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }
    if (!agreedToTerms) {
      Alert.alert('Error', 'Please agree to the Terms and Conditions');
      return false;
    }
    return true;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const { user } = userCredential;

      // set displayName on the Firebase Auth user
      try {
        await updateProfile(user, { displayName: formData.name.trim() });
      } catch (err) {
        // non-fatal: continue even if updating auth profile fails
        console.warn('Failed to set auth displayName', err.message);
      }

      // create initial user document with name, email and timestamps
      // generate a short referral code for the new user
      const makeReferralCode = (name = '') => {
        const prefix = (name.split(' ')[0] || 'USER').slice(0,4).toUpperCase();
        const rand = Math.random().toString(36).slice(2,8).toUpperCase();
        return `${prefix}-${rand}`;
      };
      const myReferralCode = makeReferralCode(formData.name.trim());

      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        name: formData.name.trim(),
        email: formData.email.trim(),
        points: 0,
        referralCode: myReferralCode,
        onboarded: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // If the new user supplied a referral code, credit the referrer
      const provided = (formData.referralCode || '').trim();
      if (provided) {
        try {
          const usersCol = collection(db, 'users');
          const q = query(usersCol, where('referralCode', '==', provided));
          const snaps = await getDocs(q);
          if (!snaps.empty) {
            // credit the first matched referrer
            const refSnap = snaps.docs[0];
            const refUid = refSnap.id;
            const refRef = doc(db, 'users', refUid);
            // atomically increment points by 50
            await updateDoc(refRef, { points: increment(50) });
            // record the referral under referrer's subcollection
            try {
              await setDoc(doc(db, 'users', refUid, 'referrals', user.uid), {
                referredUid: user.uid,
                referredEmail: formData.email.trim(),
                createdAt: serverTimestamp(),
              });
            } catch (e) {
              console.warn('Failed to write referral record', e.message);
            }
          }
        } catch (e) {
          console.warn('Referral processing failed', e.message);
        }
      }

      setLoading(false);
      Alert.alert("Success", "Account created successfully!", [
        { text: "OK", onPress: () => navigation.replace("Onboarding") }
      ]);
    } catch (error) {
      setLoading(false);
      Alert.alert("Signup Failed", error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/ingrescan-logo.png')} 
            style={styles.logo} 
            resizeMode="contain"
          />
        </View>
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <MaterialIcons 
              name="person" 
              size={20} 
              color={COLORS.textSecondary} 
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor={COLORS.textSecondary}
              value={formData.name}
              onChangeText={(value) => handleInputChange('name', value)}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <MaterialIcons 
              name="email" 
              size={20} 
              color={COLORS.textSecondary} 
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={COLORS.textSecondary}
              value={formData.email}
              onChangeText={(value) => handleInputChange('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <MaterialIcons 
              name="lock" 
              size={20} 
              color={COLORS.textSecondary} 
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Password"
              placeholderTextColor={COLORS.textSecondary}
              value={formData.password}
              onChangeText={(value) => handleInputChange('password', value)}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowPassword(!showPassword)}
            >
              <MaterialIcons 
                name={showPassword ? "visibility" : "visibility-off"} 
                size={20} 
                color={COLORS.textSecondary} 
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <MaterialIcons 
              name="lock-outline" 
              size={20} 
              color={COLORS.textSecondary} 
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Confirm Password"
              placeholderTextColor={COLORS.textSecondary}
              value={formData.confirmPassword}
              onChangeText={(value) => handleInputChange('confirmPassword', value)}
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <MaterialIcons 
                name={showConfirmPassword ? "visibility" : "visibility-off"} 
                size={20} 
                color={COLORS.textSecondary} 
              />
            </TouchableOpacity>
          </View>

          {/* Referral input toggle */}
          <TouchableOpacity onPress={() => setShowReferralInput(!showReferralInput)} style={{ marginBottom: SPACING.md }}>
            <Text style={{ color: COLORS.primary, textAlign: 'right' }}>{showReferralInput ? 'Hide referral code' : 'Have a referral code?'}</Text>
          </TouchableOpacity>

          {showReferralInput && (
            <View style={[styles.inputContainer, { marginBottom: SPACING.md }]}>
              <MaterialIcons 
                name="card-giftcard" 
                size={20} 
                color={COLORS.textSecondary} 
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Referral code (optional)"
                placeholderTextColor={COLORS.textSecondary}
                value={formData.referralCode}
                onChangeText={(value) => handleInputChange('referralCode', value)}
                autoCapitalize="characters"
              />
            </View>
          )}

          {/* Terms and Conditions */}
          <View style={styles.termsWrapper}>
            <TouchableOpacity 
              onPress={() => setAgreedToTerms(!agreedToTerms)}
              style={styles.checkboxContainer}
            >
              <MaterialIcons 
                name={agreedToTerms ? "check-box" : "check-box-outline-blank"} 
                size={20} 
                color={agreedToTerms ? COLORS.primary : COLORS.textSecondary} 
              />
            </TouchableOpacity>
            
            <Text style={styles.termsText}>
              I agree to the{' '}
              <Text 
                style={styles.termsLink} 
                onPress={() => navigation.navigate("TermsPrivacy", { onAccept: (accepted) => setAgreedToTerms(!!accepted) })}
              >
                Terms and Conditions
              </Text>
              {' '}and{' '}
              <Text 
                style={styles.termsLink} 
                onPress={() => navigation.navigate("TermsPrivacy", { onAccept: (accepted) => setAgreedToTerms(!!accepted) })}
              >
                Privacy Policy
              </Text>
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.signupButton, loading && styles.signupButtonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            <Text style={styles.signupButtonText}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          <View style={styles.loginPrompt}>
            <Text style={styles.loginPromptText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: 'white'
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    backgroundColor: 'white'
  },
  logoContainer: { alignItems: 'center', marginBottom: SPACING.md },
  logo: {
    width: 200,
    height: 200,
    marginBottom: SPACING.lg,
  },
  formContainer: {
    backgroundColor: 'white',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    ...SHADOWS.large,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.backgroundLight,
  },
  inputIcon: { marginRight: SPACING.sm },
  input: {
    flex: 1,
    height: 48,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text,
  },
  passwordInput: { paddingRight: SPACING.md },
  passwordToggle: { padding: SPACING.xs },
  termsWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  checkboxContainer: { marginTop: 2 },
  termsText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.sm,
  },
  termsLink: { color: COLORS.primary, fontWeight: TYPOGRAPHY.fontWeight.medium },
  signupButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    ...SHADOWS.medium,
  },
  signupButtonDisabled: { opacity: 0.6 },
  signupButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textOnPrimary,
  },
  loginPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginPromptText: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.textSecondary },
  loginLink: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.primary, fontWeight: TYPOGRAPHY.fontWeight.bold },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  optionChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundLight,
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  optionChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  optionText: { color: COLORS.textSecondary },
  optionTextSelected: { color: COLORS.textOnPrimary },
});

export default SignupScreen;