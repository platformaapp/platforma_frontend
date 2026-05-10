import { useRouter } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function TutorApplicationSentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function handleClose() {
    router.replace('/(tabs)/events');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <ThemedView style={styles.container}>
        <Pressable style={[styles.close, { top: insets.top + 12 }]} onPress={handleClose}>
          <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <Path d="M2 2L22 22M22 2L2 22" stroke="#181818"/>
          </Svg>
        </Pressable>

        <View style={styles.center}>
          <ThemedText type="title" style={styles.title}>
            ЗАЯВКА ОТПРАВЛЕНА!
          </ThemedText>

          <ThemedText style={styles.description}>
            Скоро мы ее одобрим. Это случится быстрее,{"\n"}чем вы заварите себе ромашковый чай
          </ThemedText>

          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleClose}>
            <ThemedText style={[styles.btnPrimaryText, styles.btnPrimaryTextCustom]}>
              Закрыть
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  close: {
    position: 'absolute',
    right: 16,
    zIndex: 1,
    padding: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    marginBottom: 16,
    fontFamily: "Inter-Regular",
    fontSize: 28,
    fontWeight: "400",
    lineHeight: 36,
    letterSpacing: -2,
    color: "#181818",
    textAlign: 'center',
  },
  description: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#181818",
    textAlign: 'center',
    marginBottom: 32,
  },
  btn: {
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    height: 52,
    alignSelf: 'stretch',
  },
  btnPrimary: {
    backgroundColor: '#111',
    borderColor: "rgba(24, 24, 24, 1.0)",
  },
  btnPrimaryText: {
    color: '#FFF',
  },
  btnPrimaryTextCustom: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
    color: "#FAFAFA",
  },
});

