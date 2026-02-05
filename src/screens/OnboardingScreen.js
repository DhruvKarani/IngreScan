import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  TextInput
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';
import { DIETARY_PREFERENCES, COMMON_ALLERGENS, HEALTH_CONDITIONS } from '../constants/data';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const OnboardingScreen = ({ navigation }) => {
  const [diet, setDiet] = useState(null);
  const [selectedAllergens, setSelectedAllergens] = useState([]);
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [customAllergy, setCustomAllergy] = useState('');
  const [customCondition, setCustomCondition] = useState('');

  useEffect(() => {
    // If user already has profile, skip onboarding
    const loadProfile = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          if (data && (data.onboarded || data.dietaryPreferences || data.allergens)) {
            navigation.replace('MainTabs');
          }
        }
      } catch (err) {
        console.warn('Onboarding load error', err.message);
      }
    };
    loadProfile();
  }, []);

  const toggleItem = (id, list, setList) => {
    setList(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleAddCustomAllergy = () => {
    if (!customAllergy.trim()) return;
    setSelectedAllergens(prev => [...prev, customAllergy.trim()]);
    setCustomAllergy('');
  };

  const handleAddCustomCondition = () => {
    if (!customCondition.trim()) return;
    setSelectedConditions(prev => [...prev, customCondition.trim()]);
    setCustomCondition('');
  };

  const handleSkip = async () => {
    await saveAndContinue({ skip: true });
  };

  const saveAndContinue = async (opts = {}) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'No authenticated user found.');
        navigation.replace('Login');
        return;
      }

      const payload = {
        onboarded: true,
        dietaryPreferences: diet ? [diet] : [],
        allergens: selectedAllergens,
        healthConditions: selectedConditions,
        updatedAt: new Date().toISOString(),
      };

      // allow skip to save minimal record
      if (opts.skip) {
        await setDoc(doc(db, 'users', user.uid), { onboarded: true }, { merge: true });
      } else {
        await setDoc(doc(db, 'users', user.uid), payload, { merge: true });
      }

      navigation.replace('MainTabs');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to IngreScan</Text>
          <Text style={styles.subtitle}>Tell us about your diet, allergies and health to personalize recommendations.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dietary Preference</Text>
          <View style={styles.optionsRow}>
            {DIETARY_PREFERENCES.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.option, diet === p.id && styles.optionSelected]}
                onPress={() => setDiet(p.id)}
              >
                <Text style={styles.optionIcon}>{p.icon}</Text>
                <Text style={styles.optionText}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Allergies</Text>
          <Text style={styles.sectionDescription}>Select any allergies. You can add custom ones too.</Text>
          <View style={styles.optionsRow}>
            {COMMON_ALLERGENS.map(a => (
              <TouchableOpacity
                key={a.id}
                style={[styles.chip, selectedAllergens.includes(a.id) && styles.chipSelected]}
                onPress={() => toggleItem(a.id, selectedAllergens, setSelectedAllergens)}
              >
                <Text style={styles.chipText}>{a.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.customRow}>
            <TextInput
              value={customAllergy}
              onChangeText={setCustomAllergy}
              placeholder="Add other allergy"
              style={styles.textInput}
            />
            <TouchableOpacity style={styles.addButton} onPress={handleAddCustomAllergy}>
              <MaterialIcons name="add" size={20} color={COLORS.textOnPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Health Conditions</Text>
          <Text style={styles.sectionDescription}>Select any health conditions that apply to you.</Text>
          <View style={styles.optionsRow}>
            {HEALTH_CONDITIONS.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, selectedConditions.includes(c.id) && styles.chipSelected]}
                onPress={() => toggleItem(c.id, selectedConditions, setSelectedConditions)}
              >
                <Text style={styles.chipText}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.customRow}>
            <TextInput
              value={customCondition}
              onChangeText={setCustomCondition}
              placeholder="Add other health condition"
              style={styles.textInput}
            />
            <TouchableOpacity style={styles.addButton} onPress={handleAddCustomCondition}>
              <MaterialIcons name="add" size={20} color={COLORS.textOnPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.continueButton} onPress={() => saveAndContinue()}>
            <Text style={styles.continueText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundLight },
  content: { padding: SPACING.lg },
  header: { marginBottom: SPACING.lg },
  title: { fontSize: TYPOGRAPHY.fontSize['3xl'], fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text },
  subtitle: { marginTop: SPACING.sm, color: COLORS.textSecondary },
  section: { marginVertical: SPACING.md, backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, ...SHADOWS.small },
  sectionTitle: { fontWeight: TYPOGRAPHY.fontWeight.bold, marginBottom: SPACING.sm },
  sectionDescription: { color: COLORS.textSecondary, marginBottom: SPACING.sm },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  option: { alignItems: 'center', padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.backgroundLight, minWidth: '30%' },
  optionSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  optionIcon: { fontSize: TYPOGRAPHY.fontSize.lg },
  optionText: { marginTop: SPACING.xs },
  chip: { padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, margin: SPACING.xs, backgroundColor: COLORS.backgroundLight },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.text },
  customRow: { flexDirection: 'row', marginTop: SPACING.sm, alignItems: 'center' },
  textInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, backgroundColor: COLORS.surface },
  addButton: { marginLeft: SPACING.sm, backgroundColor: COLORS.primary, padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.lg },
  skipButton: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.surface },
  skipText: { color: COLORS.textSecondary },
  continueButton: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.primary },
  continueText: { color: COLORS.textOnPrimary, fontWeight: TYPOGRAPHY.fontWeight.bold },
});

export default OnboardingScreen;
