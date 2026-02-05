import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '../constants/theme';

const IntakeProgressBars = ({ intakeData = {} }) => {
  // Default intake values - these would come from your app state/storage
  const defaultIntakes = {
    sugar: { current: 76, limit: 100, color: '#FF9800', label: 'Sugar' },
    carbs: { current: 46, limit: 100, color: '#1976D2', label: 'Net Carbohydrates' },
    calories: { current: 44, limit: 100, color: '#2196F3', label: 'Calories' },
    fat: { current: 46, limit: 100, color: '#1565C0', label: 'Saturated + Trans Fat' },
    caffeine: { current: 22, limit: 100, color: '#0D47A1', label: 'Caffeine' },
    sodium: { current: 65, limit: 100, color: '#FF5722', label: 'Sodium' },
  };

  // Merge with passed data
  const intakes = { ...defaultIntakes, ...intakeData };

  const ProgressBar = ({ item }) => {
    const percentage = Math.min((item.current / item.limit) * 100, 100);
    const isOverLimit = item.current > item.limit;
    
    return (
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontWeight: '600', fontSize: 14, color: '#222' }}>
            {item.label}
          </Text>
          <Text style={{ fontSize: 14, color: isOverLimit ? '#F44336' : item.color, fontWeight: '600' }}>
            {item.current}%{isOverLimit ? ' (over limit)' : ''}
          </Text>
        </View>
        <View style={{ 
          height: 8, 
          backgroundColor: '#E0E0E0', 
          borderRadius: 4, 
          overflow: 'hidden' 
        }}>
          <View style={{
            height: '100%',
            width: `${percentage}%`,
            backgroundColor: isOverLimit ? '#F44336' : item.color,
            borderRadius: 4,
          }} />
        </View>
      </View>
    );
  };

  return (
    <View style={{ 
      backgroundColor: '#fff', 
      borderRadius: 16, 
      padding: 18, 
      marginHorizontal: 18, 
      marginTop: 18, 
      shadowColor: '#000', 
      shadowOpacity: 0.06, 
      shadowRadius: 8, 
      elevation: 2 
    }}>
      <Text style={{ 
        fontWeight: '700', 
        fontSize: 18, 
        color: '#222', 
        marginBottom: 16 
      }}>
        Today's Intake 
        <Text style={{ color: '#888', fontWeight: '400', fontSize: 15 }}>
          {' '}(% of daily limit)
        </Text>
      </Text>
      
      {Object.entries(intakes).map(([key, item]) => (
        <ProgressBar key={key} item={item} />
      ))}
      
      <View style={{ 
        backgroundColor: '#F5F5F5', 
        padding: 12, 
        borderRadius: 8, 
        marginTop: 8 
      }}>
        <Text style={{ 
          fontSize: 12, 
          color: '#666', 
          textAlign: 'center' 
        }}>
          Tap "Yes" when consuming products to update your intake
        </Text>
      </View>
    </View>
  );
};

export default IntakeProgressBars;
