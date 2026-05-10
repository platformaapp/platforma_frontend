import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

// Предотвращаем автоматическое скрытие splash screen
SplashScreen.preventAutoHideAsync();

const styles = StyleSheet.create({
  pageBackground: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentFrame: {
    flex: 1,
    width: '100%',
    backgroundColor: '#fff',
    ...(Platform.OS === 'web' ? { maxWidth: 620, alignSelf: 'center' as const } : {}),
  },
});

export const unstable_settings = {
  // No anchor — router must start at the actual URL (important for web deep links
  // such as /reset-password?token=...). Setting anchor:'(tabs)' caused Expo Router
  // to initialise at the (tabs) group first, firing the index redirect to /events
  // and cancelling any in-flight deep-link navigation.
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Загружаем шрифты
  // ВАЖНО: React Native поддерживает только .ttf и .otf форматы
  // Если у вас .woff файлы, их нужно конвертировать в .ttf
  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': require('../assets/fonts/Inter/Inter_18pt-Regular.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter/Inter_18pt-Bold.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter/Inter_18pt-Medium.ttf'),
    'Inter-Light': require('../assets/fonts/Inter/Inter-Light-BETA.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      // Скрываем splash screen после загрузки шрифтов
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null; // Показываем splash screen пока загружаются шрифты
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <View style={styles.pageBackground}>
        <View style={styles.contentFrame}>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              animationDuration: 220,
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false, animation: 'none' }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="admin" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', animation: 'slide_from_bottom', title: 'Modal' }} />
          </Stack>
        </View>
      </View>
      <StatusBar style="auto" />
    </ThemeProvider>
  )
}
