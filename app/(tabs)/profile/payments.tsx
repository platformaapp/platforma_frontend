import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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

  const mapBindError = (status: number, fallback: string) => {
    switch (status) {
      case 400:
        return 'Некорректные данные карты';
      case 402:
        return 'Оплата не прошла';
      case 409:
        return 'Карта уже привязана';
      case 500:
        return 'Ошибка YooKassa';
      default:
        return fallback;
    }
  };

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

      const requestBind = async (url: string) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const contentType = response.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');
        const payload = isJson ? await response.json() : await response.text();
        return { response, payload };
      };

      let { response, payload } = await requestBind(endpoints.bindPaymentMethod);
      if (!response.ok && (response.status === 404 || response.status === 405)) {
        const retry = await requestBind(endpoints.bindPaymentMethodLegacy);
        response = retry.response;
        payload = retry.payload;
      }
      if (!response.ok) {
        const message = typeof payload === 'string' ? payload : payload?.message || 'Не удалось привязать карту';
        throw new Error(mapBindError(response.status, message));
      }

      const redirectUrl =
        payload?.redirect_url ||
        payload?.redirectUrl ||
        payload?.confirmation?.confirmation_url ||
        payload?.confirmation_url ||
        payload?.confirmationUrl;
      if (!redirectUrl) {
        throw new Error('Не удалось получить ссылку для подтверждения карты');
      }

      const paymentIdMatch = String(redirectUrl).match(/[?&]payment_id=([^&]+)/i);
      const paymentId = paymentIdMatch ? decodeURIComponent(paymentIdMatch[1]) : undefined;
      await WebBrowser.openBrowserAsync(redirectUrl);

      if (!paymentId) {
        throw new Error('Не удалось получить id платежа');
      }

      const requestCallback = async (url: string) => {
        const callbackUrl = `${url}?payment_id=${encodeURIComponent(paymentId)}`;
        const callbackRes = await fetch(callbackUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const contentType = callbackRes.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');
        const callbackPayload = isJson ? await callbackRes.json() : await callbackRes.text();
        return { callbackRes, callbackPayload };
      };

      let { callbackRes, callbackPayload } = await requestCallback(endpoints.paymentMethodsCallback);
      if (!callbackRes.ok && (callbackRes.status === 404 || callbackRes.status === 405)) {
        const retry = await requestCallback(endpoints.paymentMethodsCallbackLegacy);
        callbackRes = retry.callbackRes;
        callbackPayload = retry.callbackPayload;
      }
      if (!callbackRes.ok) {
        const message =
          typeof callbackPayload === 'string'
            ? callbackPayload
            : callbackPayload?.message || 'Ошибка привязки карты';
        throw new Error(mapBindError(callbackRes.status, message));
      }

      const status = callbackPayload?.status;
      if (status !== 'succeeded') {
        const message = callbackPayload?.message || 'Ошибка привязки карты';
        throw new Error(message);
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
