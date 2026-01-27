import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function RegistrationCompleteScreen() {
  const router = useRouter();
  const [isCardModalVisible, setCardModalVisible] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [remember, setRemember] = useState(true);

  function handleLinkNow() {
    setCardModalVisible(true);
  }

  function handleLinkLater() {
    // Пропускаем привязку карты и переходим на экран событий
    router.replace('/(tabs)/events');
  }

  function handleSubmitCard() {
    // Здесь может быть вызов API для привязки карты
    // Пока закрываем попап и переходим к событиям
    setCardModalVisible(false);
    router.replace('/(tabs)/events');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })} keyboardVerticalOffset={Platform.select({ ios: 80, android: 0 })}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.inner}>
          <Pressable style={styles.close} onPress={() => router.back()}>
            <ThemedText style={{ fontSize: 22 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 2L22 22M22 2L2 22" stroke="#181818"/>
              </svg>
            </ThemedText>
          </Pressable>

          <View style={styles.content}>
            <ThemedText type="title" style={styles.title}>
              РЕГИСТРАЦИЯ{"\n"}ЗАВЕРШЕНА!
            </ThemedText>

            <ThemedText style={styles.description}>
              Привяжите карту, чтобы ни в чем себе{"\n"}не отказывать
            </ThemedText>
          </View>

          <View style={styles.buttonsContainer}>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleLinkNow}>
              <ThemedText style={[styles.btnPrimaryText, styles.btnPrimaryTextCustom]}>
                Привязать сейчас
              </ThemedText>
            </Pressable>

            <Pressable style={[styles.btn, styles.btnOutline]} onPress={handleLinkLater}>
              <ThemedText style={[styles.btnOutlineText, styles.btnOutlineTextCustom]}>
                Привяжу потом
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>

        {isCardModalVisible && (
          <View style={styles.modalOverlay}>
            <Pressable style={styles.backdrop} onPress={() => setCardModalVisible(false)} />
            <View style={styles.modalSheet}>
              <ThemedText type="title" style={styles.modalTitle}>НОВАЯ КАРТА</ThemedText>

              <TextInput
                placeholder="Номер карты"
                placeholderTextColor="#888"
                style={styles.input}
                value={cardNumber}
                onChangeText={setCardNumber}
                keyboardType="numeric"
              />

              <View style={styles.row}>
                <TextInput
                  placeholder="MM/ГГ"
                  placeholderTextColor="#888"
                  style={[styles.input, styles.inputHalf]}
                  value={expiry}
                  onChangeText={setExpiry}
                  keyboardType="numeric"
                />
                <TextInput
                  placeholder="CVC2/CVV"
                  placeholderTextColor="#888"
                  style={[styles.input, styles.inputHalf]}
                  value={cvc}
                  onChangeText={setCvc}
                  keyboardType="numeric"
                />
              </View>

              <Pressable style={styles.checkboxRow} onPress={() => setRemember((prev) => !prev)}>
                <View style={styles.checkbox}>
                  {remember && (
                    <ThemedText style={styles.checkboxCheckmark}>✓</ThemedText>
                  )}
                </View>
                <ThemedText style={styles.checkboxLabel}>Запомнить карту</ThemedText>
              </Pressable>

              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleSubmitCard}>
                <ThemedText style={[styles.btnPrimaryText, styles.btnPrimaryTextCustom]}>
                  Продолжить
                </ThemedText>
              </Pressable>
            </View>
          </View>
        )}
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
    alignItems: 'baseline',
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
    textAlign: 'left',
  },
  description: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#181818",
    textAlign: 'left',
  },
  buttonsContainer: {
    gap: 12,
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
  btnOutline: {
    backgroundColor: 'transparent',
    borderColor: "rgba(24, 24, 24, 1.0)",
  },
  btnOutlineText: {
    color: '#111',
  },
  btnOutlineTextCustom: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    fontWeight: "400",
    fontStyle: "normal",
    lineHeight: 20,
    color: "#181818",
  },
  close: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 1,
    padding: 8,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    gap: 12,
  },
  modalTitle: {
    marginTop: 0,
    marginBottom: 8,
    fontFamily: 'Inter-Regular',
    fontSize: 28,
    fontWeight: '400',
    fontStyle: 'normal',
    lineHeight: 36,
    letterSpacing: -2,
    color: '#181818',
    textAlign: 'left',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(24, 24, 24, 1.0)',
    borderRadius: 0,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#181818',
  },
  inputHalf: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: '#181818',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCheckmark: {
    fontSize: 16,
    color: '#181818',
    fontWeight: 'bold',
    lineHeight: 20,
  },
  checkboxLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#181818',
  },
});

