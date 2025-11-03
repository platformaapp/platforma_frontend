import { StyleSheet, View, type ViewProps } from 'react-native';


export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  // Normalize to a single plain object. Avoid arrays entirely for web compatibility.
  const styleObj = StyleSheet.flatten(style) || {};
  return <View style={styleObj} {...otherProps} />;
}
