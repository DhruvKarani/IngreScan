# Dynamic Daily Intake Tracking System

## Overview
The app now features a dynamic daily intake tracking system that allows users to track their actual food consumption instead of static values.

## How It Works

### 1. Daily Reset
- Every day at midnight, the intake values automatically reset to 0
- Daily limits are based on standard nutritional guidelines for a normal adult

### 2. User Interaction
When viewing a product, users will see:
- **"Are you going to consume this?"** prompt
- **Yes** button: Adds product nutrients to daily intake
- **No** button: Keeps intake unchanged

### 3. Dynamic Tracking
- **Initial State**: All nutrients start at 0/day
- **After Consumption**: Product nutrients are added to running totals
- **Toggle Support**: Users can un-consume products if they change their mind

### 4. Visual Feedback
- Progress bars update in real-time
- Values turn red when exceeding daily limits
- Confirmation messages for user actions

## Technical Implementation

### Daily Intake Manager (`src/utils/dailyIntakeManager.js`)
- Manages AsyncStorage persistence
- Handles daily reset logic
- Maps product nutrition to tracked nutrients
- Provides formatted data for display

### Tracked Nutrients
- **Sugar**: 33g daily limit
- **Net Carbohydrates**: 250g daily limit
- **Calories**: 2000 kcal daily limit
- **Saturated + Trans Fat**: 20g daily limit
- **Caffeine**: 400mg daily limit
- **Sodium**: 2000mg daily limit

### Product Details Screen Updates
- Added consumption confirmation buttons
- Dynamic "Today's Intake" section
- Real-time progress bar updates
- Persistent consumption state

## User Experience Flow

1. **View Product**: User scans/views a product
2. **See Intake**: Current daily intake displays with progress bars
3. **Consumption Decision**: User chooses "Yes" or "No" to consume
4. **Instant Update**: Intake values update immediately if "Yes"
5. **Visual Feedback**: Progress bars and percentages reflect new totals
6. **Persistent Storage**: Data persists across app sessions

## Future Enhancements
- Condition-specific limits (diabetes, high BP, etc.)
- Meal-based tracking
- Weekly/monthly summaries
- Nutritional goals and recommendations
- Export data capabilities

## Data Storage
- Uses AsyncStorage for offline persistence
- Data structure: `{ nutrient: { current: number, limit: number, unit: string, color: string } }`
- Daily reset based on date comparison