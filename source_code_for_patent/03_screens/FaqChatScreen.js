import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';

const FAQS = [
  { id: 'q1', question: 'How do I scan a product?', answer: 'Open the Scan tab and point your camera at the barcode. The app will automatically detect and lookup the product.' , keywords: ['scan','barcode','camera']},
  { id: 'q2', question: 'How are health scores calculated?', answer: 'Health scores are computed from nutrition facts and ingredient data using the apps scoring rules (balance of macro nutrients, bad nutrients and ingredient quality).' , keywords: ['score','health score','calculate','calculation']},
  { id: 'q3', question: 'How do I change my allergens or preferences?', answer: 'Go to Profile → Edit (pencil icon) to update allergens, dietary preferences and health conditions.' , keywords: ['allergen','allergens','preferences','dietary']},
  { id: 'q4', question: 'How do I earn points?', answer: 'You earn points by scanning products (first-time product bonuses and daily bonuses) and via referrals. See Refer & Earn in your profile.' , keywords: ['points','earn','rewards','referral']},
  { id: 'q5', question: 'How do referrals work?', answer: 'Share your referral code from Refer & Earn. When a new user signs up with your code you receive 50 points.' , keywords: ['referral','refer','code']},
  { id: 'q6', question: 'I found incorrect product data', answer: 'Open the product page and use the feedback controls; we also fall back to OpenFoodFacts data which you can edit on their website.' , keywords: ['incorrect','wrong','data','product']},
];

const Bot = {
  respond: (text) => {
    const t = (text || '').toLowerCase();
    for (let faq of FAQS) {
      for (let k of faq.keywords) {
        if (t.includes(k)) return faq.answer;
      }
    }
    if (t.includes('help')) return 'You can ask me about scanning, points, referrals, and profile settings. Try: "How do I scan a product?"';
    return "Sorry, I don't have an answer for that yet. Try one of the suggested questions below or Contact Us from your profile.";
  }
};

const FaqChatScreen = ({ navigation }) => {
  const [messages, setMessages] = useState([
    { id: 'm1', from: 'bot', text: 'Hi! I am IngreScan assistant. Ask me about the app or tap a suggested question below.' }
  ]);
  const [text, setText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({ headerShown: true, title: 'Help & FAQ' });
  }, []);

  const pushMessage = (msg) => {
    setMessages(prev => [...prev, { id: String(Date.now()), ...msg }]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleSend = () => {
    if (!text.trim()) return;
    const userMsg = text.trim();
    pushMessage({ from: 'user', text: userMsg });
    setText('');
    // simulate bot response
    setTimeout(() => {
      const resp = Bot.respond(userMsg);
      pushMessage({ from: 'bot', text: resp });
    }, 600);
  };

  const handleSuggestion = (q) => {
    pushMessage({ from: 'user', text: q });
    setTimeout(() => {
      const resp = Bot.respond(q);
      pushMessage({ from: 'bot', text: resp });
    }, 500);
  };

  const renderItem = ({ item }) => (
    <View style={[styles.msgRow, item.from === 'bot' ? styles.botRow : styles.userRow]}>
      <Text style={[styles.msgText, item.from === 'bot' ? styles.botText : styles.userText]}>{item.text}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: SPACING.lg }}
      />

      <View style={styles.suggestions}>
        {FAQS.slice(0,4).map(f => (
          <TouchableOpacity key={f.id} style={styles.suggBtn} onPress={() => handleSuggestion(f.question)}>
            <Text style={styles.suggText}>{f.question}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Ask a question..."
            style={styles.input}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <MaterialIcons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundLight },
  msgRow: { marginVertical: SPACING.xs, padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, maxWidth: '85%' },
  botRow: { alignSelf: 'flex-start', backgroundColor: COLORS.surface },
  userRow: { alignSelf: 'flex-end', backgroundColor: COLORS.primary },
  msgText: { fontSize: TYPOGRAPHY.fontSize.base },
  botText: { color: COLORS.text },
  userText: { color: COLORS.textOnPrimary },
  inputRow: { flexDirection: 'row', padding: SPACING.sm, alignItems: 'center', backgroundColor: COLORS.surface },
  input: { flex: 1, backgroundColor: COLORS.backgroundLight, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginRight: SPACING.sm },
  sendBtn: { backgroundColor: COLORS.primary, padding: SPACING.sm, borderRadius: BORDER_RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  suggBtn: { backgroundColor: COLORS.surface, padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, marginRight: SPACING.sm, marginBottom: SPACING.sm },
  suggText: { color: COLORS.textSecondary, fontSize: TYPOGRAPHY.fontSize.sm }
});

export default FaqChatScreen;
