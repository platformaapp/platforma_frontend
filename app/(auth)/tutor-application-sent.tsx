import { useRouter } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function TutorApplicationSentScreen() {
  const router = useRouter();

  function handleClose() {
    router.replace('/events');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.inner}>
          <Pressable style={styles.close} onPress={handleClose}>
            <ThemedText style={{ fontSize: 22 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 2L22 22M22 2L2 22" stroke="#181818"/>
              </svg>
            </ThemedText>
          </Pressable>

          <View style={styles.content}>
            <ThemedText type="title" style={styles.title}>
              ЗАЯВКА ОТПРАВЛЕНА!
            </ThemedText>

            <ThemedText style={styles.description}>
              Скоро мы ее одобрим. Это случится быстрее,{"\n"}чем вы заварите себе ромашковый чай
            </ThemedText>
          </View>

          <View style={styles.buttonContainer}>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleClose}>
              <ThemedText style={[styles.btnPrimaryText, styles.btnPrimaryTextCustom]}>
                Закрыть
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  inner: {
    flex: 1,
    minHeight: '100%',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    marginTop: 48,
    marginBottom: 24,
    fontFamily: "Inter-Regular",
    fontSize: 28,
    fontWeight: "400",
    fontStyle: "normal",
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
  },
  buttonContainer: {
    marginTop: 'auto',
    paddingBottom: 32,
  },
  btn: {
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    height: 52,
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
    fontStyle: "normal",
    lineHeight: 20,
    color: "#FAFAFA",
  },
  close: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 1,
    padding: 8,
  },
});

