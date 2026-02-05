import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, SafeAreaView, Linking, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';

const SUPPORT_EMAIL = 'nikunj.maru@somaiya.edu';

const ContactUsScreen = ({ navigation }) => {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const validate = () => {
    if (!form.name.trim()) return 'Please enter your name';
    if (!form.email.trim()) return 'Please enter your email';
    if (!/\S+@\S+\.\S+/.test(form.email)) return 'Please enter a valid email address';
    if (!form.subject.trim()) return 'Please enter a subject';
    if (!form.message.trim()) return 'Please enter a message';
    return null;
  };

  const handleSend = async () => {
    const err = validate();
    if (err) return Alert.alert('Validation', err);
    setSending(true);
    try {
      const subject = encodeURIComponent(form.subject.trim());
      const bodyLines = [
        `Name: ${form.name.trim()}`,
        `Email: ${form.email.trim()}`,
        '',
        form.message.trim()
      ];
      const body = encodeURIComponent(bodyLines.join('\n'));
      const mailto = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

      const supported = await Linking.canOpenURL(mailto);
      if (!supported) {
        Alert.alert('Not supported', 'No mail client is available to send email from this device.');
        setSending(false);
        return;
      }
      await Linking.openURL(mailto);
      setSending(false);
      // optionally clear form or show success
      Alert.alert('Opened Mail', 'Your mail client was opened. Complete and send the email to contact support.');
    } catch (err) {
      setSending(false);
      Alert.alert('Error', 'Failed to open mail client: ' + err.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Contact Us</Text>
          <Text style={styles.description}>Have feedback or need help? Send us a message and we'll get back to you at the email you provide.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Your Name</Text>
            <TextInput value={form.name} onChangeText={(v) => update('name', v)} style={styles.input} placeholder="Full name" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Your Email</Text>
            <TextInput value={form.email} onChangeText={(v) => update('email', v)} style={styles.input} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Subject</Text>
            <TextInput value={form.subject} onChangeText={(v) => update('subject', v)} style={styles.input} placeholder="Subject" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Message</Text>
            <TextInput value={form.message} onChangeText={(v) => update('message', v)} style={[styles.input, styles.textArea]} placeholder="Write your message..." multiline numberOfLines={6} textAlignVertical="top" />
          </View>

          <TouchableOpacity style={[styles.sendButton, sending && { opacity: 0.6 }]} onPress={handleSend} disabled={sending}>
            <MaterialIcons name="send" size={20} color="#fff" />
            <Text style={styles.sendText}>{sending ? 'Opening Mail...' : 'Send Message'}</Text>
          </TouchableOpacity>

          <View style={styles.infoRow}>
            <MaterialIcons name="email" size={18} color={COLORS.textSecondary} />
            <Text style={styles.infoText}> Or email us directly: {SUPPORT_EMAIL}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundLight },
  content: { padding: SPACING.lg },
  title: { fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text, marginBottom: SPACING.sm },
  description: { color: COLORS.textSecondary, marginBottom: SPACING.md },
  field: { marginBottom: SPACING.md },
  label: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  input: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  textArea: { minHeight: 120 },
  sendButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginTop: SPACING.md },
  sendText: { color: '#fff', marginLeft: SPACING.sm, fontWeight: TYPOGRAPHY.fontWeight.bold },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.lg },
  infoText: { marginLeft: SPACING.sm, color: COLORS.textSecondary }
});

export default ContactUsScreen;
