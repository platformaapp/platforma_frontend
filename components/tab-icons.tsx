import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

type TabIconProps = {
  focused: boolean;
  type: 'square' | 'triangle' | 'circle' | 'home';
};

const ACTIVE_COLOR = '#E02D2D';
const INACTIVE_COLOR = '#181818';

export function TabIcon({ focused, type }: TabIconProps) {
  const color = focused ? ACTIVE_COLOR : INACTIVE_COLOR;

  const iconName = (): React.ComponentProps<typeof MaterialIcons>['name'] => {
    switch (type) {
      case 'square':
        return 'grid-view';
      case 'triangle':
        return 'change-history';
      case 'circle':
        return focused ? 'lens' : 'radio-button-unchecked';
      case 'home':
        return 'home';
      default:
        return 'circle';
    }
  };

  return (
    <View style={styles.container}>
      <MaterialIcons name={iconName()} size={24} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

