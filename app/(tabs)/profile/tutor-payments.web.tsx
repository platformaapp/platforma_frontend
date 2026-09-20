import { useFocusEffect } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';
import { endpoints } from '@/constants/env';
import {
  deleteCurrentPaymentMethod,
  getPaymentMethods,
  type Card,
} from '@/lib/api/student-payments';
import {
  getTutorPayments,
  getTutorPaymentsSummary,
  getTutorPayouts,
  getTutorPayoutsBalance,
  type Payment,
  type PaymentsSummary,
  type Payout,
  type PayoutBalance,
} from '@/lib/api/tutor';
import { getAuthToken } from '@/lib/auth';

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
const WITHDRAWAL_TOOLTIP = 'Мы отправили вам деньги на карту. Они придут в течении 3 рабочих дней, а может быть и раньше.';

/** Веб-версия "Платежи" (наставник): баланс, карта для выплат, история выплат. Логика 1:1 с tutor-payments.tsx. */
export default function TutorPaymentsScreenWeb() {
  const router = useRouter();
  const isMobile = useIsMobileWeb();
  const { refresh } = useLocalSearchParams<{ refresh?: string }>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
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
  const [balanceTooltipVisible, setBalanceTooltipVisible] = useState(false);
  const [payoutTooltipId, setPayoutTooltipId] = useState<string | null>(null);

  const activeCard = cards[0] ?? null;
  const cardMasked = activeCard?.cardMasked ?? activeCard?.card_masked ?? '';
  const cardBank = activeCard?.cardType ?? activeCard?.provider ?? '';

  const loadCards = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch(endpoints.paymentsMethod, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setCards(data?.data?.paymentMethods ?? []);
      } else {
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
      setLoadError('');
    } catch (e: any) {
      setLoadError(e?.message ?? 'Не удалось загрузить данные');
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
            setLoadError('');
          }
          return loadCards();
        })
        .catch((e) => {
          if (!cancelled) setLoadError(e?.message ?? 'Не удалось загрузить данные');
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
      setLoadError(e?.message ?? 'Не удалось удалить карту');
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
      } as any);
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? 'Не удалось привязать карту';
      setBindError(msg);
    } finally {
      setIsLinking(false);
    }
  };

  if (loading) {
    return <SiteShell><View style={styles.centered}><ActivityIndicator size="large" color="#010101" /></View></SiteShell>;
  }

  const balance = payoutBalance?.available ?? (summary as any)?.balance ?? (summary as any)?.total_income ?? 0;

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleRow}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile' as any))}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <Text style={styles.title}>Платежи</Text>
        </View>

        {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Баланс</Text>
          <View style={styles.balanceRight}>
            <Text style={styles.balanceAmount}>{formatAmount(balance)}</Text>
            <Pressable style={styles.infoIcon} onPress={() => setBalanceTooltipVisible((v) => !v)}>
              <Text style={styles.infoIconText}>ⓘ</Text>
            </Pressable>
          </View>
        </View>
        {balanceTooltipVisible ? <Text style={styles.tooltipText}>{BALANCE_TOOLTIP}</Text> : null}

        {activeCard ? (
          <View style={styles.cardBlock}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{cardMasked || 'Карта привязана'}</Text>
              {cardBank ? <Text style={styles.cardSubtitle}>{cardBank}</Text> : null}
            </View>
            <View style={[styles.cardBlockActions, isMobile && styles.cardBlockActionsMobile]}>
              <Pressable style={styles.primaryButton} onPress={() => setWithdrawModalVisible(true)}>
                <Text style={styles.primaryButtonText}>Запросить выплату</Text>
              </Pressable>
              <View style={[styles.cardSecondaryRow, isMobile && styles.cardSecondaryRowMobile]}>
                <Pressable style={isMobile ? styles.chip : styles.cardAction} onPress={handleEditCardClick} disabled={isDeleting}>
                  <Text style={isMobile ? styles.chipText : styles.cardActionText}>Изменить</Text>
                </Pressable>
                <Pressable style={isMobile ? styles.chip : styles.cardAction} onPress={handleDeleteCardClick} disabled={isDeleting}>
                  <Text style={isMobile ? styles.chipTextDanger : styles.cardActionDeleteText}>{isDeleting ? '…' : 'Удалить'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <Pressable style={styles.linkCardRow} onPress={handleEditCardClick}>
            <View style={styles.plusBox}><Text style={styles.plusText}>+</Text></View>
            <View style={styles.linkTextBox}><Text style={styles.linkText}>Привязать карту для получения выплат</Text></View>
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
                <Pressable style={styles.infoIcon} onPress={() => setPayoutTooltipId((cur) => (cur === p.id ? null : p.id))}>
                  <Text style={styles.infoIconText}>ⓘ</Text>
                </Pressable>
              </View>
              <Text style={styles.historyAmount}>{formatAmount(p.amount)}</Text>
              {payoutTooltipId === p.id ? <Text style={styles.tooltipTextRight}>{WITHDRAWAL_TOOLTIP}</Text> : null}
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
              <Text style={styles.historyStatus}>{statusLabel(p.status)}</Text>
              <Text style={styles.historyAmount}>{formatAmount(p.amount)}</Text>
            </View>
          </View>
        ))}
        {payouts.length === 0 && payments.length === 0 ? <Text style={styles.emptyText}>История пуста</Text> : null}
      </ScrollView>

      {/* ─── Запросить выплату ────────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={isWithdrawModalVisible} onRequestClose={() => setWithdrawModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setWithdrawModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Запросить выплату на эту карту?</Text>
            <View style={styles.modalEventCard}>
              <Text style={styles.modalEventTitle}>{cardMasked}</Text>
              <Text style={styles.modalEventSubtitle}>{cardBank}</Text>
            </View>
            <Pressable style={[styles.primaryButton, styles.modalButtonSpacing, isWithdrawing && styles.btnDisabled]} onPress={handleWithdrawConfirm} disabled={isWithdrawing}>
              <Text style={styles.primaryButtonText}>{isWithdrawing ? '…' : 'Да, все ок'}</Text>
            </Pressable>
            <Pressable style={styles.modalOutlineButton} onPress={handleWithdrawReplace} disabled={isWithdrawing}>
              <Text style={styles.modalOutlineButtonText}>Нет, заменю</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Деньги отправлены ────────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={isMoneySentModalVisible} onRequestClose={() => { setMoneySentModalVisible(false); loadData(); }}>
        <Pressable style={styles.overlay} onPress={() => { setMoneySentModalVisible(false); loadData(); }}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Запрос отправлен!</Text>
            <Text style={styles.modalMessage}>Мы отправили вам на карту {formatAmount(balance)}. Они придут в течении 3 рабочих дней, а может быть и раньше.</Text>
            <Pressable style={[styles.primaryButton, styles.modalButtonSpacing]} onPress={() => { setMoneySentModalVisible(false); loadData(); }}>
              <Text style={styles.primaryButtonText}>Закрыть</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Оплата не прошла ─────────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={isPaymentFailedModalVisible} onRequestClose={() => setPaymentFailedModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setPaymentFailedModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={[styles.modalTitle, styles.modalTitleDanger]}>Оплата не прошла</Text>
            <Text style={[styles.modalMessage, styles.modalMessageDanger]}>Повторите попытку или попробуйте заплатить с другой карты.</Text>
            <Pressable style={[styles.primaryButton, styles.modalButtonSpacing]} onPress={handlePaymentFailedRetry}>
              <Text style={styles.primaryButtonText}>Попробовать еще раз</Text>
            </Pressable>
            <Pressable style={styles.modalOutlineButton} onPress={handlePaymentFailedChangeCard}>
              <Text style={styles.modalOutlineButtonText}>Сменить карту</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Удалить карту ────────────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={isDeleteModalVisible} onRequestClose={handleDeleteModalKeep}>
        <Pressable style={styles.overlay} onPress={handleDeleteModalKeep}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Вы действительно хотите удалить карту?</Text>
            <Pressable style={styles.modalOutlineButton} onPress={handleDeleteModalKeep}>
              <Text style={styles.modalOutlineButtonText}>Оставить</Text>
            </Pressable>
            <Pressable style={[styles.modalDangerButton, styles.modalButtonSpacing, isDeleting && styles.btnDisabled]} onPress={handleDeleteModalConfirm} disabled={isDeleting}>
              <Text style={styles.modalDangerButtonText}>{isDeleting ? '…' : 'Удалить'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent animationType="fade" visible={isDeleteSuccessVisible} onRequestClose={() => setDeleteSuccessVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setDeleteSuccessVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Карта удалена</Text>
            <Pressable style={styles.modalOutlineButton} onPress={() => setDeleteSuccessVisible(false)}>
              <Text style={styles.modalOutlineButtonText}>Закрыть</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Добавить / изменить карту ────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={isEditModalVisible} onRequestClose={() => setEditModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => { setIsLinking(false); setBindError(null); setEditModalVisible(false); }}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{activeCard ? 'Изменить карту' : 'Добавить карту'}</Text>
            <Text style={styles.vpnWarning}>Если используете VPN — отключите его перед привязкой карты. Банки блокируют зарубежные IP при 3D Secure.</Text>
            <Text style={styles.verificationNote}>С карты спишется проверочный платеж 1 ₽.</Text>
            {bindError ? <Text style={styles.errorText}>{bindError}</Text> : null}
            <Pressable style={[styles.primaryButton, styles.modalButtonSpacing, isLinking && styles.btnDisabled]} onPress={handleEditSubmit} disabled={isLinking}>
              <Text style={styles.primaryButtonText}>{isLinking ? 'Открытие...' : 'Привязать карту'}</Text>
            </Pressable>
            <Text style={styles.legalText}>
              {'Нажимая «Привязать карту», вы принимаете оферту, политику конфиденциальности и условия сервиса'}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent animationType="fade" visible={isCardBoundSuccessVisible} onRequestClose={() => setCardBoundSuccessVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setCardBoundSuccessVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Карта привязана</Text>
            <Pressable style={styles.modalOutlineButton} onPress={() => setCardBoundSuccessVisible(false)}>
              <Text style={styles.modalOutlineButtonText}>Начнем</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 48, maxWidth: 720 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  backArrow: { fontSize: 20, color: '#010101' },
  title: { fontSize: 24, fontFamily: 'Gramatika-Bold', color: '#010101' },
  errorText: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#E02D2D', marginBottom: 12 },

  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#010101', paddingHorizontal: 16, paddingVertical: 16, marginBottom: 4 },
  balanceLabel: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#010101' },
  balanceRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceAmount: { fontSize: 16, fontFamily: 'Gramatika-Bold', color: '#010101' },
  infoIcon: { padding: 4 },
  infoIconText: { fontSize: 14, color: '#9B9B9B' },
  tooltipText: { fontSize: 12, lineHeight: 16, fontFamily: 'Gramatika-Regular', color: '#687076', marginBottom: 16 },
  tooltipTextRight: { fontSize: 11, lineHeight: 14, fontFamily: 'Gramatika-Regular', color: '#687076', marginTop: 4, maxWidth: 160, textAlign: 'right' },

  cardBlock: { borderWidth: 1, borderColor: '#010101', marginBottom: 24 },
  cardInfo: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: '#E5E5E5' },
  cardTitle: { fontSize: 14, fontFamily: 'Gramatika-Bold', color: '#010101', marginBottom: 4 },
  cardSubtitle: { fontSize: 12, fontFamily: 'Gramatika-Regular', color: '#9B9B9B' },
  cardBlockActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, gap: 16, flexWrap: 'wrap' },
  cardBlockActionsMobile: { flexDirection: 'column', alignItems: 'stretch' },
  cardSecondaryRow: { flexDirection: 'row', gap: 20 },
  cardSecondaryRowMobile: { gap: 8, marginTop: 8 },
  cardAction: { paddingVertical: 6 },
  cardActionText: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#010101' },
  cardActionDeleteText: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#E02D2D' },
  chip: { backgroundColor: '#F0F5FB', paddingVertical: 8, paddingHorizontal: 14 },
  chipText: { fontSize: 12, fontFamily: 'Gramatika-Bold', color: '#68717A' },
  chipTextDanger: { fontSize: 12, fontFamily: 'Gramatika-Bold', color: '#E02D2D' },

  linkCardRow: { flexDirection: 'row', borderWidth: 1, borderColor: '#010101', height: 56, marginBottom: 24 },
  plusBox: { width: 56, backgroundColor: '#010101', alignItems: 'center', justifyContent: 'center' },
  plusText: { fontSize: 22, fontFamily: 'Gramatika-Regular', color: '#fff' },
  linkTextBox: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  linkText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#010101' },

  sectionTitle: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#9B9B9B', marginBottom: 12, marginTop: 8 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: '#E5E5E5', marginBottom: 8, gap: 12 },
  historyLeft: { flex: 1 },
  historyId: { fontSize: 13, fontFamily: 'Gramatika-Bold', color: '#010101' },
  historyDesc: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#010101', marginTop: 4 },
  historyDate: { fontSize: 12, fontFamily: 'Gramatika-Regular', color: '#9B9B9B', marginTop: 4 },
  historyRight: { alignItems: 'flex-end' },
  historyStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  historyStatus: { fontSize: 12, fontFamily: 'Gramatika-Regular', color: '#010101' },
  historyAmount: { fontSize: 14, fontFamily: 'Gramatika-Bold', color: '#010101', marginTop: 4 },
  emptyText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#9B9B9B', marginTop: 8 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: '#fff', width: '100%', maxWidth: 400, padding: 24 },
  modalTitle: { fontSize: 18, fontFamily: 'Gramatika-Bold', color: '#010101', marginBottom: 12, textTransform: 'uppercase', lineHeight: 24 },
  modalTitleDanger: { color: '#E02D2D' },
  modalMessage: { fontSize: 14, lineHeight: 20, fontFamily: 'Gramatika-Regular', color: '#010101', marginBottom: 8 },
  modalMessageDanger: { color: '#E02D2D' },
  modalEventCard: { borderWidth: 1, borderColor: '#010101', paddingHorizontal: 16, paddingVertical: 16, marginTop: 8 },
  modalEventTitle: { fontSize: 15, fontFamily: 'Gramatika-Bold', color: '#010101' },
  modalEventSubtitle: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#9B9B9B', marginTop: 4 },
  modalButtonSpacing: { marginTop: 16 },
  primaryButton: { backgroundColor: '#010101', paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { fontSize: 14, fontFamily: 'Gramatika-Bold', color: '#fff' },
  modalOutlineButton: { borderWidth: 1, borderColor: '#010101', paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  modalOutlineButtonText: { fontSize: 14, fontFamily: 'Gramatika-Bold', color: '#010101' },
  modalDangerButton: { backgroundColor: '#E02D2D', paddingVertical: 14, alignItems: 'center' },
  modalDangerButtonText: { fontSize: 14, fontFamily: 'Gramatika-Bold', color: '#fff' },
  btnDisabled: { opacity: 0.6 },
  vpnWarning: { fontSize: 12, lineHeight: 17, fontFamily: 'Gramatika-Regular', color: '#9B9B9B', marginTop: 12, marginBottom: 8 },
  verificationNote: { fontSize: 13, lineHeight: 18, fontFamily: 'Gramatika-Regular', color: '#010101', marginBottom: 4 },
  legalText: { marginTop: 12, fontSize: 11, lineHeight: 16, fontFamily: 'Gramatika-Regular', color: '#9B9B9B', textAlign: 'center' },
});
