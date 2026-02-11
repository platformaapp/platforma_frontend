import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

type TabIconProps = {
  focused: boolean;
  type: 'square' | 'triangle' | 'circle' | 'home' ;
};

export function TabIcon({ focused, type }: TabIconProps) {
  const getIcon = () => {
    switch (type) {
      case 'square':
        return (
          <View style={styles.iconContainer}>
            <ThemedText>
              {focused ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M21.75 21.75V2.25H2.25V21.75H21.75ZM3.25 20.75H8.125V14.375H3.25V20.75ZM16.875 20.75H9.125V14.375H16.875H20.748H20.75V20.75H20.748H16.875ZM13.625 13.375H20.75V3.25H13.625V13.375ZM12.625 13.375H3.25V3.25H12.625V13.375Z" fill="#E02D2D"/>
                  <path d="M3.25 13.375H12.625V3.25H3.25V13.375Z" fill="#E02D2D"/>
                  <path d="M20.75 13.375H13.625V3.25H20.75V13.375Z" fill="#E02D2D"/>
                  <path d="M9.125 20.75H16.875V14.375H9.125V20.75Z" fill="#E02D2D"/>
                  <path d="M8.125 20.75H3.25V14.375H8.125V20.75Z" fill="#E02D2D"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M21.75 21.75V2.25H2.25V21.75H21.75ZM3.25 20.75H8.125V14.375H3.25V20.75ZM16.875 20.75H9.125V14.375H16.875H20.748H20.75V20.75H20.748H16.875ZM13.625 13.375H20.75V3.25H13.625V13.375ZM12.625 13.375H3.25V3.25H12.625V13.375Z" fill="#181818"/>
                  <path d="M16.875 14.375V20.75H20.748V14.375H16.875Z" fill="#181818"/>
                </svg>
              )}
            </ThemedText>
          </View>
        );
      case 'triangle':
        return (
          <View style={styles.iconContainer}>
            <ThemedText>
              {focused ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12.0003 2L19.9996 22H4.00098L12.0003 2Z" fill="#E02D2D"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19.2607 21.5H4.73926L12 3.3457L19.2607 21.5Z" stroke="#181818" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </ThemedText>
          </View>
        );
      case 'circle':
        return (
          <View style={styles.iconContainer}>
            <ThemedText>
              {focused ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#E02D2D"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="#181818"/>
                </svg>
              )}
            </ThemedText>
          </View>
        );
      case 'home':
        return (
          <View style={styles.iconContainer}>
            <ThemedText>
              {focused ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 10L12 2L22 10V22H2V10Z" fill="#E02D2D"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21.5 10.2139V21.5H2.5V10.2139L12 1.18945L21.5 10.2139Z" stroke="#181818" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
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

