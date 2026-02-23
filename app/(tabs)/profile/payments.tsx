import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  bindPaymentMethod,
  deleteCurrentPaymentMethod,
  deletePaymentMethod,
  getStudentPayments,
  type Card,
  type PaymentHistoryItem,
} from '@/lib/api/student-payments';
import { setCardLinked } from '@/lib/payments';

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatAmount(amount: number): string {
  return `${amount.toLocaleString('ru-RU')} ₽`;
}

export default function PaymentsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isLinking, setIsLinking] = useState(false);
  const [isCardModalVisible, setCardModalVisible] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<Card | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await getStudentPayments();
      setCards(data.cards);
      setHistory(data.history);
    } catch (e: any) {
      setCards([]);
      setHistory([]);
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      getStudentPayments()
        .then((data) => {
          if (!cancelled) {
            setCards(data.cards);
            setHistory(data.history);
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setCards([]);
            setHistory([]);
            Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить данные');
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
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
      setCardModalVisible(false);
      setCardNumber('');
      await loadData();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось привязать карту');
    } finally {
      setIsLinking(false);
    }
  };

  const handleDeleteCardClick = (card: Card) => {
    setCardToDelete(card);
    setDeleteModalVisible(true);
  };

  const handleDeleteModalKeep = () => {
    setDeleteModalVisible(false);
    setCardToDelete(null);
  };

  const handleDeleteModalConfirm = async () => {
    if (!cardToDelete) return;
    setDeletingId(cardToDelete.id);
    try {
      try {
        await deleteCurrentPaymentMethod();
      } catch {
        await deletePaymentMethod(cardToDelete.id);
      }
      await setCardLinked(false);
      setDeleteModalVisible(false);
      setCardToDelete(null);
      await loadData();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось удалить карту');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#181818" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="chevron-left" size={24} color="#181818" />
        </Pressable>
        <Text style={styles.title}>ПЛАТЕЖИ</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Карты</Text>
        {cards.length > 0 ? (
          cards.map((card) => (
            <View key={card.id} style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>Карта {card.card_masked}</Text>
                <Text style={styles.cardSubtitle}>{card.provider}</Text>
              </View>
              <View style={styles.cardActions}>
                <Pressable style={[styles.cardAction, styles.cardActionDelete]} onPress={() => handleDeleteCardClick(card)} disabled={deletingId !== null}>
                  <Text style={styles.cardActionDeleteText}>
                    {deletingId === card.id ? '…' : 'Удалить'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        ) : null}
        <Pressable style={styles.linkRow} onPress={handleLinkCard} disabled={isLinking}>
          <View style={styles.plusBox}>
            <Text style={styles.plusText}>+</Text>
          </View>
          <View style={styles.linkTextBox}>
            <Text style={styles.linkText}>{isLinking ? 'Привязка...' : 'Привязать карту'}</Text>
          </View>
        </Pressable>

        {history.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, styles.sectionTitleHistory]}>История оплат</Text>
            {history.map((item) => (
              <View key={item.id} style={styles.historyRow}>
                <View style={styles.historyMain}>
                  <Text style={styles.historyTutor}>{item.tutor}</Text>
                  <Text style={styles.historyDate}>{formatDate(item.created_at)}</Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={styles.historyAmount}>{formatAmount(item.amount)}</Text>
                  <Text
                    style={[
                      styles.historyStatus,
                      item.status === 'success' && styles.historyStatusSuccess,
                      item.status === 'failed' && styles.historyStatusFailed,
                    ]}
                  >
                    {item.status === 'success' ? 'Оплачено' : item.status === 'failed' ? 'Ошибка' : 'В обработке'}
                  </Text>
                </View>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>

      <Modal
        transparent
        animationType="none"
        visible={isDeleteModalVisible}
        onRequestClose={handleDeleteModalKeep}
      >
        <Pressable style={styles.deleteModalOverlay} onPress={handleDeleteModalKeep}>
          <Pressable style={styles.deleteModalSheet} onPress={() => {}}>
            <Text style={styles.deleteModalTitle}>ВЫ ДЕЙСТВИТЕЛЬНО ХОТИТЕ УДАЛИТЬ КАРТУ?</Text>
            <Pressable style={styles.deleteModalKeepButton} onPress={handleDeleteModalKeep}>
              <Text style={styles.deleteModalKeepText}>Оставить</Text>
            </Pressable>
            <Pressable
              style={[styles.deleteModalDeleteButton, deletingId && styles.deleteModalButtonDisabled]}
              onPress={handleDeleteModalConfirm}
              disabled={!!deletingId}
            >
              <Text style={styles.deleteModalDeleteText}>{deletingId ? '…' : 'Удалить'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {isCardModalVisible && (
        <View style={styles.modalOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setCardModalVisible(false)} />
          <View style={styles.modalSheet}>
            <ThemedText type="title" style={styles.modalTitle}>
              НОВАЯ КАРТА
            </ThemedText>

            <TextInput
              placeholder="Номер карты"
              placeholderTextColor="#888"
              style={styles.input}
              value={cardNumber}
              onChangeText={(t) => setCardNumber(t.replace(/\D/g, ''))}
              keyboardType="numeric"
              maxLength={19}
            />

            <Pressable
              style={[styles.btn, styles.btnPrimary, isLinking && styles.btnDisabled]}
              onPress={handleSubmitCard}
              disabled={isLinking}
            >
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
  content: {
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
    marginBottom: 12,
  },
  sectionTitleHistory: {
    marginTop: 24,
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
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E1E1E',
    marginBottom: 12,
  },
  cardInfo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
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
    color: '#9B9B9B',
  },
  cardActions: {
    flexDirection: 'row',
  },
  cardAction: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  cardActionDelete: {
    borderLeftWidth: 1,
    borderColor: '#E02D2D',
  },
  cardActionDeleteText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#E02D2D',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    marginBottom: 8,
  },
  historyMain: {
    flex: 1,
  },
  historyTutor: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  historyDate: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
    marginTop: 4,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyAmount: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  historyStatus: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
    marginTop: 4,
  },
  historyStatusSuccess: {
    color: '#2E7D32',
  },
  historyStatusFailed: {
    color: '#E02D2D',
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  deleteModalSheet: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  deleteModalTitle: {
    marginTop: 0,
    marginBottom: 24,
    fontFamily: 'Inter-Regular',
    fontWeight: '700',
    fontSize: 28,
    textTransform: 'uppercase',
    lineHeight: 36,
    letterSpacing: -1,
    color: '#181818',
    textAlign: 'center',
  },
  deleteModalKeepButton: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteModalKeepText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  deleteModalDeleteButton: {
    backgroundColor: '#E2372A',
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteModalButtonDisabled: {
    opacity: 0.6,
  },
  deleteModalDeleteText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
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
