import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { bindPaymentMethod } from '@/lib/api/student-payments';
import { getCardLinked, getCardMasked, setCardLinked } from '@/lib/payments';

export default function PaymentsScreen() {
  const router = useRouter();
  const [isLinking, setIsLinking] = useState(false);
  const [isCardModalVisible, setCardModalVisible] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [isCardLinked, setIsCardLinked] = useState(false);

  const [cardMasked, setCardMaskedState] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([getCardLinked(), getCardMasked()]).then(([linked, masked]) => {
        if (!cancelled) {
          setIsCardLinked(linked);
          setCardMaskedState(masked);
        }
      });
      return () => { cancelled = true; };
    }, [])
  );

  const handleLinkCard = () => {
    if (isLinking) return;
    setCardModalVisible(true);
  };

  const handleSubmitCard = async () => {
    if (isLinking) return;
    const number = cardNumber.replace(/\s/g, '');
    if (!number || number.length < 13) {
      Alert.alert('Ошибка', 'Введите номер карты');
      return;
    }
    setIsLinking(true);
    try {
      const result = await bindPaymentMethod({
        provider: 'yookassa',
        card_number: number,
      });
      await setCardLinked(true, result.card_masked);
      setIsCardLinked(true);
      setCardMaskedState(result.card_masked);
      setCardModalVisible(false);
      setCardNumber('');
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
          <MaterialIcons name="chevron-left" size={24} color="#181818" />
        </Pressable>
      </View>

      <Text style={styles.title}>ПЛАТЕЖИ</Text>

      {isCardLinked ? (
        <View style={styles.card}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>Карта {cardMasked ?? '**** ****'}</Text>
          </View>
          <Pressable style={styles.cardAction} onPress={handleLinkCard}>
            <Text style={styles.cardActionText}>Изменить</Text>
          </Pressable>
          <Pressable
            style={[styles.cardAction, styles.cardActionDelete]}
            onPress={async () => {
              await setCardLinked(false);
              setIsCardLinked(false);
              setCardMaskedState(null);
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
              onChangeText={(t) => setCardNumber(t.replace(/\D/g, ''))}
              keyboardType="numeric"
              maxLength={19}
            />

            <Pressable style={[styles.btn, styles.btnPrimary, isLinking && styles.btnDisabled]} onPress={handleSubmitCard} disabled={isLinking}>
              <ThemedText style={[styles.btnPrimaryText, styles.btnPrimaryTextCustom]}>
                {isLinking ? 'Привязка...' : 'Продолжить'}
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
  btnDisabled: {
    opacity: 0.6,
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
