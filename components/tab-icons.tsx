import React from 'react';
import { View, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';

type TabIconProps = {
  focused: boolean;
  type: 'square' | 'triangle' | 'circle' | 'pentagon';
};

export function TabIcon({ focused, type }: TabIconProps) {
  const getIcon = () => {
    switch (type) {
      case 'square':
        return (
          <View style={[styles.square, focused ? styles.squareActive : styles.squareInactive]}>
            {focused && (
              <View style={styles.checkmark}>
                <ThemedText>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </ThemedText>
              </View>
            )}
          </View>
        );
      case 'triangle':
        return (
          <View style={styles.iconContainer}>
            <ThemedText>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3L21 20H3L12 3Z" stroke={focused ? '#E02D2D' : '#181818'} strokeWidth="1.5" fill="none"/>
              </svg>
            </ThemedText>
          </View>
        );
      case 'circle':
        return (
          <View style={styles.iconContainer}>
            <ThemedText>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="9" stroke={focused ? '#E02D2D' : '#181818'} strokeWidth="1.5" fill="none"/>
              </svg>
            </ThemedText>
          </View>
        );
      case 'pentagon':
        return (
          <View style={styles.iconContainer}>
            <ThemedText>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L20 7L17 16H7L4 7L12 2Z" stroke={focused ? '#E02D2D' : '#181818'} strokeWidth="1.5" fill="none"/>
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
  square: {
    width: 24,
    height: 24,
    position: 'relative',
  },
  squareActive: {
    backgroundColor: '#E02D2D',
  },
  squareInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#181818',
  },
  checkmark: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

