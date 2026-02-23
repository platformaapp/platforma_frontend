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
  getTutorPayments,
  getTutorPaymentsSummary,
  type Payment,
  type PaymentsSummary,
} from '@/lib/api/tutor';
import { bindPaymentMethod, deleteCurrentPaymentMethod } from '@/lib/api/student-payments';

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}.${mm}.${yy} ${hh}:${min}`;
  } catch {
    return iso;
  }
}

function formatAmount(amount: number): string {
  return `${amount.toLocaleString('ru-RU')} ₽`;
}

function statusLabel(status: string): string {
  if (status === 'success') return 'исполнено';
  if (status === 'pending') return 'в обработке';
  if (status === 'failed') return 'ошибка';
  return status;
}

const BALANCE_TOOLTIP = 'Не забудьте оплатить налоги и жить счастливо, счатливо';
const WITHDRAWAL_TOOLTIP =
  'Деньги на ваш счет придут в течение 3 рабочих дней, а может быть и раньше';

export default function TutorPaymentsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<PaymentsSummary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isWithdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editCardNumber, setEditCardNumber] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [isMoneySentModalVisible, setMoneySentModalVisible] = useState(false);
  const [isPaymentFailedModalVisible, setPaymentFailedModalVisible] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const cardMasked = 'Карта MIR * 2000';
  const cardBank = 'Тинькофф Банк';

  const loadData = useCallback(async () => {
    try {
      const [sum, list] = await Promise.all([
        getTutorPaymentsSummary(),
        getTutorPayments(),
      ]);
      setSummary(sum);
      setPayments(list);
    } catch (e: any) {
      setSummary(null);
      setPayments([]);
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      Promise.all([getTutorPaymentsSummary(), getTutorPayments()])
        .then(([sum, list]) => {
          if (!cancelled) {
            setSummary(sum);
            setPayments(list);
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setSummary(null);
            setPayments([]);
            Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить данные');
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => { cancelled = true; };
    }, [])
  );

  const handleWithdrawConfirm = async () => {
    setWithdrawModalVisible(false);
    setIsWithdrawing(true);
    try {
      // TODO: POST /tutor/withdraw — вызов API вывода средств
      await new Promise((r) => setTimeout(r, 300));
      setMoneySentModalVisible(true);
    } catch {
      setPaymentFailedModalVisible(true);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleWithdrawReplace = () => {
    setWithdrawModalVisible(false);
    setEditModalVisible(true);
  };

  const handlePaymentFailedRetry = () => {
    setPaymentFailedModalVisible(false);
    setWithdrawModalVisible(true);
  };

  const handlePaymentFailedChangeCard = () => {
    setPaymentFailedModalVisible(false);
    setEditModalVisible(true);
  };

  const handleDeleteCardClick = () => {
    setDeleteModalVisible(true);
  };

  const handleDeleteModalKeep = () => {
    setDeleteModalVisible(false);
  };

  const handleDeleteModalConfirm = async () => {
    setIsDeleting(true);
    try {
      await deleteCurrentPaymentMethod();
      setDeleteModalVisible(false);
      await loadData();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось удалить карту');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditCardClick = () => {
    setEditCardNumber('');
    setEditModalVisible(true);
  };

  const handleEditSubmit = async () => {
    if (isLinking) return;
    const number = editCardNumber.replace(/\s/g, '');
    if (!number || number.length < 13) {
      Alert.alert('Ошибка', 'Введите номер новой карты');
      return;
    }
    setIsLinking(true);
    try {
      await bindPaymentMethod({ provider: 'yookassa', card_number: number });
      setEditModalVisible(false);
      setEditCardNumber('');
      await loadData();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось изменить карту');
    } finally {
      setIsLinking(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#181818" />
      </View>
    );
  }

  const balance = summary?.balance ?? summary?.total_income ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="chevron-left" size={24} color="#181818" />
        </Pressable>
        <Text style={styles.title}>ПЛАТЕЖИ</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="always">
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Баланс</Text>
          <View style={styles.balanceRight}>
            <Text style={styles.balanceAmount}>{formatAmount(balance)}</Text>
            <Pressable
              style={styles.infoIcon}
              onPress={() => Alert.alert('О балансе', BALANCE_TOOLTIP)}
            >
              <MaterialIcons name="help-outline" size={18} color="#181818" />
            </Pressable>
          </View>
        </View>

        <View style={styles.cardBlock}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{cardMasked}</Text>
            <Text style={styles.cardSubtitle}>{cardBank}</Text>
          </View>
          <Pressable
            style={[styles.cardAction, styles.cardActionPrimary]}
            onPress={() => setWithdrawModalVisible(true)}
          >
            <Text style={styles.cardActionPrimaryText}>Вывести на карту</Text>
          </Pressable>
          <Pressable
            style={styles.cardAction}
            onPress={handleEditCardClick}
            disabled={isDeleting}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.cardActionText}>Изменить</Text>
          </Pressable>
          <Pressable
            style={[styles.cardAction, styles.cardActionDelete]}
            onPress={handleDeleteCardClick}
            disabled={isDeleting}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.cardActionDeleteText}>{isDeleting ? '…' : 'Удалить'}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>История платежей</Text>
        {payments.map((p) => (
          <View key={p.id} style={styles.historyRow}>
            <View style={styles.historyLeft}>
              <Text style={styles.historyId}>№{p.id.replace(/\D/g, '').slice(-5) || p.id.slice(-5)}</Text>
              <Text style={styles.historyDesc}>Вывод на карту</Text>
              <Text style={styles.historyDate}>{formatDate(p.created_at ?? '')}</Text>
            </View>
            <View style={styles.historyRight}>
              <View style={styles.historyStatusRow}>
                <Text style={styles.historyStatus}>{statusLabel(p.status)}</Text>
                <Pressable
                  style={styles.infoIcon}
                  onPress={() => Alert.alert('О выводе', WITHDRAWAL_TOOLTIP)}
                >
                  <MaterialIcons name="help-outline" size={18} color="#181818" />
                </Pressable>
              </View>
              <Text style={styles.historyAmount}>{formatAmount(p.amount)}</Text>
            </View>
          </View>
        ))}
        {payments.length === 0 ? (
          <Text style={styles.emptyText}>История пуста</Text>
        ) : null}
      </ScrollView>

      <Modal
        transparent
        animationType="none"
        visible={isWithdrawModalVisible}
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setWithdrawModalVisible(false)}
        >
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>ОТПРАВИТЬ ДЕНЬГИ НА ЭТУ КАРТУ?</Text>
            <View style={styles.modalEventCard}>
              <Text style={styles.modalEventTitle}>{cardMasked}</Text>
              <Text style={styles.modalEventSubtitle}>{cardBank}</Text>
            </View>
            <Pressable
              style={[styles.modalPayButton, isWithdrawing && styles.modalPayButtonDisabled]}
              onPress={handleWithdrawConfirm}
              disabled={isWithdrawing}
            >
              <Text style={styles.modalPayButtonText}>{isWithdrawing ? '…' : 'Да, все ок'}</Text>
            </Pressable>
            <Pressable
              style={styles.modalSecondaryButton}
              onPress={handleWithdrawReplace}
              disabled={isWithdrawing}
            >
              <Text style={styles.modalSecondaryButtonText}>Нет, заменю</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        animationType="none"
        visible={isMoneySentModalVisible}
        onRequestClose={() => { setMoneySentModalVisible(false); loadData(); }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => { setMoneySentModalVisible(false); loadData(); }}
        >
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>ДЕНЬГИ ОТПРАВЛЕНЫ!</Text>
            <Text style={styles.moneySentMessage}>
              Мы отправили вам на карту {formatAmount(balance)}.
            </Text>
            <Text style={styles.moneySentSubtext}>
              Они придут в течении 3 рабочих дней, а может быть и раньше.
            </Text>
            <Pressable
              style={styles.modalPayButton}
              onPress={() => { setMoneySentModalVisible(false); loadData(); }}
            >
              <Text style={styles.modalPayButtonText}>Закрыть</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        animationType="none"
        visible={isPaymentFailedModalVisible}
        onRequestClose={() => setPaymentFailedModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setPaymentFailedModalVisible(false)}
        >
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.paymentFailedTitle}>ОПЛАТА НЕ ПРОШЛА</Text>
            <Text style={styles.paymentFailedMessage}>
              Повторите попытку или попробуйте привязать другую карту
            </Text>
            <Pressable
              style={styles.modalPayButton}
              onPress={handlePaymentFailedRetry}
            >
              <Text style={styles.modalPayButtonText}>Попробовать еще раз</Text>
            </Pressable>
            <Pressable
              style={styles.modalSecondaryButton}
              onPress={handlePaymentFailedChangeCard}
            >
              <Text style={styles.modalSecondaryButtonText}>Сменить карту</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        animationType="none"
        visible={isDeleteModalVisible}
        onRequestClose={handleDeleteModalKeep}
      >
        <Pressable style={styles.modalOverlay} onPress={handleDeleteModalKeep}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>ВЫ ДЕЙСТВИТЕЛЬНО ХОТИТЕ УДАЛИТЬ КАРТУ?</Text>
            <Pressable style={styles.deleteModalKeepButton} onPress={handleDeleteModalKeep}>
              <Text style={styles.deleteModalKeepText}>Оставить</Text>
            </Pressable>
            <Pressable
              style={[styles.deleteModalDeleteButton, isDeleting && styles.deleteModalButtonDisabled]}
              onPress={handleDeleteModalConfirm}
              disabled={isDeleting}
            >
              <Text style={styles.deleteModalDeleteText}>{isDeleting ? '…' : 'Удалить'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        animationType="none"
        visible={isEditModalVisible}
        onRequestClose={() => { setEditModalVisible(false); setEditCardNumber(''); }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => { setEditModalVisible(false); setEditCardNumber(''); }}
        >
          <Pressable style={styles.editModalSheet} onPress={() => {}}>
            <ThemedText type="title" style={styles.editModalTitle}>
              ИЗМЕНИТЬ КАРТУ
            </ThemedText>

            <View style={styles.editCardInfo}>
              <Text style={styles.editCardLabel}>Текущая карта</Text>
              <Text style={styles.editCardMasked}>{cardMasked}</Text>
              <Text style={styles.editCardProvider}>{cardBank}</Text>
            </View>

            <TextInput
              placeholder="Номер новой карты"
              placeholderTextColor="#888"
              style={styles.editInput}
              value={editCardNumber}
              onChangeText={(t) => setEditCardNumber(t.replace(/\D/g, ''))}
              keyboardType="numeric"
              maxLength={19}
            />

            <Pressable
              style={[styles.editModalBtn, styles.editModalBtnPrimary, isLinking && styles.editModalBtnDisabled]}
              onPress={handleEditSubmit}
              disabled={isLinking}
            >
              <Text style={styles.editModalBtnText}>
                {isLinking ? 'Сохранение...' : 'Заменить'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  balanceRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceAmount: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  infoIcon: {
    padding: 4,
  },
  cardBlock: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    marginBottom: 24,
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
    color: '#9B9B9B',
  },
  cardAction: {
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#1E1E1E',
  },
  cardActionPrimary: {
    backgroundColor: '#111',
    borderTopWidth: 0,
  },
  cardActionPrimaryText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#FAFAFA',
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
  sectionTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
    marginBottom: 12,
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
  historyLeft: {
    flex: 1,
  },
  historyId: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  historyDesc: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginTop: 4,
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
  historyStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyStatus: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  historyAmount: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  modalTitle: {
    marginTop: 0,
    marginBottom: 8,
    fontFamily: 'Inter-Regular',
    fontWeight: '700',
    fontSize: 28,
    textTransform: 'uppercase',
    lineHeight: 36,
    letterSpacing: -1,
    color: '#181818',
    textAlign: 'left',
  },
  modalEventCard: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modalEventTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
    color: '#1E1E1E',
  },
  modalEventSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
    marginTop: 4,
  },
  modalPayButton: {
    marginTop: 16,
    backgroundColor: '#1E1E1E',
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalPayButtonDisabled: {
    opacity: 0.6,
  },
  moneySentMessage: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginTop: 12,
  },
  moneySentSubtext: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginTop: 8,
  },
  paymentFailedTitle: {
    marginTop: 0,
    marginBottom: 12,
    fontFamily: 'Inter-Regular',
    fontWeight: '700',
    fontSize: 28,
    textTransform: 'uppercase',
    lineHeight: 36,
    letterSpacing: -1,
    color: '#E2372A',
    textAlign: 'left',
  },
  paymentFailedMessage: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
    color: '#E2372A',
  },
  modalPayButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
  },
  modalSecondaryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  modalSecondaryButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  deleteModalKeepButton: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
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
  editModalSheet: {
    backgroundColor: '#fff',
    padding: 16,
  },
  editModalTitle: {
    marginTop: 0,
    marginBottom: 8,
    fontFamily: 'Inter-Regular',
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 36,
    letterSpacing: -2,
    color: '#181818',
    textAlign: 'left',
  },
  editCardInfo: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    padding: 12,
    marginBottom: 12,
  },
  editCardLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
    marginBottom: 4,
  },
  editCardMasked: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  editCardProvider: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
    marginTop: 4,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    borderRadius: 0,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#181818',
    marginBottom: 12,
  },
  editModalBtn: {
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    height: 52,
  },
  editModalBtnPrimary: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  editModalBtnDisabled: {
    opacity: 0.6,
  },
  editModalBtnText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#FAFAFA',
  },
});
