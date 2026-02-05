import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';
import { educationManager } from '../utils/educationManager';

// Import education data
let educationData;
try {
  educationData = require('../data/education/did_you_know.json');
} catch (error) {
  console.warn('Education data not found:', error.message);
  educationData = { flashcards: [] };
}

const MythsFactsScreen = ({ navigation }) => {
  const [mythsFacts, setMythsFacts] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    initializeAndLoad();
  }, []);

  const initializeAndLoad = async () => {
    try {
      // Initialize education manager if not already done
      await educationManager.initialize(educationData);
      loadMythsFacts();
    } catch (error) {
      console.error('Error initializing education manager:', error);
    }
  };

  const loadMythsFacts = () => {
    try {
      const allFacts = educationManager.getAllFacts();
      
      // Filter for myths_facts category
      const mythsData = allFacts.filter(fact => fact.category === 'myths_facts');
      setMythsFacts(mythsData);
    } catch (error) {
      console.error('Error loading myths vs facts:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await initializeAndLoad();
    setIsRefreshing(false);
  };

  const renderMythFact = (item, index) => (
    <View key={index} style={styles.mythFactCard}>
      <View style={styles.mythSection}>
        <View style={styles.mythHeader}>
          <MaterialIcons name="help-outline" size={20} color={COLORS.warning} />
          <Text style={styles.mythLabel}>Common Myth</Text>
        </View>
        <Text style={styles.mythText}>{item.front}</Text>
      </View>
      
      <View style={styles.factSection}>
        <View style={styles.factHeader}>
          <MaterialIcons name="fact-check" size={20} color={COLORS.success} />
          <Text style={styles.factLabel}>Scientific Fact</Text>
        </View>
        <Text style={styles.factText}>{item.back}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Food Myths vs Facts</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={isRefreshing}
        >
          <MaterialIcons name="refresh" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Subtitle */}
      <View style={styles.subtitleContainer}>
        <Text style={styles.subtitle}>
          Debunk common food myths with scientific facts
        </Text>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {mythsFacts.length > 0 ? (
          <>
            <Text style={styles.countText}>
              {mythsFacts.length} myths debunked with facts
            </Text>
            
            {mythsFacts.map((item, index) => renderMythFact(item, index))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons name="science" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Loading myths vs facts...</Text>
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 5,
  },
  subtitleContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.surface,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  countText: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  mythFactCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  mythSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  mythHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  mythLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.warning,
    marginLeft: 8,
  },
  mythText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  factSection: {
    marginTop: 8,
  },
  factHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  factLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
    marginLeft: 8,
  },
  factText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    backgroundColor: '#E8F5E8',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  bottomSpacing: {
    height: 20,
  },
});

export default MythsFactsScreen;