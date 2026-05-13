import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const OFERTA_URL = Platform.OS === 'web' ? '/oferta.pdf' : 'https://platformaapp.ru/oferta.pdf';
const CONF_URL   = Platform.OS === 'web' ? '/conf.pdf'   : 'https://platformaapp.ru/conf.pdf';

import { AuthError } from '@/lib/api/auth-error';
import {
  bindPaymentMethod,
  deleteCurrentPaymentMethod,
  deletePaymentMethod,
  getPaymentMethods,
  getStudentPayments,
  MAX_CARDS,
  PENDING_CARD_BINDING_INITIAL_COUNT_KEY,
  PENDING_CARD_BINDING_PAYMENT_ID_KEY,
  setDefaultPaymentMethod,
  type Card,
  type PaymentHistoryItem,
} from '@/lib/api/student-payments';

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

function cardDisplay(card: Card): string {
  return card.cardMasked ?? card.card_masked ?? '****';
}

export default function PaymentsScreen() {
  const router = useRouter();
  const { refresh } = useLocalSearchParams<{ refresh?: string }>();
  const [loading, setLoading] = useState(true);
  const [isLinking, setIsLinking] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<Card | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

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

  // Reload data when navigating back from card-binding callback
  useEffect(() => {
    if (refresh) {
      setLoading(true);
      loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);

      // Auth guard — payments screen requires login
      import('@/lib/auth').then(({ getAuthToken }) => getAuthToken()).then((token) => {
        if (!token) {
          router.replace('/login');
          return;
        }
        getStudentPayments()
          .then((data) => {
            if (!cancelled) {
              setCards(data.cards);
              setHistory(data.history);
            }
          })
          .catch((e) => {
            if (!cancelled) {
              if (e instanceof AuthError || (e as { name?: string })?.name === 'AuthError') {
                router.replace('/login');
                return;
              }
              setCards([]);
              setHistory([]);
              Alert.alert('Ошибка', (e as Error)?.message ?? 'Не удалось загрузить данные');
            }
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      });

      return () => { cancelled = true; };
    }, [router])
  );

  const pendingCallbackRef = useRef(false);
  const pendingBindParams = useRef<{
    yookassaPaymentId?: string;
    initialCardCount?: number;
  }>({});

  const navigateToCallback = () => {
    const { yookassaPaymentId, initialCardCount } = pendingBindParams.current;
    router.push({
      pathname: '/(tabs)/profile/payment-methods-callback',
      params: {
        yookassaPaymentId: yookassaPaymentId ?? '',
        orderId: yookassaPaymentId ?? '',
        initialCardCount: String(initialCardCount ?? 0),
      },
    });
  };

  const handleLinkCard = async () => {
    if (isLinking) return;
    if (cards.length >= MAX_CARDS) {
      Alert.alert(
        'Внимание',
        'Можно привязать только одну карту. Удалите текущую, чтобы привязать новую.'
      );
      return;
    }
    setIsLinking(true);
    try {
      let cardCountBefore = cards.length;
      try {
        const methods = await getPaymentMethods();
        cardCountBefore = methods.length;
      } catch {
        /* use cards.length */
      }

      const { confirmationUrl, yookassaPaymentId } = await bindPaymentMethod({ provider: 'yookassa' });
      const paymentId = yookassaPaymentId;
      pendingBindParams.current = { yookassaPaymentId: paymentId, initialCardCount: cardCountBefore };
      try {
        const ls = (globalThis as any)?.localStorage;
        if (ls && paymentId) {
          ls.setItem(PENDING_CARD_BINDING_PAYMENT_ID_KEY, paymentId);
          ls.setItem(PENDING_CARD_BINDING_INITIAL_COUNT_KEY, String(cardCountBefore));
        }
      } catch { /* ignore */ }
      pendingCallbackRef.current = true;
      WebBrowser.openBrowserAsync(confirmationUrl).then(() => {
        if (pendingCallbackRef.current) {
          pendingCallbackRef.current = false;
          navigateToCallback();
        }
      });
    } catch (e: unknown) {
      pendingCallbackRef.current = false;
      pendingBindParams.current = {};
      try {
        const ls = (globalThis as any)?.localStorage;
        ls?.removeItem(PENDING_CARD_BINDING_PAYMENT_ID_KEY);
        ls?.removeItem(PENDING_CARD_BINDING_INITIAL_COUNT_KEY);
      } catch { /* ignore */ }
      if (e instanceof AuthError || (e as { name?: string })?.name === 'AuthError') {
        router.replace('/login');
        return;
      }
      Alert.alert('Ошибка', (e as Error)?.message ?? 'Не удалось привязать карту');
    } finally {
      setIsLinking(false);
    }
  };

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && pendingCallbackRef.current) {
        pendingCallbackRef.current = false;
        navigateToCallback();
      }
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleSetDefault = async (card: Card) => {
    if (settingDefaultId || card.isDefault) return;
    setSettingDefaultId(card.id);
    try {
      await setDefaultPaymentMethod(card.id);
      await loadData();
    } catch (e: unknown) {
      if (e instanceof AuthError || (e as { name?: string })?.name === 'AuthError') {
        router.replace('/login');
        return;
      }
      Alert.alert('Ошибка', (e as Error)?.message ?? 'Не удалось установить карту по умолчанию');
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
    } catch (e: unknown) {
      if (e instanceof AuthError || (e as { name?: string })?.name === 'AuthError') {
        router.replace('/login');
        return;
      }
      Alert.alert('Ошибка', (e as Error)?.message ?? 'Не удалось удалить карту');
    } finally {
      await loadData();
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
        <Pressable style={styles.backButton} onPress={() => router.replace('/(tabs)/profile')}>
          <MaterialIcons name="chevron-left" size={24} color="#181818" />
        </Pressable>
        <Text style={styles.title}>ПЛАТЕЖИ</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="always">
        <Text style={styles.sectionTitle}>Карты</Text>
        {cards.length > 0 ? (
          cards.map((card) => (
            <View key={card.id} style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>
                  Карта {cardDisplay(card)}
                  {card.isDefault ? ' (по умолчанию)' : ''}
                </Text>
                <Text style={styles.cardSubtitle}>{card.cardType ?? card.provider ?? ''}</Text>
              </View>
              <View style={styles.cardActions}>
                {!card.isDefault && (
                  <Pressable
                    style={styles.cardAction}
                    onPress={() => handleSetDefault(card)}
                    disabled={!!settingDefaultId}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={styles.cardActionText}>
                      {settingDefaultId === card.id ? '…' : 'По умолчанию'}
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  style={[styles.cardAction, styles.cardActionDelete]}
                  onPress={() => handleDeleteCardClick(card)}
                  disabled={!!deletingId}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={styles.cardActionDeleteText}>
                    {deletingId === card.id ? '…' : 'Удалить'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        ) : null}
        {cards.length < MAX_CARDS ? (
          <>
            <Pressable style={styles.linkRow} onPress={handleLinkCard} disabled={isLinking}>
              <View style={styles.plusBox}>
                <Text style={styles.plusText}>+</Text>
              </View>
              <View style={styles.linkTextBox}>
                <Text style={styles.linkText}>{isLinking ? 'Привязка...' : 'Привязать карту'}</Text>
              </View>
            </Pressable>
            <Text style={styles.legalText}>
              {'Нажимая «Привязать карту», вы принимаете '}
              <Text style={styles.legalLink} onPress={() => WebBrowser.openBrowserAsync(OFERTA_URL)}>оферту</Text>
              {', '}
              <Text style={styles.legalLink} onPress={() => WebBrowser.openBrowserAsync(CONF_URL)}>политику конфиденциальности</Text>
              {' и условия сервиса'}
            </Text>
          </>
        ) : (
          <View style={styles.linkRowDisabled}>
            <Text style={styles.linkTextDisabled}>Уже привязана карта — удалите её, чтобы добавить новую</Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, styles.sectionTitleHistory]}>История платежей</Text>
        {history.length > 0 ? (
          history.map((item) => {
            const statusLabel = item.status === 'success' ? 'оплачено'
              : item.status === 'failed' ? 'ошибка' : 'в обработке';
            const statusStyle = item.status === 'success' ? styles.historyStatusSuccess
              : item.status === 'failed' ? styles.historyStatusFailed
              : styles.historyStatusPending;
            const shortId = item.id.replace(/-/g, '').slice(0, 5).toUpperCase();
            const openEvent =
              item.kind === 'event' && item.eventId
                ? () => router.push(`/(tabs)/events/${item.eventId}` as any)
                : undefined;

            return (
              <Pressable
                key={item.id}
                style={styles.historyCard}
                onPress={openEvent}
                disabled={!openEvent}
              >
                <View style={styles.historyCardHeader}>
                  <Text style={styles.historyNumber}>№{shortId}</Text>
                  <Text style={[styles.historyStatusLabel, statusStyle]}>{statusLabel}</Text>
                </View>
                <Text style={styles.historyTitle} numberOfLines={2}>
                  {item.title ?? item.tutor ?? ''}
                </Text>
                {item.subtitle ? (
                  <Text style={styles.historySubtitle}>{item.subtitle}</Text>
                ) : null}
                <View style={styles.historyCardFooter}>
                  <Text style={styles.historyDate}>{formatDate(item.created_at)}</Text>
                  <Text style={styles.historyAmount}>{formatAmount(item.amount)}</Text>
                </View>
              </Pressable>
            );
          })
        ) : (
          <View style={styles.historyEmpty}>
            <Text style={styles.historyEmptyText}>История платежей пока пуста</Text>
          </View>
        )}
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
  linkRowDisabled: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  linkTextDisabled: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
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
  cardActionText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
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
  // New history card design (matches screenshot)
  historyCard: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  historyNumber: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  historyStatusLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
  },
  historyStatusSuccess: { color: '#181818' },
  historyStatusFailed: { color: '#E02D2D' },
  historyStatusPending: { color: '#9B9B9B' },
  historyTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginBottom: 2,
  },
  historySubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginBottom: 6,
  },
  historyCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  historyDate: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
  },
  historyAmount: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  historyEmpty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  historyEmptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
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
  legalText: { marginTop: 8, marginHorizontal: 16, fontSize: 11, lineHeight: 16, fontFamily: 'Inter-Regular', color: '#9B9B9B', textAlign: 'center' },
  legalLink: { color: '#181818', textDecorationLine: 'underline' },
});
