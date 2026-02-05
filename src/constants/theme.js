// Theme constants inspired by FactScan's green color scheme
export const COLORS = {
  // Primary Colors
  primary: '#00C853', // Bright green like FactScan
  primaryDark: '#00A652',
  primaryLight: '#4CAF50',
  
  // Secondary Colors
  secondary: '#FFC107', // Amber for ratings/stars
  secondaryDark: '#FF8F00',
  
  // Background Colors
  background: '#FFFFFF',
  backgroundSecondary: '#F5F5F5',
  backgroundLight: '#FAFAFA',
  
  // Surface Colors
  surface: '#FFFFFF',
  surfaceVariant: '#F0F0F0',
  
  // Text Colors
  text: '#212121',
  textSecondary: '#757575',
  textLight: '#BDBDBD',
  textOnPrimary: '#FFFFFF',
  
  // Status Colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
  
  // Health Risk Colors
  lowRisk: '#4CAF50',
  mediumRisk: '#FF9800',
  highRisk: '#F44336',
  
  // Border Colors
  border: '#E0E0E0',
  borderLight: '#F0F0F0',
  
  // Shadow Colors
  shadow: '#000000',
  shadowLight: 'rgba(0, 0, 0, 0.1)',
  shadowMedium: 'rgba(0, 0, 0, 0.15)',
  shadowDark: 'rgba(0, 0, 0, 0.2)',
};

export const TYPOGRAPHY = {
  // Font Sizes
  fontSize: {
    xs: 10,
    sm: 12,
    base: 14,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 28,
    '5xl': 32,
  },
  
  // Font Weights
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  
  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },
};

export const SPACING = {
  // Base spacing unit (8px)
  unit: 8,
  
  // Spacing scale
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
  '4xl': 64,
};

export const BORDER_RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 50,
};

export const SHADOWS = {
  small: {
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  medium: {
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  large: {
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8,
  },
};

export const DIMENSIONS = {
  // Screen dimensions will be set dynamically
  screenWidth: 0,
  screenHeight: 0,
  
  // Common component sizes
  buttonHeight: 48,
  inputHeight: 48,
  tabBarHeight: 60,
  headerHeight: 56,
  
  // Icon sizes
  iconSize: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 32,
    xl: 40,
  },
};

// Animation durations
export const ANIMATIONS = {
  fast: 150,
  medium: 300,
  slow: 500,
};

// Layout constants
export const LAYOUT = {
  containerPadding: SPACING.md,
  sectionSpacing: SPACING.lg,
  cardPadding: SPACING.md,
  listItemPadding: SPACING.sm,
};