import React from 'react';
import { View, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';

type TabIconProps = {
  focused: boolean;
  type: 'square' | 'triangle' | 'circle' | 'home';
};

export function TabIcon({ focused, type }: TabIconProps) {
  const strokeColor = focused ? '#E02D2D' : '#181818';
  const fillColor = focused ? '#E02D2D' : 'none';
  const gridLineColor = focused ? '#FFFFFF' : '#181818';
  const getIcon = () => {
    switch (type) {
      case 'square':
        return (
          <View style={styles.iconContainer}>
            <ThemedText>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="4" width="16" height="16" rx="0" stroke={strokeColor} strokeWidth="1.5" fill={fillColor} />
                <path d="M12 4V20M4 12H20" stroke={gridLineColor} strokeWidth="1.5" />
              </svg>
            </ThemedText>
          </View>
        );
      case 'triangle':
        return (
          <View style={styles.iconContainer}>
            <ThemedText>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3L21 20H3L12 3Z" stroke={strokeColor} strokeWidth="1.5" fill={fillColor} />
              </svg>
            </ThemedText>
          </View>
        );
      case 'circle':
        return (
          <View style={styles.iconContainer}>
            <ThemedText>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="9" stroke={strokeColor} strokeWidth="1.5" fill={fillColor} />
              </svg>
            </ThemedText>
          </View>
        );
      case 'home':
        return (
          <View style={styles.iconContainer}>
            <ThemedText>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3L3 10H5V21H19V10H21L12 3Z" stroke={strokeColor} strokeWidth="1.5" fill={fillColor} />
              </svg>
            </ThemedText>
          </View>
        );
      default:
        return null;
    }
  };

  return <View style={styles.container}>{getIcon()}</View>;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

