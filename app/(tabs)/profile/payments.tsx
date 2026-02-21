import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { endpoints } from '@/constants/env';
import { getAuthToken } from '@/lib/auth';
import { getCardLinked, setCardLinked } from '@/lib/payments';

export default function PaymentsScreen() {
  const router = useRouter();
  const [isLinking, setIsLinking] = useState(false);
  const [isCardModalVisible, setCardModalVisible] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [remember, setRemember] = useState(true);
  const [isCardLinked, setIsCardLinked] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadCardState = async () => {
      const linked = await getCardLinked();
      if (isMounted) {
        setIsCardLinked(linked);
      }
    };
    loadCardState();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLinkCard = () => {
    if (isLinking) return;
    setCardModalVisible(true);
  };

  const handleSubmitCard = async () => {
    if (isLinking) return;
    setIsLinking(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Для привязки карты нужно войти в аккаунт');
      }

      // const returnUrl = Linking.createURL('/(tabs)/profile/payments');
      const returnUrl = 'http://194.67.88.237/(tabs)/profile/payments';
      const res = await fetch(endpoints.bindPaymentMethod, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          returnUrl,
          remember,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = isJson ? await res.json() : await res.text();
      if (!res.ok) {
        const message = typeof data === 'string' ? data : data?.message || 'Не удалось привязать карту';
        throw new Error(message);
      }

      const confirmationUrl =
        data?.confirmation?.confirmation_url ||
        data?.confirmation_url ||
        data?.confirmationUrl ||
        data?.payment?.confirmation?.confirmation_url ||
        data?.payment?.confirmation_url;
      if (confirmationUrl) {
        await WebBrowser.openBrowserAsync(confirmationUrl);
      }

      const paymentMethodId =
        data?.payment_method_id ||
        data?.paymentMethodId ||
        data?.payment_method?.id ||
        data?.paymentMethod?.id ||
        data?.data?.payment_method_id ||
        data?.data?.paymentMethodId;
      const status = data?.status || data?.payment?.status;
      const isActive = status === 'active' || status === 'succeeded' || Boolean(paymentMethodId);
      if (!isActive) {
        throw new Error('Не удалось подтвердить карту');
      }

      await setCardLinked(true);
      setIsCardLinked(true);
      setCardModalVisible(false);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось привязать карту');
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ThemedText>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="#181818" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </ThemedText>
        </Pressable>
      </View>

      <Text style={styles.title}>ПЛАТЕЖИ</Text>

      {isCardLinked ? (
        <View style={styles.card}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>Карта MIR *2000</Text>
            <Text style={styles.cardSubtitle}>Тинькофф Банк</Text>
          </View>
          <Pressable style={styles.cardAction} onPress={handleLinkCard}>
            <Text style={styles.cardActionText}>Изменить</Text>
          </Pressable>
          <Pressable
            style={[styles.cardAction, styles.cardActionDelete]}
            onPress={async () => {
              await setCardLinked(false);
              setIsCardLinked(false);
            }}
          >
            <Text style={styles.cardActionDeleteText}>Удалить</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.linkRow} onPress={handleLinkCard}>
          <View style={styles.plusBox}>
            <Text style={styles.plusText}>+</Text>
          </View>
          <View style={styles.linkTextBox}>
            <Text style={styles.linkText}>{isLinking ? 'Привязка...' : 'Привязать карту'}</Text>
          </View>
        </Pressable>
      )}

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  header: {
    paddingTop: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 12,
    marginBottom: 16,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  linkRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#1E1E1E',
    height: 52,
  },
  plusBox: {
    width: 52,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
  },
  linkTextBox: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  linkText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  card: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  cardInfo: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#1E1E1E',
  },
  cardTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  cardAction: {
    borderTopWidth: 1,
    borderColor: '#1E1E1E',
    paddingVertical: 14,
    alignItems: 'center',
  },
  cardActionText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  cardActionDelete: {
    borderColor: '#E02D2D',
  },
  cardActionDeleteText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#E02D2D',
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
  btn: {
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    height: 52,
  },
  btnPrimary: {
    backgroundColor: '#111',
    borderColor: 'rgba(24, 24, 24, 1.0)',
  },
  btnPrimaryText: {
    color: '#FFF',
  },
  btnPrimaryTextCustom: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    fontWeight: '400',
    fontStyle: 'normal',
    lineHeight: 20,
    color: '#FAFAFA',
  },
});
