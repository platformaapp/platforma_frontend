import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { enableScreens } from 'react-native-screens';
import 'react-native-reanimated';

// Hover-затемнение для любого кликабельного блока (Pressable) — та же CSS-
// строка уже лежит в app/+html.tsx (статический шелл при экспорте), но тот
// файл — не обычный компонент и Metro не обязан подхватывать его правки
// hot-reload'ом на уже запущенном dev-сервере (нужен полный рестарт). Этот
// же блок, вставленный из обычного компонента через useEffect, гарантированно
// живёт в актуальном виде при любой пересборке. Дублирование с +html.tsx
// безвредно — оба применяют одно и то же правило.
const HOVER_DIM_STYLE_ID = 'hover-dim-style';
const HOVER_DIM_CSS = `
  @media (hover: hover) and (pointer: fine) {
    .r-cursor-1loqt21 { transition: opacity 0.18s ease; }
    .r-cursor-1loqt21:hover { opacity: 0.5; }
  }
`;

function useHoverDimStyle() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    let styleEl = document.getElementById(HOVER_DIM_STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = HOVER_DIM_STYLE_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = HOVER_DIM_CSS;
  }, []);
}

// react-native-screens ~4.16 крашит на iOS 26 в RNSTabBarController.updateTabBarAppearance
// (https://github.com/software-mansion/react-native-screens/issues/3940), а RN 0.81.x не
// перехватывает NSException из async void TurboModule-методов, поэтому это не JS-ошибка,
// а хард-краш всего приложения на старте. Апгрейд screens невозможен: 4.25+/4.26+ требуют
// react-native >=0.82/>=0.84, а Expo SDK 54 закреплён на 0.81.5. Отключаем нативные экраны
// как обходной путь до апстрим-фикса.
enableScreens(false);

// Предотвращаем автоматическое скрытие splash screen
SplashScreen.preventAutoHideAsync();

const styles = StyleSheet.create({
  pageBackground: {
    flex: 1,
    backgroundColor: '#fff',
  },
  // Веб теперь на всю ширину браузера (отдельный десктоп-дизайн для веба) —
  // раньше здесь было max-width:620 на web, имитируя мобильную колонку.
  // Экраны, ещё не получившие веб-дизайн, могут временно выглядеть растянутыми.
  contentFrame: {
    flex: 1,
    width: '100%',
    backgroundColor: '#fff',
  },
});

export const unstable_settings = {
  // No anchor — router must start at the actual URL (important for web deep links
  // such as /reset-password?token=...). Setting anchor:'(tabs)' caused Expo Router
  // to initialise at the (tabs) group first, firing the index redirect to /events
  // and cancelling any in-flight deep-link navigation.
};

export default function RootLayout() {
  useHoverDimStyle();

  // Загружаем шрифты
  // ВАЖНО: React Native поддерживает только .ttf и .otf форматы
  // Если у вас .woff файлы, их нужно конвертировать в .ttf
  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': require('../assets/fonts/Inter/Inter_18pt-Regular.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter/Inter_18pt-Bold.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter/Inter_18pt-Medium.ttf'),
    'Inter-Light': require('../assets/fonts/Inter/Inter-Light-BETA.ttf'),
    // Фирменный шрифт с vladyakunin.ru — основной шрифт приложения. Везде
    // используется только начертание Regular, жирность регулируется через
    // fontWeight (браузер/ОС сами синтезируют полужирное начертание) —
    // отдельные Bold-файлы гарнитуры поэтому не подключаем.
    'Gramatika-Regular': require('../assets/fonts/Gramatika/Gramatika-Regular.ttf'),
    'Gramatika-Slanted': require('../assets/fonts/Gramatika/Gramatika-Slanted.ttf'),
    'Gramatika-Shifted': require('../assets/fonts/Gramatika/Gramatika-Shifted.ttf'),
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
    <ThemeProvider value={DefaultTheme}>
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
            <Stack.Screen name="conference" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          </Stack>
        </View>
      </View>
      <StatusBar style="auto" />
    </ThemeProvider>
  )
}
