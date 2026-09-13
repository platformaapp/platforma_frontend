import { useFocusEffect } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';
import { endpoints } from '@/constants/env';
import { AuthError } from '@/lib/api/auth-error';
import {
  deleteCurrentPaymentMethod,
  deletePaymentMethod,
  getPaymentMethods,
  getStudentPayments,
  MAX_CARDS,
  setDefaultPaymentMethod,
  type Card,
  type PaymentHistoryItem,
} from '@/lib/api/student-payments';
import { getAuthToken } from '@/lib/auth';

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function formatAmount(amount: number): string {
  return `${amount.toLocaleString('ru-RU')} ₽`;
}

function cardDisplay(card: Card): string {
  return card.cardMasked ?? card.card_masked ?? '****';
}

/** Веб-версия "Платежи" (студент): карты + история платежей. Логика 1:1 с payments.tsx. */
export default function PaymentsScreenWeb() {
  const router = useRouter();
  const isMobile = useIsMobileWeb();
  const { refresh } = useLocalSearchParams<{ refresh?: string }>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleteSuccessVisible, setDeleteSuccessVisible] = useState(false);
  const [isCardBoundSuccessVisible, setCardBoundSuccessVisible] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<Card | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await getStudentPayments();
      setCards(data.cards);
      setHistory(data.history);
      setLoadError('');
    } catch (e: any) {
      setCards([]);
      setHistory([]);
      setLoadError(e?.message ?? 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload data when navigating back from card-binding callback
  useEffect(() => {
    if (!refresh) return;
    setCardBoundSuccessVisible(true);
    setLoading(true);
    loadData();
    // Retry after 3s — backend may take a moment to propagate the new card
    const retryTimer = setTimeout(() => { loadData(); }, 3000);
    return () => clearTimeout(retryTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);

      import('@/lib/auth').then(({ getAuthToken: getToken }) => getToken()).then((token) => {
        if (!token) {
          router.replace('/login' as any);
          return;
        }
        getStudentPayments()
          .then((data) => {
            if (!cancelled) {
              setCards(data.cards);
              setHistory(data.history);
              setLoadError('');
            }
          })
          .catch((e) => {
            if (!cancelled) {
              if (e instanceof AuthError || (e as { name?: string })?.name === 'AuthError') {
                router.replace('/login' as any);
                return;
              }
              setCards([]);
              setHistory([]);
              setLoadError((e as Error)?.message ?? 'Не удалось загрузить данные');
            }
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      });

      return () => { cancelled = true; };
    }, [router])
  );

  const handleLinkCard = async () => {
    if (isLinking) return;
    setLinkError('');
    if (cards.length >= MAX_CARDS) {
      setLinkError('Можно привязать только одну карту. Удалите текущую, чтобы привязать новую.');
      return;
    }
    setIsLinking(true);
    try {
      let cardCountBefore = cards.length;
      try {
        const methods = await getPaymentMethods();
        cardCountBefore = methods.length;
      } catch { /* use cards.length */ }

      const token = await getAuthToken();
      if (!token) { router.replace('/login' as any); return; }

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
      if (!bindRes.ok) throw new Error(bindJson?.message ?? bindJson?.error ?? `Ошибка ${bindRes.status}`);

      const confirmationUrl: string | undefined = bindJson?.data?.confirmationUrl;
      const attachmentId: string | undefined = bindJson?.data?.attachmentId;
      const yookassaPaymentId: string | undefined = bindJson?.data?.yookassaPaymentId;
      if (!confirmationUrl) throw new Error('Сервер не вернул ссылку для привязки карты');

      await Linking.openURL(confirmationUrl);

      router.push({
        pathname: '/(tabs)/profile/payment-methods-callback',
        params: {
          transactionId: attachmentId ?? '',
          yookassaPaymentId: yookassaPaymentId ?? '',
          initialCardCount: String(cardCountBefore),
        },
      } as any);
    } catch (e: unknown) {
      if (e instanceof AuthError || (e as { name?: string })?.name === 'AuthError') {
        router.replace('/login' as any);
        return;
      }
      setLinkError((e as Error)?.message ?? 'Не удалось привязать карту');
    } finally {
      setIsLinking(false);
    }
  };

  const handleSetDefault = async (card: Card) => {
    if (settingDefaultId || card.isDefault) return;
    setSettingDefaultId(card.id);
    try {
      await setDefaultPaymentMethod(card.id);
      await loadData();
    } catch (e: unknown) {
      if (e instanceof AuthError || (e as { name?: string })?.name === 'AuthError') {
        router.replace('/login' as any);
        return;
      }
      setLoadError((e as Error)?.message ?? 'Не удалось установить карту по умолчанию');
    } finally {
      setSettingDefaultId(null);
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
        await deletePaymentMethod(cardToDelete.id);
      } catch {
        await deleteCurrentPaymentMethod();
      }
      setDeleteModalVisible(false);
      setCardToDelete(null);
      setDeleteSuccessVisible(true);
    } catch (e: unknown) {
      if (e instanceof AuthError || (e as { name?: string })?.name === 'AuthError') {
        router.replace('/login' as any);
        return;
      }
      setLoadError((e as Error)?.message ?? 'Не удалось удалить карту');
    } finally {
      await loadData();
      setDeletingId(null);
    }
  };

  if (loading) {
    return <SiteShell><View style={styles.centered}><ActivityIndicator size="large" color="#181818" /></View></SiteShell>;
  }

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleRow}>
          <Pressable onPress={() => router.replace('/(tabs)/profile' as any)}><Text style={styles.backArrow}>←</Text></Pressable>
          <Text style={styles.title}>Платежи</Text>
        </View>

        {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

        <Text style={styles.sectionTitle}>Карты</Text>
        {cards.map((card) => (
          <View key={card.id} style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>
                Карта {cardDisplay(card)}{card.isDefault ? ' (по умолчанию)' : ''}
              </Text>
              <Text style={styles.cardSubtitle}>{card.cardType ?? card.provider ?? ''}</Text>
            </View>
            <View style={[styles.cardActions, isMobile && styles.cardActionsMobile]}>
              {!card.isDefault && (
                <Pressable
                  style={isMobile ? styles.chip : styles.cardAction}
                  onPress={() => handleSetDefault(card)}
                  disabled={!!settingDefaultId}
                >
                  <Text style={isMobile ? styles.chipText : styles.cardActionText}>
                    {settingDefaultId === card.id ? '…' : 'По умолчанию'}
                  </Text>
                </Pressable>
              )}
              <Pressable
                style={isMobile ? styles.chip : [styles.cardAction, styles.cardActionDelete]}
                onPress={() => handleDeleteCardClick(card)}
                disabled={!!deletingId}
              >
                <Text style={isMobile ? styles.chipTextDanger : styles.cardActionDeleteText}>
                  {deletingId === card.id ? '…' : 'Удалить'}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}

        {cards.length < MAX_CARDS ? (
          <>
            <Pressable style={styles.linkRow} onPress={handleLinkCard} disabled={isLinking}>
              <View style={styles.plusBox}><Text style={styles.plusText}>+</Text></View>
              <View style={styles.linkTextBox}><Text style={styles.linkText}>{isLinking ? 'Привязка...' : 'Привязать карту'}</Text></View>
            </Pressable>
            <Text style={styles.verificationNote}>С карты спишется проверочный платеж 1 ₽.</Text>
            <Text style={styles.legalText}>
              {'Нажимая «Привязать карту», вы принимаете оферту, политику конфиденциальности и условия сервиса'}
            </Text>
            {linkError ? <Text style={styles.errorText}>{linkError}</Text> : null}
          </>
        ) : (
          <View style={styles.linkRowDisabled}>
            <Text style={styles.linkTextDisabled}>Уже привязана карта — удалите её, чтобы добавить новую</Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, styles.sectionTitleHistory]}>История платежей</Text>
        {history.length > 0 ? (
          history.map((item) => {
            const statusLabel = item.status === 'success' ? 'оплачено' : item.status === 'failed' ? 'ошибка' : 'в обработке';
            const statusStyle = item.status === 'success' ? styles.historyStatusSuccess : item.status === 'failed' ? styles.historyStatusFailed : styles.historyStatusPending;
            const shortId = item.id.replace(/-/g, '').slice(0, 5).toUpperCase();
            const openEvent = item.kind === 'event' && item.eventId ? () => router.push(`/(tabs)/events/${item.eventId}` as any) : undefined;

            return (
              <Pressable key={item.id} style={styles.historyCard} onPress={openEvent} disabled={!openEvent}>
                <View style={styles.historyCardHeader}>
                  <Text style={styles.historyNumber}>№{shortId}</Text>
                  <Text style={[styles.historyStatusLabel, statusStyle]}>{statusLabel}</Text>
                </View>
                <Text style={styles.historyTitle} numberOfLines={2}>{item.title ?? item.tutor ?? ''}</Text>
                {item.subtitle ? <Text style={styles.historySubtitle}>{item.subtitle}</Text> : null}
                <View style={styles.historyCardFooter}>
                  <Text style={styles.historyDate}>{formatDate(item.created_at)}</Text>
                  <Text style={styles.historyAmount}>{formatAmount(item.amount)}</Text>
                </View>
              </Pressable>
            );
          })
        ) : (
          <View style={styles.historyEmpty}><Text style={styles.historyEmptyText}>История платежей пока пуста</Text></View>
        )}
      </ScrollView>

      <Modal transparent animationType="fade" visible={isDeleteModalVisible} onRequestClose={handleDeleteModalKeep}>
        <Pressable style={styles.overlay} onPress={handleDeleteModalKeep}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Вы действительно хотите удалить карту?</Text>
            <Pressable style={styles.modalOutlineButton} onPress={handleDeleteModalKeep}>
              <Text style={styles.modalOutlineButtonText}>Оставить</Text>
            </Pressable>
            <Pressable style={[styles.modalDangerButton, deletingId && styles.btnDisabled]} onPress={handleDeleteModalConfirm} disabled={!!deletingId}>
              <Text style={styles.modalDangerButtonText}>{deletingId ? '…' : 'Удалить'}</Text>
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
  backArrow: { fontSize: 20, color: '#181818' },
  title: { fontSize: 24, fontFamily: 'Inter-Bold', color: '#181818' },

  sectionTitle: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginBottom: 12 },
  sectionTitleHistory: { marginTop: 32 },

  linkRow: { flexDirection: 'row', borderWidth: 1, borderColor: '#181818', height: 56, marginBottom: 8 },
  linkRowDisabled: { borderWidth: 1, borderColor: '#E5E5E5', height: 56, justifyContent: 'center', paddingHorizontal: 16, marginBottom: 8 },
  linkTextDisabled: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  plusBox: { width: 56, backgroundColor: '#181818', alignItems: 'center', justifyContent: 'center' },
  plusText: { fontSize: 22, fontFamily: 'Inter-Regular', color: '#fff' },
  linkTextBox: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  linkText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  verificationNote: { marginTop: 8, fontSize: 13, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#181818' },
  legalText: { marginTop: 4, fontSize: 12, lineHeight: 16, fontFamily: 'Inter-Regular', color: '#9B9B9B' },

  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#181818', marginBottom: 12, flexWrap: 'wrap', gap: 8, padding: 12 },
  cardInfo: {},
  cardTitle: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#181818', marginBottom: 4 },
  cardSubtitle: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  cardActions: { flexDirection: 'row', gap: 20 },
  cardActionsMobile: { gap: 8 },
  cardAction: { paddingVertical: 6 },
  cardActionText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#181818' },
  cardActionDelete: {},
  cardActionDeleteText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#E02D2D' },
  chip: { backgroundColor: '#F0F5FB', paddingVertical: 8, paddingHorizontal: 14 },
  chipText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#68717A' },
  chipTextDanger: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#E02D2D' },

  historyCard: { borderWidth: 1, borderColor: '#E5E5E5', marginBottom: 8, padding: 12 },
  historyCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  historyNumber: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#181818' },
  historyStatusLabel: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  historyStatusSuccess: { color: '#181818' },
  historyStatusFailed: { color: '#E02D2D' },
  historyStatusPending: { color: '#9B9B9B' },
  historyTitle: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 2 },
  historySubtitle: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#687076', marginBottom: 6 },
  historyCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  historyDate: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  historyAmount: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#181818' },
  historyEmpty: { paddingVertical: 24, alignItems: 'flex-start' },
  historyEmptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#9B9B9B' },

  errorText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#E02D2D', marginBottom: 12 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: '#fff', width: '100%', maxWidth: 380, padding: 24 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#181818', marginBottom: 20, textTransform: 'uppercase', lineHeight: 24 },
  modalOutlineButton: { borderWidth: 1, borderColor: '#181818', paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  modalOutlineButtonText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#181818' },
  modalDangerButton: { backgroundColor: '#E02D2D', paddingVertical: 14, alignItems: 'center' },
  modalDangerButtonText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#fff' },
  btnDisabled: { opacity: 0.6 },
});
