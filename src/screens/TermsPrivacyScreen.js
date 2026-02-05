import React from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity,
  Alert
} from "react-native";
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from "../constants/theme";
import { auth, db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const TermsPrivacyScreen = ({ navigation, route }) => {
  const onAcceptCallback = route?.params?.onAccept;

  const handleAccept = async () => {
    // If user is signed in, persist acceptedTermsAt to their user doc
    const user = auth?.currentUser;
    try {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, { acceptedTermsAt: serverTimestamp() }, { merge: true });
      }
      // call optional callback (e.g., to set the checkbox on signup screen)
      if (typeof onAcceptCallback === 'function') {
        try { onAcceptCallback(true); } catch (e) { /* ignore callback errors */ }
      }
      Alert.alert('Accepted', 'Thank you. Your acceptance has been recorded.');
      navigation.goBack();
    } catch (err) {
      console.warn('Failed to persist acceptedTermsAt', err.message);
      Alert.alert('Error', 'Could not save your acceptance. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Terms & Conditions & Privacy Policy</Text>

        {/* Product Ratings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How Ratings Work</Text>
          <Text style={styles.sectionText}>
            IngreScan provides product ratings based on a standardized metric
            derived from international health guidelines. We use reliable 
            datasets and references including:
          </Text>
          <Text style={styles.bullet}>• Open Food Facts Database</Text>
          <Text style={styles.bullet}>• World Health Organization (WHO)</Text>
          <Text style={styles.bullet}>• National Health Service (NHS)</Text>
          <Text style={styles.bullet}>• American Diabetes Association (ADA)</Text>
          <Text style={styles.sectionText}>
            Ratings are calculated using a combination of nutrition balance, 
            ingredient quality, and health impact categories. These are 
            presented to help users make better choices, but they are 
            not a substitute for professional medical advice.
          </Text>
        </View>

        {/* User Responsibility Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Responsibility</Text>
          <Text style={styles.sectionText}>
            In order to provide safe recommendations, we require users to input
            their allergies and dietary restrictions where prompted in the app.
          </Text>
          <Text style={styles.sectionText}>
            If a user fails to provide this information, IngreScan cannot be
            held liable for health outcomes related to product consumption.
          </Text>
        </View>

        {/* Disclaimer Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Disclaimer</Text>
          <Text style={styles.sectionText}>
            IngreScan is a nutrition information companion app. We provide 
            data-driven insights but do not replace medical advice from 
            qualified professionals. 
          </Text>
          <Text style={styles.sectionText}>
            By using IngreScan, you agree that the app, its developers, and 
            affiliates are not liable for:
          </Text>
          <Text style={styles.bullet}>• Undeclared allergies not shared by the user</Text>
          <Text style={styles.bullet}>• Misinterpretation of product data</Text>
          <Text style={styles.bullet}>• Health issues arising from personal misuse</Text>
        </View>

        {/* Privacy Policy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy Policy</Text>
          <Text style={styles.sectionText}>
            We respect your privacy. Your personal data such as email and 
            login credentials are securely stored using Firebase Authentication. 
            Allergens and preferences are only used to improve recommendations 
            and are not shared with third parties.
          </Text>
          <Text style={styles.sectionText}>
            We do not sell, rent, or misuse user data. By continuing, you 
            consent to our secure storage and usage practices.
          </Text>
        </View>

        {/* Accept Button */}
        <TouchableOpacity 
          style={styles.acceptButton} 
          onPress={handleAccept}
        >
          <Text style={styles.acceptText}>I Understand & Accept</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "white" 
  },
  scrollContent: {
    padding: SPACING.xl,
    paddingBottom: SPACING["4xl"],
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize["2xl"],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    textAlign: "center",
    marginBottom: SPACING.lg,
  },
  section: {
    marginBottom: SPACING["2xl"],
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  sectionText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    lineHeight: 22,
  },
  bullet: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text,
    marginLeft: SPACING.md,
    marginBottom: SPACING.xs,
  },
  acceptButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  acceptText: {
    color: COLORS.textOnPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
});

export default TermsPrivacyScreen;
