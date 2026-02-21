import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

type TabIconProps = {
  focused: boolean;
  type: 'square' | 'triangle' | 'circle' | 'home';
};

const ACTIVE_COLOR = '#E02D2D';
const INACTIVE_COLOR = '#181818';

export function TabIcon({ focused, type }: TabIconProps) {
  const getIcon = () => {
    switch (type) {
      case 'square':
        return focused ? (
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M21.75 21.75V2.25H2.25V21.75H21.75ZM3.25 20.75H8.125V14.375H3.25V20.75ZM16.875 20.75H9.125V14.375H16.875H20.748H20.75V20.75H20.748H16.875ZM13.625 13.375H20.75V3.25H13.625V13.375ZM12.625 13.375H3.25V3.25H12.625V13.375Z"
              fill={ACTIVE_COLOR}
            />
            <Path d="M3.25 13.375H12.625V3.25H3.25V13.375Z" fill={ACTIVE_COLOR} />
            <Path d="M20.75 13.375H13.625V3.25H20.75V13.375Z" fill={ACTIVE_COLOR} />
            <Path d="M9.125 20.75H16.875V14.375H9.125V20.75Z" fill={ACTIVE_COLOR} />
            <Path d="M8.125 20.75H3.25V14.375H8.125V20.75Z" fill={ACTIVE_COLOR} />
          </Svg>
        ) : (
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M21.75 21.75V2.25H2.25V21.75H21.75ZM3.25 20.75H8.125V14.375H3.25V20.75ZM16.875 20.75H9.125V14.375H16.875H20.748H20.75V20.75H20.748H16.875ZM13.625 13.375H20.75V3.25H13.625V13.375ZM12.625 13.375H3.25V3.25H12.625V13.375Z"
              fill={INACTIVE_COLOR}
            />
            <Path d="M16.875 14.375V20.75H20.748V14.375H16.875Z" fill={INACTIVE_COLOR} />
          </Svg>
        );
      case 'triangle':
        return focused ? (
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M12.0003 2L19.9996 22H4.00098L12.0003 2Z" fill={ACTIVE_COLOR} />
          </Svg>
        ) : (
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M19.2607 21.5H4.73926L12 3.3457L19.2607 21.5Z"
              stroke={INACTIVE_COLOR}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        );
      case 'circle':
        return focused ? (
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="10" fill={ACTIVE_COLOR} />
          </Svg>
        ) : (
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="10" stroke={INACTIVE_COLOR} />
          </Svg>
        );
      case 'home':
        return focused ? (
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M2 10L12 2L22 10V22H2V10Z" fill={ACTIVE_COLOR} />
          </Svg>
        ) : (
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M21.5 10.2139V21.5H2.5V10.2139L12 1.18945L21.5 10.2139Z"
              stroke={INACTIVE_COLOR}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {getIcon()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
