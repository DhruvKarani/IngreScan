import React, { useRef, useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  FlatList,
  Dimensions,
  TouchableOpacity,
  Alert,
  Animated,
  Image,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { FeatureCard, CategoryCard, EducationTip } from '../components';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';
import { FEATURE_CARDS, NUTRITION_CATEGORIES, FOOD_CATEGORIES } from '../constants/data';
import educationManager from '../utils/educationManager';

// Import education data with fallback
let educationData;
try {
  educationData = require('../data/education/did_you_know.json');
  console.log('Education data loaded successfully:', educationData?.flashcards?.length || 0, 'flashcards');
} catch (error) {
  console.warn('Education data not found, using fallback:', error.message);
  educationData = {
    flashcards: [
      {
        id: 1,
        front: "What does ingredient order tell you?",
        back: "Ingredients are listed by weight - the first ingredient makes up the most of the product.",
        icon: "📋",
        category: "label_reading"
      }
    ]
  };
}

const { width: screenWidth } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentEducationCard, setCurrentEducationCard] = useState(0);
  const [dailyFacts, setDailyFacts] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const carouselRef = useRef(null);
  const educationRef = useRef(null);
  // animated logo values
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  // Initialize education manager and load daily facts
  useEffect(() => {
    const initializeEducation = async () => {
      await educationManager.initialize(educationData);
      const todaysFacts = educationManager.getDailyFacts();
      setDailyFacts(todaysFacts);
    };
    
    initializeEducation();
  }, []);

  // Handle refreshing facts
  const refreshFacts = async () => {
    setIsRefreshing(true);
    try {
      const freshFacts = educationManager.getFreshFacts(3);
      setDailyFacts(freshFacts);
      console.log('Refreshed with new facts!');
    } catch (error) {
      console.log('Error refreshing facts:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoScale, { toValue: 1, duration: 450, useNativeDriver: true, easing: Easing.out(Easing.exp) }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [logoScale, logoOpacity]);

  const handleFeaturePress = (feature) => {
    if (feature.route === 'Scan') {
      navigation.navigate('Scan');
    } else {
      Alert.alert('Coming Soon', `${feature.title} feature will be available soon!`);
    }
  };

  const handleCategoryPress = (category) => {
    // Navigate to nutrition goal detail screen
    navigation.navigate('NutritionGoalDetail', { goalId: category.id });
  };

  const handleViewAll = () => {
    // Navigate to nutrition goals overview screen
    navigation.navigate('NutritionGoalsOverview');
  };

  const handleFoodCategoryPress = (category) => {
    // Navigate to food category risk guide screen
    navigation.navigate('FoodCategoryRiskGuide', { categoryName: category });
  };

  const handleFoodCategoriesViewAll = () => {
    // Navigate to food categories overview screen
    navigation.navigate('FoodCategoriesOverview');
  };

  const handleSearchPress = () => {
    Alert.alert('Search', 'Search functionality coming soon!');
  };

  const handleNotificationPress = () => {
    Alert.alert('Notifications', 'No new notifications');
  };

  // Carousel data for promotional content
  const carouselData = [
    {
      id: 1,
      title: 'Scan for Health',
      subtitle: 'Get personalized insights for every product',
      emoji: '🍎',
      color: COLORS.primary,
    },
    {
      id: 2,
      title: 'Know Your Ingredients',
      subtitle: 'Understand every ingredient in your food',
      emoji: '🔍',
      color: COLORS.primaryDark,
    },
    {
      id: 3,
      title: 'Stay Healthy',
      subtitle: 'Make informed choices for better health',
      emoji: '💚',
      color: COLORS.success,
    },
  ];

  const renderCarouselItem = ({ item }) => (
    <View style={[styles.carouselItem, { width: screenWidth - 40 }]}>
      <LinearGradient
        colors={[item.color, `${item.color}CC`]}
        style={styles.carouselGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.carouselEmoji}>{item.emoji}</Text>
        <Text style={styles.carouselTitle}>{item.title}</Text>
        <Text style={styles.carouselSubtitle}>{item.subtitle}</Text>
      </LinearGradient>
    </View>
  );

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentSlide(viewableItems[0].index);
    }
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryDark]}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Animated.View style={{ transform: [{ scale: logoScale }], opacity: logoOpacity }}>
                <Image source={require('../../assets/ingrescan-logo.png')} style={styles.smallLogo} resizeMode="contain" />
              </Animated.View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity 
                style={styles.headerIcon}
                onPress={handleSearchPress}
              >
                <MaterialIcons 
                  name="search" 
                  size={24} 
                  color={COLORS.textOnPrimary} 
                />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.headerIcon}
                onPress={handleNotificationPress}
              >
                <MaterialIcons 
                  name="notifications" 
                  size={24} 
                  color={COLORS.textOnPrimary} 
                />
                <View style={styles.notificationBadge}>
                  <Text style={styles.badgeText}>1</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Promotional Carousel */}
        <View style={styles.carouselContainer}>
          <FlatList
            ref={carouselRef}
            data={carouselData}
            renderItem={renderCarouselItem}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged.current}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            contentContainerStyle={styles.carouselContent}
          />
          
          {/* Pagination Dots */}
          <View style={styles.pagination}>
            {carouselData.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  currentSlide === index && styles.paginationDotActive
                ]}
              />
            ))}
          </View>
        </View>

        {/* Main Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.featuresGrid}>
            {FEATURE_CARDS.map((feature) => (
              <View key={feature.id} style={styles.featureItem}>
                <FeatureCard
                  title={feature.title}
                  subtitle={feature.subtitle}
                  icon={feature.icon}
                  color={feature.color}
                  onPress={() => handleFeaturePress(feature)}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Food Awareness Today Section */}
        {dailyFacts && dailyFacts.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleWithDate}>
              <Text style={styles.sectionTitle}>🧠 Today's Food Facts</Text>
              <Text style={styles.dateText}>
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={[styles.refreshButton, isRefreshing && styles.refreshingButton]}
                onPress={refreshFacts}
                disabled={isRefreshing}
              >
                <MaterialIcons 
                  name="refresh" 
                  size={20} 
                  color={COLORS.primary} 
                />
                <Text style={styles.refreshText}>
                  {isRefreshing ? 'Loading...' : 'New Tips'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <ScrollView 
            ref={educationRef}
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.educationContainer}
          >
            {dailyFacts.map((card, index) => (
              <EducationTip
                key={`${card.id || index}-${isRefreshing}`}
                tip={{
                  front: card.front,
                  back: card.back,
                  icon: card.icon,
                  category: card.category || 'Did You Know?'
                }}
                style={styles.educationTip}
              />
            ))}
          </ScrollView>
        </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🧠 Today's Food Facts</Text>
            <Text style={styles.errorText}>Loading today's facts...</Text>
          </View>
        )}

        {/* Healthy Choices Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Healthy Choices by Experts</Text>
            <TouchableOpacity onPress={handleViewAll}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContainer}
          >
            {NUTRITION_CATEGORIES.map((category) => (
              <View key={category.id} style={styles.categoryItem}>
                <CategoryCard
                  title={category.name}
                  icon={category.icon}
                  color={category.color}
                  description={category.description}
                  onPress={() => handleCategoryPress(category)}
                />
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Food Categories */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Food Categories</Text>
            <TouchableOpacity onPress={handleFoodCategoriesViewAll}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.foodCategoriesGrid}>
            {FOOD_CATEGORIES.slice(0, 6).map((category, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.foodCategoryItem}
                onPress={() => handleFoodCategoryPress(category)}
              >
                <Text style={styles.foodCategoryText}>{category}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

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
  header: {
    elevation: 4,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerGradient: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  headerLeft: {
    flex: 1,
  },
  smallLogo: {
    width: 42,
    height: 42,
  },
  welcomeText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textOnPrimary,
    opacity: 0.9,
  },
  appName: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textOnPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    padding: SPACING.sm,
    marginLeft: SPACING.xs,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.full,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textOnPrimary,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  scrollView: {
    flex: 1,
  },
  carouselContainer: {
    marginVertical: SPACING.lg,
  },
  carouselContent: {
    paddingHorizontal: SPACING.lg,
  },
  carouselItem: {
    marginRight: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.medium,
  },
  carouselGradient: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
  carouselEmoji: {
    fontSize: TYPOGRAPHY.fontSize['4xl'],
    marginBottom: SPACING.sm,
  },
  carouselTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textOnPrimary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  carouselSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textOnPrimary,
    textAlign: 'center',
    opacity: 0.9,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.textLight,
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: COLORS.primary,
    width: 20,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  titleWithDate: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  dateText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginTop: SPACING.xs / 2,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: `${COLORS.primary}30`,
  },
  refreshingButton: {
    opacity: 0.6,
  },
  refreshText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginLeft: SPACING.xs,
  },
  viewAllText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  featuresGrid: {
    gap: SPACING.sm,
  },
  featureItem: {
    marginBottom: SPACING.sm,
  },
  educationContainer: {
    paddingRight: SPACING.lg,
  },
  educationTip: {
    marginRight: SPACING.md,
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    textAlign: 'center',
    padding: SPACING.lg,
  },
  categoriesContainer: {
    paddingRight: SPACING.lg,
  },
  categoryItem: {
    width: 140,
    marginRight: SPACING.md,
  },
  foodCategoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  foodCategoryItem: {
    width: '48%',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    ...SHADOWS.small,
  },
  foodCategoryText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text,
    textAlign: 'center',
  },
  bottomSpacing: {
    height: SPACING.xl,
  },
});

export default HomeScreen;