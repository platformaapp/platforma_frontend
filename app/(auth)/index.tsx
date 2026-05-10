import { Link, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { View as ThemedView } from 'react-native';

export default function AuthChoiceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const btnPrimaryStyle = StyleSheet.flatten([styles.btn, styles.btnPrimary, { marginBottom: 16 }]);
  const btnOutlineStyle = StyleSheet.flatten([styles.btn, styles.btnOutline]);

  return (
    <ThemedView style={styles.container}>
      <Pressable style={[styles.close, { top: insets.top + 12 }]} onPress={() => router.back()}>
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <Path d="M2 2L22 22M22 2L2 22" stroke="#181818"/>
        </Svg>
      </Pressable>

      <ThemedText type="title" style={styles.title}>РЕГИСТРАЦИЯ</ThemedText>

      <View>
        <Link href="/register-student" asChild>
          <Pressable style={btnPrimaryStyle}> 
            <ThemedText style={[styles.btnPrimaryText, styles.btnPrimaryTextCustom]}>Хочу учиться</ThemedText>
          </Pressable>
        </Link>

        <Link href="/register-tutor" asChild>
          <Pressable style={btnOutlineStyle}> 
            <ThemedText style={[styles.btnOutlineText, styles.btnOutlineTextCustom]}>Хочу учить</ThemedText>
          </Pressable>
        </Link>
      </View>

      <Link href="/login" asChild>
        <Pressable style={{ marginTop: 'auto', paddingVertical: 24 }}>
          <ThemedText style={{ textAlign: 'center', fontFamily: "Inter-Regular",
fontSize: 14,
fontWeight: "400",
fontStyle: "normal",
lineHeight: 20,
color: "#181818" }}>У меня уже есть профиль</ThemedText>
        </Pressable>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    marginTop: 48,
    marginBottom: 24,
    fontFamily: "Inter-Regular", // Имя должно совпадать с ключом в useFonts
    fontSize: 28,
    fontWeight: "400",
    fontStyle: "normal",
    lineHeight: 36,
    letterSpacing: -2,
    color: "#181818"
  },
  btn: {
    borderRadius: 6,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#111',
  },
  btnPrimary: {
    backgroundColor: '#111',
    borderRadius: 0,
    height: 52,
    borderWidth: 1,
    borderColor: "rgba(24, 24, 24, 1.0)",
  },
  btnPrimaryText: {
    color:'#FFF',
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    height: 52,
    borderWidth: 1,
    borderColor: "rgba(24, 24, 24, 1.0)",
  },
  btnOutlineText: {
    color: '#111',
  },
  btnOutlineTextCustom: {
    // Уникальные стили только для "Хочу учить"
    // Примеры стилей, которые можно добавить:
    fontFamily: "Inter-Regular",
    fontSize: 14,
    fontWeight: "400",
    fontStyle: "normal",
    lineHeight: 20,
    color: "#181818",
  },
  btnPrimaryTextCustom: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    fontWeight: "400",
    fontStyle: "normal",
    lineHeight: 20,
    color: "#FAFAFA",
  },
  close: {
    position: 'absolute',
    right: 16,
    zIndex: 1,
    padding: 16,
  },
});


