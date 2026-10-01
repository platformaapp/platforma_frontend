import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { enableScreens } from 'react-native-screens';
import 'react-native-reanimated';

// Hover-затемнение для любого кликабельного блока (Pressable) сайта разом,
// плюс подчёркивание красных текстовых кнопок/ссылок при наведении — оба
// правила целятся в "атомарные" CSS-классы, которые react-native-web сам
// генерирует для cursor:'pointer' и color:'#E02D2D' — общие для ВСЕХ
// элементов с этим стилем, поэтому не нужно править каждый Pressable по
// отдельности. Раньше хеш этих классов был захардкожен в CSS (например
// ".r-cursor-1loqt21"), затем — определялся в рантайме, но по префиксу
// "r-cursor-"/"r-color-". Оба варианта сломались на проде: там react-
// native-web вообще не кладёт имя CSS-свойства в класс (там просто
// "r-1loqt21", без "cursor-"), в отличие от dev-сборки — то есть между
// dev и production отличается не только хеш, а сама схема именования
// классов. Поэтому больше не предполагаем НИКАКОЙ схемы: рендерим пару
// "пустой / со стилем" элементов одного типа и сравниваем их реальные
// className — класс(ы), которых нет на пустом элементе, это и есть
// то, что добавил нужный стиль, какой бы схемой именования библиотека
// внутри ни пользовалась.
const HOVER_DIM_STYLE_ID = 'hover-dim-style';

function diffClass(styledEl: HTMLElement | null, blankEl: HTMLElement | null): string | null {
  if (!styledEl || !blankEl) return null;
  const blankClasses = new Set(Array.from(blankEl.classList));
  const extra = Array.from(styledEl.classList).find((c) => !blankClasses.has(c));
  return extra ?? null;
}

function buildHoverDimCss(cursorClass: string, redClass: string | null): string {
  const redRule = redClass ? `
    .${cursorClass}:hover.${redClass},
    .${cursorClass}:hover .${redClass} {
      text-decoration: underline;
      text-underline-offset: 3px;
    }
  ` : '';
  return `
    @media (hover: hover) and (pointer: fine) {
      .${cursorClass} { transition: opacity 0.18s ease; }
      .${cursorClass}:hover { opacity: 0.5; }
      /* Внутри попапов (aria-modal="true" на корневом div любого <Modal>)
         затемнение при наведении не нужно. */
      [aria-modal="true"] .${cursorClass}:hover { opacity: 1; }
      ${redRule}
    }
  `;
}

function HoverDimCalibrator() {
  const blankViewRef = useRef<any>(null);
  const cursorRef = useRef<any>(null);
  const blankTextRef = useRef<any>(null);
  const redRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const cursorClass = diffClass(cursorRef.current, blankViewRef.current);
    if (!cursorClass) return; // не должно случиться — на всякий случай не ломаем страницу
    const redClass = diffClass(redRef.current, blankTextRef.current);

    let styleEl = document.getElementById(HOVER_DIM_STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = HOVER_DIM_STYLE_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = buildHoverDimCss(cursorClass, redClass);
  }, []);

  return (
    <View pointerEvents="none" style={calibratorStyles.hidden}>
      <View ref={blankViewRef} />
      <View ref={cursorRef} style={calibratorStyles.cursor as any} />
      <Text ref={blankTextRef}>.</Text>
      <Text ref={redRef} style={calibratorStyles.red}>.</Text>
    </View>
  );
}

const calibratorStyles = StyleSheet.create({
  hidden: { position: 'absolute', width: 0, height: 0, overflow: 'hidden' },
  cursor: { cursor: 'pointer' },
  red: { color: '#E02D2D' },
});

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
      <HoverDimCalibrator />
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
