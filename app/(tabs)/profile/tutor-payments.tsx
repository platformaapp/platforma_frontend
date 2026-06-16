import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import {
  getTutorPayments,
  getTutorPaymentsSummary,
  getTutorPayoutsBalance,
  getTutorPayouts,
  type Payment,
  type PaymentsSummary,
  type PayoutBalance,
  type Payout,
} from '@/lib/api/tutor';
import {
  bindPaymentMethod,
  deleteCurrentPaymentMethod,
  getPaymentMethods,
  PENDING_CARD_BINDING_INITIAL_COUNT_KEY,
  PENDING_CARD_BINDING_PAYMENT_ID_KEY,
  type Card,
} from '@/lib/api/student-payments';
import { endpoints } from '@/constants/env';
import { getAuthToken } from '@/lib/auth';
import * as Linking from 'expo-linking';

function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}.${mm}.${yy} ${hh}:${min}`;
  } catch {
    return '—';
  }
}

function formatAmount(amount: number): string {
  return `${amount.toLocaleString('ru-RU')} ₽`;
}

function statusLabel(status: string): string {
  if (status === 'success' || status === 'succeeded') return 'исполнено';
  if (status === 'pending') return 'в обработке';
  if (status === 'failed') return 'ошибка';
  return status;
}

const BALANCE_TOOLTIP = 'Не забудьте оплатить налоги и жить счастливо, счатливо';
const WITHDRAWAL_TOOLTIP =
  'Мы отправили вам деньги на карту. Они придут в течении 3 рабочих дней, а может быть и раньше.';

export default function TutorPaymentsScreen() {
  const router = useRouter();
  const { refresh } = useLocalSearchParams<{ refresh?: string }>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<PaymentsSummary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payoutBalance, setPayoutBalance] = useState<PayoutBalance | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [isWithdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleteSuccessVisible, setDeleteSuccessVisible] = useState(false);
  const [isCardBoundSuccessVisible, setCardBoundSuccessVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [bindError, setBindError] = useState<string | null>(null);
  const [isMoneySentModalVisible, setMoneySentModalVisible] = useState(false);
  const [isPaymentFailedModalVisible, setPaymentFailedModalVisible] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);

  const activeCard = cards[0] ?? null;
  const cardMasked = activeCard?.cardMasked ?? activeCard?.card_masked ?? '';
  const cardBank = activeCard?.cardType ?? activeCard?.provider ?? '';

  const loadCards = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch(endpoints.paymentsMethod, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setCards(data?.data?.paymentMethods ?? []);
      } else {
        // fallback
        const methods = await getPaymentMethods();
        setCards(methods);
      }
    } catch {
      setCards([]);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [sum, list, bal, pouts] = await Promise.all([
        getTutorPaymentsSummary().catch(() => null),
        getTutorPayments().catch(() => [] as Payment[]),
        getTutorPayoutsBalance().catch(() => null),
        getTutorPayouts().catch(() => [] as Payout[]),
      ]);
      setSummary(sum);
      setPayments(list);
      setPayoutBalance(bal);
      setPayouts(pouts);
      await loadCards();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }, [loadCards]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      Promise.all([
        getTutorPaymentsSummary().catch(() => null),
        getTutorPayments().catch(() => [] as Payment[]),
        getTutorPayoutsBalance().catch(() => null),
        getTutorPayouts().catch(() => [] as Payout[]),
      ])
        .then(([sum, list, bal, pouts]) => {
          if (!cancelled) {
            setSummary(sum);
            setPayments(list);
            setPayoutBalance(bal);
            setPayouts(pouts);
          }
          return loadCards();
        })
        .catch((e) => {
          if (!cancelled) Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить данные');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => { cancelled = true; };
    }, [loadCards])
  );

  // Show popup + retry when returning from card-binding callback
  useEffect(() => {
    if (!refresh) return;
    setCardBoundSuccessVisible(true);
    loadCards();
    const retryTimer = setTimeout(() => { loadCards(); }, 3000);
    return () => clearTimeout(retryTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

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
      setDeleteSuccessVisible(true);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось удалить карту');
    } finally {
      await loadCards();
      setIsDeleting(false);
    }
  };

  const handleEditCardClick = () => {
    setEditModalVisible(true);
  };

  const handleEditSubmit = async () => {
    if (isLinking) return;
    setIsLinking(true);
    setBindError(null);
    try {
      // Preflight: get card count before binding (best-effort, 5s max)
      let cardCountBefore = 0;
      try {
        const methods = await Promise.race([
          getPaymentMethods(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
        ]);
        cardCountBefore = (methods as Card[]).length;
      } catch {
        /* ignore — 0 is safe fallback */
      }

      const token = await getAuthToken();
      if (!token) throw new Error('Требуется авторизация');

      const bindRes = await Promise.race([
        fetch(endpoints.paymentMethodsBind, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ provider: 'yookassa' }),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Время ожидания истекло, попробуйте ещё раз')), 15000),
        ),
      ]);

      const bindJson = await bindRes.json().catch(() => ({}));
      if (!bindRes.ok) {
        throw new Error(bindJson?.message ?? bindJson?.error ?? `Ошибка сервера (${bindRes.status})`);
      }

      const confirmationUrl: string | undefined = bindJson?.data?.confirmationUrl;
      const attachmentId: string | undefined = bindJson?.data?.attachmentId;
      const yookassaPaymentId: string | undefined = bindJson?.data?.yookassaPaymentId;

      if (!confirmationUrl) throw new Error('Сервер не вернул ссылку для привязки карты');

      // Open YooKassa in system browser, then navigate to status polling page
      setEditModalVisible(false);
      await Linking.openURL(confirmationUrl);

      router.push({
        pathname: '/(tabs)/profile/payment-methods-callback',
        params: {
          transactionId: attachmentId ?? '',
          yookassaPaymentId: yookassaPaymentId ?? '',
          initialCardCount: String(cardCountBefore),
          returnTo: 'tutor-payments',
        },
      });
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? 'Не удалось привязать карту';
      setBindError(msg);
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

  const balance = payoutBalance?.balance ?? summary?.balance ?? summary?.total_income ?? 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backButton} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile' as any)}>
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

        {activeCard ? (
          <View style={styles.cardBlock}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{cardMasked || 'Карта привязана'}</Text>
              {cardBank ? <Text style={styles.cardSubtitle}>{cardBank}</Text> : null}
            </View>
            <Pressable
              style={[styles.cardAction, styles.cardActionPrimary]}
              onPress={() => setWithdrawModalVisible(true)}
            >
              <Text style={styles.cardActionPrimaryText}>Запросить выплату</Text>
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
        ) : (
          <Pressable style={styles.linkCardRow} onPress={handleEditCardClick}>
            <View style={styles.plusBox}>
              <Text style={styles.plusText}>+</Text>
            </View>
            <View style={styles.linkTextBox}>
              <Text style={styles.linkText}>Привязать карту для получения выплат</Text>
            </View>
          </Pressable>
        )}

        <Text style={styles.sectionTitle}>История выплат</Text>
        {payouts.map((p) => (
          <View key={p.id} style={styles.historyRow}>
            <View style={styles.historyLeft}>
              <Text style={styles.historyId}>№{p.id.replace(/\D/g, '').slice(-5) || p.id.slice(-5)}</Text>
              <Text style={styles.historyDesc}>{p.description ?? 'Выплата на карту'}</Text>
              <Text style={styles.historyDate}>{formatDate(p.createdAt ?? p.created_at)}</Text>
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
        {payouts.length === 0 && payments.map((p) => (
          <View key={p.id} style={styles.historyRow}>
            <View style={styles.historyLeft}>
              <Text style={styles.historyId}>№{p.id.replace(/\D/g, '').slice(-5) || p.id.slice(-5)}</Text>
              <Text style={styles.historyDesc}>Выплата от платформы</Text>
              <Text style={styles.historyDate}>{formatDate(p.createdAt ?? p.created_at)}</Text>
            </View>
            <View style={styles.historyRight}>
              <View style={styles.historyStatusRow}>
                <Text style={styles.historyStatus}>{statusLabel(p.status)}</Text>
              </View>
              <Text style={styles.historyAmount}>{formatAmount(p.amount)}</Text>
            </View>
          </View>
        ))}
        {payouts.length === 0 && payments.length === 0 ? (
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
            <Text style={styles.modalTitle}>ЗАПРОСИТЬ ВЫПЛАТУ НА ЭТУ КАРТУ?</Text>
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
            <Text style={styles.modalTitle}>ЗАПРОС ОТПРАВЛЕН!</Text>
            <Text style={styles.moneySentMessage}>
              Мы отправили вам на карту {formatAmount(balance)}. Они придут в течении 3 рабочих дней, а может быть и раньше.
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
              Повторите попытку или попробуйте заплатить с другой карты.
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
        visible={isDeleteSuccessVisible}
        onRequestClose={() => setDeleteSuccessVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDeleteSuccessVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>КАРТА УДАЛЕНА</Text>
            <Pressable style={styles.deleteModalKeepButton} onPress={() => setDeleteSuccessVisible(false)}>
              <Text style={styles.deleteModalKeepText}>Закрыть</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        animationType="none"
        visible={isEditModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => { setIsLinking(false); setBindError(null); setEditModalVisible(false); }}>
          <Pressable style={styles.editModalSheet} onPress={() => {}}>
            <ThemedText type="title" style={styles.editModalTitle}>
              {activeCard ? 'ИЗМЕНИТЬ КАРТУ' : 'ДОБАВИТЬ КАРТУ'}
            </ThemedText>

            <Text style={styles.vpnWarning}>
              Если используете VPN — отключите его перед привязкой карты. Банки блокируют зарубежные IP при 3D Secure.
            </Text>
            <Text style={styles.verificationNote}>
              С карты спишется проверочный платеж до 20 ₽. И сразу вернется.
            </Text>

            {bindError ? (
              <Text style={styles.bindErrorText}>{bindError}</Text>
            ) : null}
            <Pressable
              style={[styles.editModalBtn, styles.editModalBtnPrimary, isLinking && styles.editModalBtnDisabled]}
              onPress={handleEditSubmit}
              disabled={isLinking}
            >
              <Text style={styles.editModalBtnText}>
                {isLinking ? 'Открытие...' : 'Привязать карту'}
              </Text>
            </Pressable>
            <Text style={styles.legalText}>
              {'Нажимая «Привязать карту», вы принимаете оферту, политику конфиденциальности и условия сервиса'}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        animationType="none"
        visible={isCardBoundSuccessVisible}
        onRequestClose={() => setCardBoundSuccessVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCardBoundSuccessVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>КАРТА ПРИВЯЗАНА</Text>
            <Pressable style={styles.deleteModalKeepButton} onPress={() => setCardBoundSuccessVisible(false)}>
              <Text style={styles.deleteModalKeepText}>Начнем</Text>
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
  header: {},
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
  linkCardRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#1E1E1E',
    height: 52,
    marginBottom: 24,
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
  vpnWarning: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
    marginBottom: 8,
  },
  verificationNote: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginBottom: 12,
  },
  bindErrorText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter-Regular',
    color: '#E02D2D',
    marginBottom: 10,
  },
  legalText: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
    textAlign: 'center',
  },
});
