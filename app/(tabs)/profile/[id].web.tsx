import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { BackArrowIcon } from '@/components/web/back-arrow-icon';
import { PlusField } from '@/components/web/plus-field';
import { SiteFooter } from '@/components/web/site-footer';
import { MOBILE_BREAKPOINT, SiteShell } from '@/components/web/site-shell';
import { TOPICS } from '@/constants/topics';
import { useSiteSettings } from '@/hooks/use-site-settings';
import { uploadEventImage } from '@/lib/api/events';
import { changePassword, getStudentProfile, updateStudentProfile } from '@/lib/api/student';
import { bindPaymentMethod, deleteCurrentPaymentMethod, deletePaymentMethod, fetchStudentPaymentHistory, getPaymentMethods, MAX_CARDS, type Card, type PaymentHistoryItem } from '@/lib/api/student-payments';
import {
    createTutorEventFull, createTutorSlot, deleteTutorSlot,
    getTutorPayouts,
    getTutorPayoutsBalance,
    getTutorProfile, getTutorSlots, updateTutorProfile, type Payout, type Slot,
} from '@/lib/api/tutor';
import { clearAuth, getAuthRole, getAuthToken, getUserProfile } from '@/lib/auth';
import { slotDateTimeMs } from '@/lib/slots-utils';

// Бэкенд требует datetime_start И datetime_end (сам считает durationMinutes
// из разницы) — в форме есть только "Время" (начало), длительность не
// спрашиваем, поэтому фиксируем 60 минут по умолчанию.
const DEFAULT_EVENT_DURATION_MINUTES = 60;
const EVENT_DESCRIPTION_MAX_CHARS = 500;
const EVENT_DESCRIPTION_MAX_WORDS = 100;

// Тот же формат, что фильтр на /events (см. events/index.web.tsx FORMATS) —
// подписи те же, а слаги — под backend EventCategory. Без выбора формата
// created-событие никогда не попадало ни под один фильтр (category
// оставался null навсегда — его негде было установить).
const EVENT_FORMATS: { label: string; slug: string }[] = [
  { label: 'Трансляция', slug: 'broadcast' },
  { label: 'Лекция', slug: 'lecture' },
  { label: 'Практика', slug: 'practices' },
  { label: 'Встреча', slug: 'meeting' },
  { label: 'Обсуждение', slug: 'discussion' },
];

/** Режет текст до 500 символов и до 100 слов — что наступит раньше. */
function clampEventDescription(text: string): string {
  const clipped = text.slice(0, EVENT_DESCRIPTION_MAX_CHARS);
  const words = clipped.split(/(\s+)/);
  let wordCount = 0;
  let cut = clipped.length;
  for (let i = 0; i < words.length; i++) {
    if (words[i].trim()) {
      wordCount++;
      if (wordCount > EVENT_DESCRIPTION_MAX_WORDS) {
        cut = words.slice(0, i).join('').length;
        break;
      }
    }
  }
  return clipped.slice(0, cut);
}

/** Группирует слоты по дате (для отображения "13 мая: 14:00 15:00 20:00"), сортируя даты и время. */
function groupSlotsByDate<T extends { date: string; time: string }>(slots: T[]): { date: string; slots: T[] }[] {
  const map = new Map<string, T[]>();
  for (const s of slots) {
    const arr = map.get(s.date) ?? [];
    arr.push(s);
    map.set(s.date, arr);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, daySlots]) => ({ date, slots: [...daySlots].sort((a, b) => a.time.localeCompare(b.time)) }));
}

function formatHistoryDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(2);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hh}:${mm}`;
  } catch {
    return '';
  }
}

function historyStatusLabel(status: PaymentHistoryItem['status']): string {
  if (status === 'success') return 'Оплачено';
  if (status === 'failed') return 'Ошибка оплаты';
  return 'Ожидает оплаты';
}

function payoutStatusLabel(status: Payout['status']): string {
  if (status === 'succeeded' || status === 'success') return 'Исполнено';
  if (status === 'failed') return 'Ошибка';
  return 'В обработке';
}

const BALANCE_TOOLTIP = 'Не забудьте оплатить налоги и жить счастливо, счатливо';
const WITHDRAWAL_TOOLTIP = 'Деньги на ваш счет придут в течение 3 рабочих дней, а может быть и раньше';

function formatSlotDateLabel(date: string): string {
  const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  try {
    const d = new Date(`${date}T00:00:00`);
    if (isNaN(d.getTime())) return date;
    return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
  } catch {
    return date;
  }
}

/**
 * Веб-версия личного кабинета — обе роли переверстаны под макет с общим
 * двухколоночным хедером (текст+действия слева, большой аватар справа на
 * десктопе; имя/аватар/действия друг под другом на мобильном), общей
 * модалкой "Платежи" и своим набором остальных модалок на роль (студент:
 * "Изменить данные"/"Новый пароль"; наставник: те же плюс "Изменение
 * данных наставника"/"Добавить событие"/"Редактировать слоты").
 */
export default function ProfileScreenWeb() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;
  const [role, setRole] = useState<'student' | 'tutor'>('student');
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [telegram, setTelegram] = useState('');
  const [bio, setBio] = useState('');
  const [shortBio, setShortBio] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [specialization, setSpecialization] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');

  const [slots, setSlots] = useState<Slot[]>([]);
  const [newSlotDate, setNewSlotDate] = useState('');
  const [newSlotTime, setNewSlotTime] = useState('');
  const [slotsModalVisible, setSlotsModalVisible] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null);
  // Небольшая задержка перед скрытием — курсор идёт от времени слота до
  // круглой кнопки-минуса рядом, и по пути пересекает границу вложенного
  // Pressable; без задержки onHoverOut успевает погасить кнопку (opacity/
  // pointerEvents) до того, как курсор до неё доедет, и клик проваливается.
  const slotHoverOutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [slotsSaveError, setSlotsSaveError] = useState('');
  // "+" у конкретной даты — дата уже известна (это дата группы), поэтому
  // открываем видимый мини-пикер только для времени, привязанный к этой
  // дате. Слот создаётся не по первому же onChange нативного <input type=
  // "time"> (браузер там нередко шлёт onChange уже после того, как выбраны
  // только часы или только минуты — второй сегмент выбрать не успеваешь),
  // а по явному нажатию "Выбрать".
  const [timePickerOpenDate, setTimePickerOpenDate] = useState<string | null>(null);
  const [timePickerDraft, setTimePickerDraft] = useState('');
  // Общий на весь экран id открытого попапа даты/времени — чтобы никогда не
  // было двух попапов одновременно: открытие одного (см. DateFieldWithPicker/
  // TimeFieldWithPicker) закрывает любой другой, где бы он ни был на экране.
  const [openPickerId, setOpenPickerId] = useState<string | null>(null);

  // ── Tutor-only modals ───────────────────────────────────────────────────────
  const [tutorEditModalVisible, setTutorEditModalVisible] = useState(false);
  const [newEventModalVisible, setNewEventModalVisible] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventPrice, setEventPrice] = useState('');
  const [eventMax, setEventMax] = useState('');
  const [eventTopic, setEventTopic] = useState<string | null>(null);
  const [eventFormat, setEventFormat] = useState<string | null>(null);
  const { topics: adminTopics } = useSiteSettings();
  const topicsList = adminTopics.length > 0 ? adminTopics : TOPICS;
  const [eventCoverUri, setEventCoverUri] = useState<string | null>(null);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [eventError, setEventError] = useState('');
  const [eventCreated, setEventCreated] = useState(false);
  const [tutorSaving, setTutorSaving] = useState(false);
  const [tutorSaveError, setTutorSaveError] = useState('');
  const [tutorSaveOk, setTutorSaveOk] = useState(false);

  // ── Student modals ─────────────────────────────────────────────────────────
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [paymentsModalVisible, setPaymentsModalVisible] = useState(false);
  const [paymentCards, setPaymentCards] = useState<Card[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [deleteCardError, setDeleteCardError] = useState('');
  const [isLinkingCard, setIsLinkingCard] = useState(false);
  const [linkCardError, setLinkCardError] = useState('');
  const [editCardModalVisible, setEditCardModalVisible] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editCardExpiry, setEditCardExpiry] = useState('');
  const [editCardCvv, setEditCardCvv] = useState('');
  const [editCardError, setEditCardError] = useState('');
  const [editCardSubmitting, setEditCardSubmitting] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<Payout[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [payoutTooltipId, setPayoutTooltipId] = useState<string | null>(null);
  const [payoutBalance, setPayoutBalance] = useState(0);
  const [balanceTooltipVisible, setBalanceTooltipVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawCard, setWithdrawCard] = useState<Card | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawSuccessVisible, setWithdrawSuccessVisible] = useState(false);
  const [withdrawFailedVisible, setWithdrawFailedVisible] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');

  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const token = await getAuthToken();
      if (!token) { router.replace('/login' as any); return; }
      const [authRole, profile] = await Promise.all([getAuthRole(), getUserProfile()]);
      const effectiveRole = authRole === 'tutor' ? 'tutor' : 'student';
      if (!active) return;
      setRole(effectiveRole);

      try {
        if (effectiveRole === 'tutor') {
          const [tp, tutorSlots] = await Promise.all([getTutorProfile(), getTutorSlots()]);
          if (!active) return;
          setFullName(tp.fullName ?? tp.full_name ?? profile?.full_name ?? '');
          setEmail(tp.email ?? profile?.email ?? '');
          setBio(tp.bio ?? '');
          setShortBio(tp.shortBio ?? tp.short_bio ?? '');
          setSpecialization(tp.specialization ?? null);
          setTelegram(tp.telegram ?? '');
          // Postgres-колонка hourly_rate — decimal без transformer'а, бэкенд
          // отдаёт её строкой ("7000.00"), а не числом — typeof rate ===
          // 'number' всегда был false, поле молча оставалось пустым при
          // каждой перезагрузке страницы, хотя на бэкенде значение сохранено.
          const rate = tp.hourlyRate ?? tp.hourly_rate ?? tp.pricePerHour;
          const rateNum = typeof rate === 'string' ? parseFloat(rate) : rate;
          if (typeof rateNum === 'number' && !isNaN(rateNum)) setHourlyRate(String(rateNum));
          setAvatarUrl(tp.avatarUrl ?? tp.avatar_url ?? '');
          const nowTs = Date.now();
          // s.time — Postgres time-колонка, приходит как "HH:MM:SS" (с
          // секундами) — раньше сюда всегда дописывалось ещё ":00" (расчёт
          // на "HH:MM" из нативного time-инпута), что после перезагрузки
          // страницы давало невалидную дату ("...T10:00:00:00") и все слоты
          // молча считались прошедшими и пропадали из списка.
          setSlots(tutorSlots.filter((s) => slotDateTimeMs(s.date, s.time) > nowTs));
        } else {
          const sp = await getStudentProfile();
          if (!active) return;
          setFullName(sp.full_name ?? sp.fullName ?? profile?.full_name ?? '');
          setEmail(sp.email ?? profile?.email ?? '');
          setTelegram(sp.telegram ?? '');
          setAvatarUrl(sp.avatar_url ?? sp.avatarUrl ?? '');
        }
      } catch { /* show empty form on failure */ }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [router]);

  async function pickAvatar(): Promise<string | undefined> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return undefined;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return undefined;
    return uploadEventImage(result.assets[0].uri);
  }

  async function handlePickAvatar() {
    const uploaded = await pickAvatar();
    if (uploaded) setAvatarUrl(uploaded);
  }

  // ── Student: save "Изменение данных" ──────────────────────────────────────
  async function handleSaveStudentEdit() {
    setEditSaving(true);
    setEditError('');
    try {
      await updateStudentProfile({ fullName, telegram, avatarUrl: avatarUrl || undefined });
      setEditModalVisible(false);
    } catch (e: any) {
      setEditError(e?.message ?? 'Не удалось сохранить');
    } finally {
      setEditSaving(false);
    }
  }

  // ── Student: "Новый пароль" ────────────────────────────────────────────────
  async function handleSavePassword() {
    setPasswordError('');
    if (!oldPassword || !newPassword) { setPasswordError('Заполните все поля'); return; }
    if (newPassword.length < 7) { setPasswordError('Пароль слишком короткий'); return; }
    if (newPassword !== newPassword2) { setPasswordError('Пароли не совпадают'); return; }
    setPasswordSaving(true);
    try {
      await changePassword(oldPassword, newPassword);
      setPasswordModalVisible(false);
      setOldPassword(''); setNewPassword(''); setNewPassword2('');
    } catch (e: any) {
      setPasswordError(e?.message ?? 'Не удалось сменить пароль');
    } finally {
      setPasswordSaving(false);
    }
  }

  // ── Student: "Платежи" modal ───────────────────────────────────────────────
  async function openPaymentsModal() {
    setPaymentsModalVisible(true);
    setPaymentsLoading(true);
    setBalanceTooltipVisible(false);
    try {
      setPaymentCards(await getPaymentMethods());
      if (role === 'tutor') {
        const balance = await getTutorPayoutsBalance().catch(() => null);
        setPayoutBalance(balance?.available ?? 0);
      }
    } catch {
      setPaymentCards([]);
    } finally {
      setPaymentsLoading(false);
    }
  }

  async function handleDeleteCard(card: Card) {
    setDeletingCardId(card.id);
    setDeleteCardError('');
    try {
      try {
        await deletePaymentMethod(card.id);
      } catch {
        // Бэкенд может не поддерживать удаление по id — пробуем legacy-эндпоинт
        // "отвязать текущую карту" (см. payments.web.tsx, та же логика).
        await deleteCurrentPaymentMethod();
      }
      setPaymentCards((prev) => prev.filter((c) => c.id !== card.id));
    } catch (e: any) {
      setDeleteCardError(e?.message ?? 'Не удалось удалить карту');
    } finally {
      setDeletingCardId(null);
    }
  }

  async function handleLinkCard() {
    if (isLinkingCard || paymentCards.length >= MAX_CARDS) return;
    setIsLinkingCard(true);
    setLinkCardError('');
    try {
      const { confirmationUrl } = await bindPaymentMethod();
      const w = (globalThis as any).window;
      if (w) w.location.href = confirmationUrl;
    } catch (e: any) {
      setLinkCardError(e?.message ?? 'Не удалось привязать карту');
    } finally {
      setIsLinkingCard(false);
    }
  }

  // Каждая вложенная модалка закрывает "Платежи" перед открытием — два
  // одновременно видимых <Modal> с разной высотой карточки иначе накладываются
  // друг на друга (более короткая не полностью перекрывает более высокую).
  function openEditCard(card: Card) {
    setPaymentsModalVisible(false);
    setEditingCard(card);
    const month = (card as { expiryMonth?: string }).expiryMonth;
    const year = (card as { expiryYear?: string }).expiryYear;
    setEditCardExpiry(month && year ? `${month}/${year}` : '');
    setEditCardCvv('');
    setEditCardError('');
    setEditCardModalVisible(true);
  }

  // "Изменить" в модалке редактирования карты — реальное изменение данных карты
  // (номер/CVV) возможно только через хостед-форму YooKassa (PCI DSS), поэтому
  // кнопка просто запускает ту же привязку, что и при добавлении новой карты.
  async function handleChangeCard() {
    if (editCardSubmitting) return;
    setEditCardSubmitting(true);
    setEditCardError('');
    try {
      const { confirmationUrl } = await bindPaymentMethod();
      const w = (globalThis as any).window;
      if (w) w.location.href = confirmationUrl;
    } catch (e: any) {
      setEditCardError(e?.message ?? 'Не удалось изменить карту');
    } finally {
      setEditCardSubmitting(false);
    }
  }

  function openWithdrawModal(card: Card) {
    setPaymentsModalVisible(false);
    setWithdrawCard(card);
    setWithdrawModalVisible(true);
  }

  // "Нет, заменю" — закрываем подтверждение выплаты и открываем "Изменить карту".
  function handleWithdrawReplace() {
    setWithdrawModalVisible(false);
    if (withdrawCard) openEditCard(withdrawCard);
  }

  // "Да, все ок" — реального эндпоинта вывода средств пока нет (см. TODO в
  // tutor-payments.web.tsx), поэтому имитируем успешную отправку так же, как
  // уже сделано на той странице. catch остаётся на будущее, когда появится
  // реальный запрос — тогда ошибка покажет "Оплата не прошла" (см. макет).
  async function handleWithdrawConfirm() {
    if (isWithdrawing) return;
    setIsWithdrawing(true);
    try {
      await new Promise((r) => setTimeout(r, 300));
      setWithdrawModalVisible(false);
      setWithdrawFailedVisible(false);
      setWithdrawSuccessVisible(true);
    } catch (e: any) {
      setWithdrawModalVisible(false);
      setWithdrawError(e?.message ?? 'Повторите попытку или попробуйте оплатить с другой карты');
      setWithdrawFailedVisible(true);
    } finally {
      setIsWithdrawing(false);
    }
  }

  // ── "Отправить деньги на эту карту?" modal — открывается из "Платежи" ──────
  function renderWithdrawModal() {
    return (
      <Modal transparent animationType="fade" visible={withdrawModalVisible} onRequestClose={() => setWithdrawModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setWithdrawModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={[styles.modalHeaderRow, styles.modalHeaderRowSpread]}>
              <Text style={styles.modalTitle}>Отправить деньги на эту карту?</Text>
              <Pressable onPress={() => setWithdrawModalVisible(false)}><Text style={styles.backArrow}>✕</Text></Pressable>
            </View>

            <Text style={styles.paymentCardLabel}>Карта</Text>
            <Text style={styles.paymentCardNumber}>{withdrawCard?.cardMasked ?? withdrawCard?.card_masked ?? '****'}</Text>
            {(withdrawCard?.cardType ?? withdrawCard?.provider) ? (
              <Text style={styles.paymentCardBank}>{withdrawCard?.cardType ?? withdrawCard?.provider}</Text>
            ) : null}

            <View style={styles.modalFooterRow}>
              <Pressable onPress={handleWithdrawReplace}><Text style={styles.modalCancelText}>Нет, заменю</Text></Pressable>
              <Pressable onPress={handleWithdrawConfirm} disabled={isWithdrawing}>
                <Text style={styles.modalSaveText}>{isWithdrawing ? '…' : 'Да, все ок'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  // ── "Деньги отправлены!" modal — после подтверждения выплаты ───────────────
  function renderWithdrawSuccessModal() {
    return (
      <Modal transparent animationType="fade" visible={withdrawSuccessVisible} onRequestClose={() => setWithdrawSuccessVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setWithdrawSuccessVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={[styles.modalHeaderRow, styles.modalHeaderRowSpread]}>
              <Text style={styles.modalTitle}>Деньги отправлены!</Text>
              <Pressable onPress={() => setWithdrawSuccessVisible(false)}><Text style={styles.backArrow}>✕</Text></Pressable>
            </View>
            <Text style={styles.withdrawMessage}>Мы отправим вам на карту {payoutBalance.toLocaleString('ru-RU')} Р.</Text>
            <Text style={styles.withdrawMessage}>{WITHDRAWAL_TOOLTIP}.</Text>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  // ── "Оплата не прошла" modal — ошибка выплаты, переиспользует вид ошибки
  // оплаты из букинг-флоу (explore/[id]/slots.web.tsx) ───────────────────────
  function renderWithdrawFailedModal() {
    return (
      <Modal transparent animationType="fade" visible={withdrawFailedVisible} onRequestClose={() => setWithdrawFailedVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setWithdrawFailedVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={[styles.modalHeaderRow, styles.modalHeaderRowSpread]}>
              <Text style={[styles.modalTitle, styles.modalTitleError]}>Оплата не прошла</Text>
              <Pressable onPress={() => setWithdrawFailedVisible(false)}><Text style={styles.backArrow}>✕</Text></Pressable>
            </View>
            <Text style={styles.errorText}>{withdrawError}</Text>
            <View style={styles.modalFooterRow}>
              <Pressable onPress={() => { setWithdrawFailedVisible(false); if (withdrawCard) openEditCard(withdrawCard); }}>
                <Text style={styles.modalCancelText}>Сменить карту</Text>
              </Pressable>
              <Pressable onPress={handleWithdrawConfirm} disabled={isWithdrawing}>
                <Text style={styles.modalSaveText}>{isWithdrawing ? '…' : 'Попробовать ещё раз'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  // ── "Изменить карту" modal — открывается из "Платежи" ──────────────────────
  function renderEditCardModal() {
    return (
      <Modal transparent animationType="fade" visible={editCardModalVisible} onRequestClose={() => setEditCardModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setEditCardModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={[styles.modalHeaderRow, styles.modalHeaderRowSpread]}>
              <Text style={styles.modalTitle}>Изменить карту</Text>
              <Pressable onPress={() => setEditCardModalVisible(false)}><Text style={styles.backArrow}>✕</Text></Pressable>
            </View>

            <View style={styles.editCardNumberBlock}>
              <Text style={styles.paymentCardLabel}>Номер карты</Text>
              <Text style={styles.paymentCardNumber}>{editingCard?.cardMasked ?? editingCard?.card_masked ?? '****'}</Text>
              {(editingCard?.cardType ?? editingCard?.provider) ? (
                <Text style={styles.paymentCardBank}>{editingCard?.cardType ?? editingCard?.provider}</Text>
              ) : null}
            </View>

            <View style={styles.editCardRow}>
              <View style={styles.editCardRowItem}>
                <FieldWithPlus label="ММ/ГГ" value={editCardExpiry} onChangeText={setEditCardExpiry} />
              </View>
              <View style={styles.editCardRowItem}>
                <FieldWithPlus label="CVV" value={editCardCvv} onChangeText={setEditCardCvv} keyboardType="numeric" />
              </View>
            </View>

            {editCardError ? <Text style={styles.errorText}>{editCardError}</Text> : null}

            <View style={styles.modalFooterRow}>
              <Pressable onPress={() => setEditCardModalVisible(false)}><Text style={styles.modalCancelText}>Отменить</Text></Pressable>
              <Pressable onPress={handleChangeCard} disabled={editCardSubmitting}>
                <Text style={styles.modalSaveText}>{editCardSubmitting ? 'Открываем…' : 'Изменить'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  async function openHistoryModal() {
    setPaymentsModalVisible(false);
    setHistoryModalVisible(true);
    setHistoryLoading(true);
    setPayoutTooltipId(null);
    try {
      if (role === 'tutor') {
        setPayoutHistory(await getTutorPayouts());
      } else {
        const { items } = await fetchStudentPaymentHistory();
        setPaymentHistory(items);
      }
    } catch {
      setPaymentHistory([]);
      setPayoutHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  // ── "История платежей" modal — открывается из "Платежи" ────────────────────
  function renderHistoryModal() {
    const isEmpty = role === 'tutor' ? payoutHistory.length === 0 : paymentHistory.length === 0;
    return (
      <Modal transparent animationType="fade" visible={historyModalVisible} onRequestClose={() => setHistoryModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setHistoryModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={[styles.modalHeaderRow, styles.modalHeaderRowSpread]}>
              <Text style={styles.modalTitle}>История платежей</Text>
              <Pressable onPress={() => setHistoryModalVisible(false)}><Text style={styles.backArrow}>✕</Text></Pressable>
            </View>

            {historyLoading ? (
              <ActivityIndicator color="#010101" />
            ) : isEmpty ? (
              <Text style={styles.emptyText}>Платежей пока нет</Text>
            ) : role === 'tutor' ? (
              <ScrollView style={styles.historyScroll}>
                {payoutHistory.map((p) => (
                  <View key={p.id} style={styles.historyItem}>
                    <View style={styles.historyTopRow}>
                      <Text style={styles.historyOrderNumber}>№{p.id}</Text>
                      <Text style={styles.historyStatus}>{payoutStatusLabel(p.status)}</Text>
                    </View>
                    <View style={styles.historyTopRow}>
                      <Text style={styles.historySubtitle}>{p.description ?? 'Вывод на карту'}</Text>
                      <View style={styles.tooltipAnchor}>
                        <Pressable onPress={() => setPayoutTooltipId((cur) => (cur === p.id ? null : p.id))}>
                          <Text style={styles.infoIconText}>ⓘ</Text>
                        </Pressable>
                        {payoutTooltipId === p.id ? (
                          <View style={styles.payoutTooltipBubble}>
                            <Text style={styles.tooltipBubbleText}>{WITHDRAWAL_TOOLTIP}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <Text style={styles.historyDate}>{formatHistoryDate(p.createdAt ?? p.created_at ?? '')}</Text>
                    <Text style={styles.historyAmountRight}>{p.amount.toLocaleString('ru-RU')} Р</Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <ScrollView style={styles.historyScroll}>
                {paymentHistory.map((item) => (
                  <View key={item.id} style={styles.historyItem}>
                    <View style={styles.historyTopRow}>
                      <Text style={styles.historyOrderNumber}>№{item.id}</Text>
                      <Text style={styles.historyStatus}>{historyStatusLabel(item.status)}</Text>
                    </View>
                    <Text style={styles.historyTitle}>{item.title}</Text>
                    {item.subtitle ? <Text style={styles.historySubtitle}>{item.subtitle}</Text> : null}
                    <View style={styles.historyBottomRow}>
                      <Text style={styles.historyDate}>{formatHistoryDate(item.created_at)}</Text>
                      <Text style={styles.historyAmount}>{item.amount.toLocaleString('ru-RU')} Р</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  // ── "Платежи" modal — общая для студента и наставника ──────────────────────
  function renderPaymentsModal() {
    return (
      <Modal transparent animationType="fade" visible={paymentsModalVisible} onRequestClose={() => setPaymentsModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setPaymentsModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={[styles.modalHeaderRow, styles.modalHeaderRowSpread]}>
              <Text style={styles.modalTitle}>Платежи</Text>
              <Pressable onPress={() => setPaymentsModalVisible(false)}><Text style={styles.backArrow}>✕</Text></Pressable>
            </View>

            {paymentsLoading ? (
              <ActivityIndicator color="#010101" />
            ) : (
              paymentCards.map((card) => (
                <View key={card.id} style={styles.paymentCardBlock}>
                  <Text style={styles.paymentCardLabel}>Карта</Text>
                  <Text style={styles.paymentCardNumber}>{card.cardMasked ?? card.card_masked ?? '****'}</Text>
                  {(card.cardType ?? card.provider) ? <Text style={styles.paymentCardBank}>{card.cardType ?? card.provider}</Text> : null}

                  {role === 'tutor' ? (
                    <View style={styles.balanceRow}>
                      <Text style={styles.balanceLabel}>Баланс: {payoutBalance.toLocaleString('ru-RU')} Р</Text>
                      <View style={styles.tooltipAnchor}>
                        <Pressable style={styles.balanceInfoIcon} onPress={() => setBalanceTooltipVisible((v) => !v)}>
                          <Svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                            <Circle cx="8.5" cy="8.5" r="8" stroke="black" />
                            <Path d="M8.62 10.9H7.78L7.598 8.73C8.718 8.73 10.552 8.31 10.552 6.56C10.552 5.3 9.67 4.53 8.2 4.53C6.702 4.53 5.778 5.3 5.778 6.56V6.91H4.588V6.56C4.588 4.6 6.352 3.69 8.2 3.69C10.16 3.69 11.812 4.6 11.812 6.56C11.812 8.94 8.802 9.22 8.802 9.22L8.62 10.9ZM8.802 11.67H7.598V13H8.802V11.67Z" fill="black" />
                          </Svg>
                        </Pressable>
                        {balanceTooltipVisible ? (
                          <View style={styles.balanceTooltipBubble}>
                            <Text style={styles.tooltipBubbleText}>{BALANCE_TOOLTIP}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.paymentActionsRow}>
                    <Pressable onPress={openHistoryModal}>
                      <Text style={styles.paymentHistoryLink}>История платежей</Text>
                    </Pressable>
                    <View style={styles.paymentRightActions}>
                      {role === 'tutor' ? (
                        !isMobile ? (
                          <Pressable onPress={() => openWithdrawModal(card)}>
                            <Text style={styles.paymentCardEdit}>Вывод на карту</Text>
                          </Pressable>
                        ) : null
                      ) : (
                        <Pressable onPress={() => handleDeleteCard(card)} disabled={deletingCardId === card.id}>
                          <Text style={styles.paymentCardDelete}>{deletingCardId === card.id ? '…' : 'Удалить'}</Text>
                        </Pressable>
                      )}
                      <Pressable onPress={() => openEditCard(card)}>
                        <Text style={styles.paymentCardEdit}>Изменить</Text>
                      </Pressable>
                    </View>
                  </View>
                  {deleteCardError ? <Text style={styles.errorText}>{deleteCardError}</Text> : null}
                </View>
              ))
            )}

            {!paymentsLoading && paymentCards.length < MAX_CARDS ? (
              <>
                <Pressable style={styles.linkRow} onPress={handleLinkCard} disabled={isLinkingCard}>
                  <View style={styles.plusBox}><Text style={styles.plusText}>+</Text></View>
                  <View style={styles.linkTextBox}><Text style={styles.linkText}>{isLinkingCard ? 'Привязка...' : 'Привязать карту'}</Text></View>
                </Pressable>
                <Text style={styles.verificationNote}>С карты спишется проверочный платеж 1 Р.</Text>
                {linkCardError ? <Text style={styles.errorText}>{linkCardError}</Text> : null}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  // ── Tutor handlers (unchanged) ────────────────────────────────────────────
  async function handleTutorSave() {
    setTutorSaving(true);
    setTutorSaveError('');
    setTutorSaveOk(false);
    try {
      await updateTutorProfile({
        fullName, bio, shortBio, telegram,
        avatarUrl: avatarUrl || undefined,
        hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
        specialization: specialization ?? undefined,
      });
      setTutorSaveOk(true);
      setTutorEditModalVisible(false);
    } catch (e: any) {
      setTutorSaveError(e?.message ?? 'Не удалось сохранить');
    } finally {
      setTutorSaving(false);
    }
  }

  async function handleRemoveSlot(id: string) {
    try {
      await deleteTutorSlot(id);
      setSlots((prev) => prev.filter((s) => s.id !== id));
    } catch { /* ignore — slot stays in list, user can retry */ }
  }

  function closeSlotsModal() {
    setSlotsModalVisible(false);
    setNewSlotDate('');
    setNewSlotTime('');
    setSlotsSaveError('');
    setSelectedSlotId(null);
    setHoveredSlotId(null);
  }

  /** Создаёт слот сразу на бэкенде (не откладывает до "Сохранить" — та кнопка
   * теперь просто закрывает попап, см. запрос пользователя). Бэкенд требует
   * price в CreateSlotDto — берём его из "Стоимость часа" профиля, отдельного
   * поля цены в этом попапе нет. */
  async function createAndAddSlot(date: string, time: string) {
    if (!date || !time) return;
    const price = Number(hourlyRate);
    if (!price || price <= 0) {
      setSlotsSaveError('Укажите стоимость часа в личных данных, чтобы создавать слоты');
      return;
    }
    setSlotsSaveError('');
    try {
      const slot = await createTutorSlot({ date, time, price });
      setSlots((prev) => [...prev, slot]);
    } catch (e: any) {
      setSlotsSaveError(e?.message ?? 'Не удалось создать слот — попробуйте ещё раз');
    }
  }

  /** "+" у даты — дата уже известна, открываем мини-пикер только для времени;
   * повторный клик по "+" той же даты закрывает его. */
  function toggleTimePickerForDate(date: string) {
    setTimePickerOpenDate((cur) => (cur === date ? null : date));
    setTimePickerDraft('');
  }

  function confirmTimePickerSlot() {
    if (timePickerOpenDate && timePickerDraft) {
      createAndAddSlot(timePickerOpenDate, timePickerDraft);
    }
    setTimePickerOpenDate(null);
    setTimePickerDraft('');
  }

  async function handleCreateEvent() {
    setCreatingEvent(true);
    setEventError('');
    try {
      let coverUrl: string | undefined;
      if (eventCoverUri) coverUrl = await uploadEventImage(eventCoverUri);
      const startDate = new Date(`${eventDate}T${eventTime}:00`);
      const endDate = new Date(startDate.getTime() + DEFAULT_EVENT_DURATION_MINUTES * 60000);
      await createTutorEventFull({
        title: eventTitle, description: eventDescription,
        datetime_start: startDate.toISOString(), datetime_end: endDate.toISOString(),
        price: eventPrice ? Number(eventPrice) : 0, max_participants: eventMax ? Number(eventMax) : 0,
        coverUrl, topic: eventTopic ?? undefined, category: eventFormat ?? undefined,
      });
      setEventCreated(true);
      setEventTitle(''); setEventDescription(''); setEventDate(''); setEventTime(''); setEventPrice(''); setEventMax(''); setEventTopic(null); setEventFormat(null); setEventCoverUri(null);
    } catch (e: any) {
      setEventError(e?.message ?? 'Не удалось создать событие');
    } finally {
      setCreatingEvent(false);
    }
  }

  async function handlePickCover() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
    if (!result.canceled && result.assets[0]) setEventCoverUri(result.assets[0].uri);
  }

  if (loading) {
    return <SiteShell><View style={styles.centered}><ActivityIndicator size="large" color="#010101" /></View></SiteShell>;
  }

  // Выйти/удалить аккаунт — в нативной версии профиля (см. profile/[id].tsx)
  // уже были, в веб-версию не попали. Общий блок для студента и наставника —
  // те же красные текстовые ссылки, что "Изменить личные данные"/"Платежи",
  // не отдельные окантованные кнопки.
  const accountActions = (
    <View style={styles.accountActionsRow}>
      <Pressable onPress={async () => { await clearAuth(); router.replace('/login' as any); }}>
        <Text style={styles.actionLink}>Выйти из аккаунта</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/(tabs)/profile/delete-account' as any)}>
        <Text style={styles.actionLink}>Удалить аккаунт</Text>
      </Pressable>
    </View>
  );

  // ─── Student view ──────────────────────────────────────────────────────────
  if (role === 'student') {
    const studentActions = (
      <>
        <Pressable style={isMobile && styles.chipHalf} onPress={() => setEditModalVisible(true)}>
          <Text style={isMobile ? styles.chipHalfText : styles.actionLink}>{isMobile ? 'Личные данные' : 'Изменить личные данные'}</Text>
        </Pressable>
        <Pressable style={isMobile && styles.chipHalf} onPress={openPaymentsModal}>
          <Text style={isMobile ? styles.chipHalfText : styles.actionLink}>Платежи</Text>
        </Pressable>
      </>
    );

    return (
      <SiteShell>
        <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.pageContent}>
          {isMobile ? (
            <View>
              <Text style={styles.studentName}>{fullName || 'Профиль'}</Text>
              {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatarMobile} /> : <View style={[styles.avatarMobile, styles.bigAvatarPlaceholder]} />}
              <View style={styles.actionsRowMobile}>{studentActions}</View>
            </View>
          ) : (
            <View style={styles.profileDesktopLayout}>
              <View style={styles.profileLeftCol}>
                <Text style={styles.studentName}>{fullName || 'Профиль'}</Text>
                <View style={styles.actionsRow}>{studentActions}</View>
              </View>
              <View style={styles.profileRightCol}>
                {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.bigAvatar} /> : <View style={[styles.bigAvatar, styles.bigAvatarPlaceholder]} />}
              </View>
            </View>
          )}

          {accountActions}
        </View>

          <SiteFooter />
        </ScrollView>

        {/* ─── Изменить данные ──────────────────────────────────────────── */}
        <Modal transparent animationType="fade" visible={editModalVisible} onRequestClose={() => setEditModalVisible(false)}>
          <Pressable style={styles.overlay} onPress={() => setEditModalVisible(false)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <View style={[styles.modalHeaderRow, styles.modalHeaderRowSpread]}>
                <Text style={styles.modalTitle}>Изменить данные</Text>
                <Pressable onPress={() => setEditModalVisible(false)}><Text style={styles.backArrow}>✕</Text></Pressable>
              </View>
              <FieldWithPlus label="Имя" value={fullName} onChangeText={setFullName} />
              <FieldWithPlus label="Почта" value={email} editable={false} />
              <FieldWithPlus label="Телеграм" value={telegram} onChangeText={setTelegram} autoCapitalize="none" placeholder="Телеграм без @" />
              <Text style={styles.fieldLabel}>Фото</Text>
              <Pressable style={styles.avatarRow} onPress={handlePickAvatar}>
                {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatarThumb} /> : <View style={[styles.avatarThumb, styles.avatarThumbPlaceholder]} />}
              </Pressable>
              <Text style={styles.fieldLabel}>Пароль</Text>
              <Pressable onPress={() => { setEditModalVisible(false); setPasswordError(''); setPasswordModalVisible(true); }}>
                <Text style={styles.passwordDots}>*********</Text>
              </Pressable>
              {editError ? <Text style={styles.errorText}>{editError}</Text> : null}
              <Pressable style={[styles.modalSaveLink, editSaving && styles.btnDisabled]} onPress={handleSaveStudentEdit} disabled={editSaving}>
                <Text style={styles.modalSaveText}>{editSaving ? 'Сохраняем…' : 'Сохранить'}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* ─── Новый пароль ─────────────────────────────────────────────── */}
        <Modal transparent animationType="fade" visible={passwordModalVisible} onRequestClose={() => setPasswordModalVisible(false)}>
          <Pressable style={styles.overlay} onPress={() => setPasswordModalVisible(false)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <View style={[styles.modalHeaderRow, styles.modalHeaderRowSpread]}>
                <View style={styles.modalHeaderLeft}>
                  <Pressable onPress={() => { setPasswordModalVisible(false); setEditModalVisible(true); }} hitSlop={8}>
                    <BackArrowIcon />
                  </Pressable>
                  <Text style={styles.modalTitle}>Новый пароль</Text>
                </View>
                <Pressable onPress={() => setPasswordModalVisible(false)}><Text style={styles.backArrow}>✕</Text></Pressable>
              </View>
              <PlusField label="Старый пароль" value={oldPassword} onChangeText={setOldPassword} secureTextEntry labelStyle={styles.popupFieldLabel} inputStyle={styles.popupFieldInput} />
              <PlusField label="Новый пароль" value={newPassword} onChangeText={setNewPassword} secureTextEntry labelStyle={styles.popupFieldLabel} inputStyle={styles.popupFieldInput} />
              <PlusField label="Повторите новый пароль" value={newPassword2} onChangeText={setNewPassword2} secureTextEntry labelStyle={styles.popupFieldLabel} inputStyle={styles.popupFieldInput} />
              <Text style={styles.hint}>Пароль должен быть не меньше 7 символов и состоять из букв, цифр и прикольных символов</Text>
              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
              <Pressable style={[styles.modalSaveLink, passwordSaving && styles.btnDisabled]} onPress={handleSavePassword} disabled={passwordSaving}>
                <Text style={styles.modalSaveText}>{passwordSaving ? 'Сохраняем…' : 'Сохранить'}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {renderPaymentsModal()}
        {renderEditCardModal()}
        {renderHistoryModal()}
        {renderWithdrawModal()}
        {renderWithdrawSuccessModal()}
        {renderWithdrawFailedModal()}
      </SiteShell>
    );
  }

  // ─── Tutor view ─────────────────────────────────────────────────────────────
  const tutorBioBlock = (
    <>
      {shortBio.trim() ? <Text style={styles.tutorShortBio}>{shortBio.trim()}</Text> : null}
      {bio.trim() ? <Text style={styles.bioText}>{bio.trim()}</Text> : null}
    </>
  );
  const tutorAvatar = avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.bigAvatar} /> : <View style={[styles.bigAvatar, styles.bigAvatarPlaceholder]} />;


  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.pageContent}>
        {isMobile ? (
          <View>
            <Text style={styles.studentName}>{fullName || 'Профиль'}</Text>
            {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatarMobile} /> : <View style={[styles.avatarMobile, styles.bigAvatarPlaceholder]} />}
            {tutorBioBlock}
            <View style={styles.actionsRowMobile}>
              <Pressable style={styles.chipHalf} onPress={() => { setTutorSaveError(''); setTutorSaveOk(false); setTutorEditModalVisible(true); }}>
                <Text style={styles.chipHalfText}>Личные данные</Text>
              </Pressable>
              <Pressable style={styles.chipHalf} onPress={openPaymentsModal}>
                <Text style={styles.chipHalfText}>Платежи</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.profileDesktopLayout}>
            <View style={styles.profileLeftCol}>
              <Text style={styles.studentName}>{fullName || 'Профиль'}</Text>
              {tutorBioBlock}
              <View style={styles.actionsRow}>
                <Pressable onPress={() => { setTutorSaveError(''); setTutorSaveOk(false); setTutorEditModalVisible(true); }}>
                  <Text style={styles.actionLink}>Изменить личные данные</Text>
                </Pressable>
                <Pressable onPress={openPaymentsModal}>
                  <Text style={styles.actionLink}>Платежи</Text>
                </Pressable>
                <Pressable onPress={() => { setEventCreated(false); setEventError(''); setNewEventModalVisible(true); }}>
                  <Text style={styles.actionLink}>Создать событие</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.profileRightCol}>{tutorAvatar}</View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Свободные слоты</Text>
        {slots.length === 0 ? <Text style={styles.emptyText}>Слотов пока нет</Text> : groupSlotsByDate(slots).map((group) => (
          <View key={group.date} style={styles.slotDateGroup}>
            <Text style={styles.slotDateLabel}>{formatSlotDateLabel(group.date)}</Text>
            <View style={styles.slotTimesRow}>
              {group.slots.map((s) => <Text key={s.id} style={styles.slotTimeText}>{s.time.slice(0, 5)}</Text>)}
            </View>
          </View>
        ))}
        <Pressable style={[styles.addSlotButton, isMobile && styles.mobileChip]} onPress={() => { setSelectedSlotId(null); setSlotsSaveError(''); setSlotsModalVisible(true); }}>
          <Text style={[styles.addSlotLink, isMobile && styles.mobileChipText]}>Добавить слот</Text>
        </Pressable>

        {accountActions}
      </View>

        <SiteFooter />
      </ScrollView>

      {/* ─── Изменение данных (наставник) ────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={tutorEditModalVisible} onRequestClose={() => setTutorEditModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setTutorEditModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <ScrollView style={styles.slotsModalScroll}>
              <Text style={styles.modalTitle}>Изменение данных</Text>
              <FieldWithPlus label="Имя" value={fullName} onChangeText={setFullName} />
              <FieldWithPlus label="Описание" value={shortBio} onChangeText={setShortBio} />
              <FieldWithPlus label="Почта" value={email} editable={false} />
              <FieldWithPlus label="Телеграм" value={telegram} onChangeText={setTelegram} autoCapitalize="none" placeholder="Телеграм без @" />
              <FieldWithPlus label="Доп. информация" value={bio} onChangeText={setBio} multiline />
              <FieldWithPlus label="Стоимость часа" value={hourlyRate} onChangeText={setHourlyRate} keyboardType="numeric" />
              {hourlyRate && Number(hourlyRate) > 0 ? (
                <Text style={styles.hint}>Комиссия 10% — вы получите {Math.round(Number(hourlyRate) * 0.9)} Р</Text>
              ) : null}
              {/* Без этого поля специализация наставника никогда не устанавливалась
                  и не менялась после регистрации — наставник навсегда выпадал из
                  всех фильтров рубрикатора на /explore. */}
              <Text style={styles.fieldLabel}>Специализация</Text>
              <View style={styles.eventTopicsRow}>
                {topicsList.map((t) => {
                  const active = t === specialization;
                  return (
                    <Pressable key={t} onPress={() => setSpecialization(active ? null : t)}>
                      <Text style={[styles.eventTopicPillText, active && styles.eventTopicPillTextActive]}>{t}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.fieldLabel}>Фото</Text>
              <Pressable onPress={handlePickAvatar}>
                {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatarThumb} /> : <View style={[styles.avatarThumb, styles.avatarThumbPlaceholder]} />}
              </Pressable>
              <Text style={styles.fieldLabel}>Пароль</Text>
              <Pressable onPress={() => { setTutorEditModalVisible(false); setPasswordError(''); setPasswordModalVisible(true); }}>
                <Text style={styles.passwordDots}>*********</Text>
              </Pressable>
              {tutorSaveError ? <Text style={styles.errorText}>{tutorSaveError}</Text> : null}
              {tutorSaveOk ? <Text style={styles.successText}>Сохранено</Text> : null}
            </ScrollView>
            <View style={styles.modalFooterRow}>
              <Pressable onPress={() => setTutorEditModalVisible(false)}><Text style={styles.modalCancelText}>Отменить</Text></Pressable>
              <Pressable onPress={handleTutorSave} disabled={tutorSaving}>
                <Text style={styles.modalSaveText}>{tutorSaving ? 'Сохраняем…' : 'Сохранить'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Новый пароль (общая модалка) ────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={passwordModalVisible} onRequestClose={() => setPasswordModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setPasswordModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeaderRow}>
              <Pressable onPress={() => { setPasswordModalVisible(false); setTutorEditModalVisible(true); }} hitSlop={8}>
                <BackArrowIcon />
              </Pressable>
              <Text style={styles.modalTitle}>Новый пароль</Text>
            </View>
            <PlusField label="Старый пароль" value={oldPassword} onChangeText={setOldPassword} secureTextEntry labelStyle={styles.popupFieldLabel} inputStyle={styles.popupFieldInput} />
            <PlusField label="Новый пароль" value={newPassword} onChangeText={setNewPassword} secureTextEntry labelStyle={styles.popupFieldLabel} inputStyle={styles.popupFieldInput} />
            <PlusField label="Повторите пароль" value={newPassword2} onChangeText={setNewPassword2} secureTextEntry labelStyle={styles.popupFieldLabel} inputStyle={styles.popupFieldInput} />
            <Text style={styles.hint}>Пароль должен быть не меньше 7 символов и состоять из букв, цифр и прикольных символов</Text>
            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            <Pressable style={[styles.primaryButton, passwordSaving && styles.btnDisabled]} onPress={handleSavePassword} disabled={passwordSaving}>
              <Text style={styles.primaryButtonText}>{passwordSaving ? 'Сохраняем…' : 'Сохранить'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {renderPaymentsModal()}
      {renderEditCardModal()}
      {renderHistoryModal()}
      {renderWithdrawModal()}
      {renderWithdrawSuccessModal()}
      {renderWithdrawFailedModal()}

      {/* ─── Добавить событие ─────────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={newEventModalVisible} onRequestClose={() => setNewEventModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setNewEventModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={[styles.modalHeaderRow, styles.modalHeaderRowSpread]}>
              <Text style={styles.modalTitle}>Добавить событие</Text>
              <Pressable onPress={() => setNewEventModalVisible(false)}><Text style={styles.backArrow}>✕</Text></Pressable>
            </View>
            <ScrollView style={styles.slotsModalScroll}>
              {eventCreated ? <Text style={styles.successText}>Событие создано</Text> : null}
              <FieldWithPlus label="Название" value={eventTitle} onChangeText={setEventTitle} />
              <FieldWithPlus
                label="Описание"
                value={eventDescription}
                onChangeText={(t) => setEventDescription(clampEventDescription(t))}
                multiline
                maxLength={EVENT_DESCRIPTION_MAX_CHARS}
              />
              <Text style={styles.hint}>Ограничение: {EVENT_DESCRIPTION_MAX_CHARS} символов или {EVENT_DESCRIPTION_MAX_WORDS} слов</Text>
              <DateFieldWithPicker
                label="Дата" value={eventDate} onChangeValue={setEventDate}
                pickerId="new-event-date" openPickerId={openPickerId} onOpenPicker={setOpenPickerId}
              />
              <TimeFieldWithPicker
                label="Время" value={eventTime} onChangeValue={setEventTime} referenceDate={eventDate}
                pickerId="new-event-time" openPickerId={openPickerId} onOpenPicker={setOpenPickerId}
              />
              <FieldWithPlus label="Стоимость участия" value={eventPrice} onChangeText={setEventPrice} keyboardType="numeric" />
              <FieldWithPlus label="Максимальное количество участников" value={eventMax} onChangeText={setEventMax} keyboardType="numeric" />
              {/* Без выбора формата событие никогда не получало category — не
                  попадало ни под один фильтр на /events, кроме "Все". */}
              <Text style={styles.fieldLabel}>Формат</Text>
              <View style={styles.eventTopicsRow}>
                {EVENT_FORMATS.map(({ label, slug }) => {
                  const active = slug === eventFormat;
                  return (
                    <Pressable key={slug} onPress={() => setEventFormat(active ? null : slug)}>
                      <Text style={[styles.eventTopicPillText, active && styles.eventTopicPillTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.fieldLabel}>Рубрика</Text>
              <View style={styles.eventTopicsRow}>
                {topicsList.map((t) => {
                  const active = t === eventTopic;
                  return (
                    <Pressable key={t} onPress={() => setEventTopic(active ? null : t)}>
                      <Text style={[styles.eventTopicPillText, active && styles.eventTopicPillTextActive]}>{t}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.fieldLabel}>Обложка</Text>
              <Pressable style={styles.fieldInputWrap} onPress={handlePickCover}>
                {eventCoverUri ? <Image source={{ uri: eventCoverUri }} style={styles.avatarThumb} /> : (
                  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <Circle cx="12" cy="12" r="10" stroke="#010101" strokeWidth="1" />
                    <Path d="M12 7.5V16.5M7.5 12H16.5" stroke="#010101" strokeWidth="1" strokeLinecap="round" />
                  </Svg>
                )}
              </Pressable>
              {eventError ? <Text style={styles.errorText}>{eventError}</Text> : null}
            </ScrollView>
            <View style={styles.modalFooterRow}>
              <Pressable onPress={() => setNewEventModalVisible(false)}><Text style={styles.modalCancelText}>Отменить</Text></Pressable>
              <Pressable onPress={handleCreateEvent} disabled={creatingEvent}>
                <Text style={styles.modalSaveText}>{creatingEvent ? 'Создаём…' : 'Сохранить'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent animationType="fade" visible={slotsModalVisible} onRequestClose={closeSlotsModal}>
        <Pressable style={styles.overlay} onPress={closeSlotsModal}>
          <Pressable style={[styles.modalCard, styles.slotsModalCard]} onPress={() => {}}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>{isMobile ? 'Редактировать слоты' : 'Редактировать слоты для записи'}</Text>
            </View>

            <ScrollView style={styles.slotsModalScroll}>
              {groupSlotsByDate(slots).map((group) => (
                <View key={group.date} style={styles.slotDateGroup}>
                  <Text style={styles.slotDateLabel}>{formatSlotDateLabel(group.date)}</Text>
                  <View style={styles.slotTimesRow}>
                    {group.slots.map((s) => {
                      const active = selectedSlotId === s.id || hoveredSlotId === s.id;
                      return (
                        <Pressable
                          key={s.id}
                          style={styles.slotTimeWrap}
                          onHoverIn={() => {
                            if (slotHoverOutTimer.current) clearTimeout(slotHoverOutTimer.current);
                            setHoveredSlotId(s.id);
                          }}
                          onHoverOut={() => {
                            if (slotHoverOutTimer.current) clearTimeout(slotHoverOutTimer.current);
                            slotHoverOutTimer.current = setTimeout(() => {
                              setHoveredSlotId((cur) => (cur === s.id ? null : cur));
                            }, 200);
                          }}
                          onPress={() => setSelectedSlotId((cur) => (cur === s.id ? null : s.id))}
                        >
                          <Text style={[styles.slotTimeText, active && styles.slotTimeTextSelected]}>{s.time.slice(0, 5)}</Text>
                          {/* Всегда в разметке (не condition-render) — иначе появление
                              иконки сдвигает соседние слоты/чип "+" вправо прямо под
                              курсором и наведение "убегает". Скрываем через opacity. */}
                          <Pressable
                            style={[styles.slotRemoveChip, !active && styles.slotRemoveChipHidden]}
                            onHoverIn={() => { if (slotHoverOutTimer.current) clearTimeout(slotHoverOutTimer.current); setHoveredSlotId(s.id); }}
                            onPress={(e) => { e.stopPropagation?.(); handleRemoveSlot(s.id); setSelectedSlotId(null); }}
                            hitSlop={6}
                          >
                            <Svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <Path d="M1.5 5H8.5" stroke="#E02D2D" strokeWidth="1.5" strokeLinecap="round" />
                            </Svg>
                          </Pressable>
                        </Pressable>
                      );
                    })}
                    <Pressable style={styles.slotAddChip} onPress={() => toggleTimePickerForDate(group.date)}>
                      <Text style={styles.slotAddChipText}>+</Text>
                    </Pressable>
                  </View>

                  {timePickerOpenDate === group.date ? (
                    <View style={styles.slotTimePickerRow}>
                      <TimeFieldWithPicker
                        value={timePickerDraft} onChangeValue={setTimePickerDraft} autoActive referenceDate={group.date}
                        pickerId={`slot-time-${group.date}`} openPickerId={openPickerId} onOpenPicker={setOpenPickerId}
                      />
                      <Pressable
                        style={[styles.slotTimePickerConfirm, !timePickerDraft && styles.btnDisabled]}
                        onPress={confirmTimePickerSlot}
                        disabled={!timePickerDraft}
                      >
                        <Text style={styles.slotTimePickerConfirmText}>Добавить слот</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>

            <DateFieldWithPicker
              label="Дата" value={newSlotDate} onChangeValue={setNewSlotDate}
              pickerId="new-slot-date" openPickerId={openPickerId} onOpenPicker={setOpenPickerId}
            />
            <TimeFieldWithPicker
              label="Время" value={newSlotTime} onChangeValue={setNewSlotTime} referenceDate={newSlotDate}
              pickerId="new-slot-time" openPickerId={openPickerId} onOpenPicker={setOpenPickerId}
            />
            {newSlotDate && newSlotTime ? (
              <Pressable
                style={styles.slotTimePickerConfirm}
                onPress={() => { createAndAddSlot(newSlotDate, newSlotTime); setNewSlotDate(''); setNewSlotTime(''); }}
              >
                <Text style={styles.slotTimePickerConfirmText}>Добавить слот</Text>
              </Pressable>
            ) : null}

            {slotsSaveError ? <Text style={styles.errorText}>{slotsSaveError}</Text> : null}

            <View style={styles.modalFooterRow}>
              <Pressable onPress={closeSlotsModal}><Text style={styles.modalCancelText}>Отменить</Text></Pressable>
              {/* Слоты уже сохранены сразу при создании — "Сохранить" здесь чисто
                  декоративная кнопка, просто закрывает попап. */}
              <Pressable onPress={closeSlotsModal}>
                <Text style={styles.modalSaveText}>Сохранить</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SiteShell>
  );
}

/**
 * Тонкая обёртка над общим PlusField (см. components/web/plus-field.tsx),
 * чтобы не переписывать все места использования по всему файлу: подпись +
 * кружок с плюсом вместо рамки, клик по плюсу открывает настоящий инпут с
 * курсором (см. ту же логику на страницах авторизации/регистрации).
 */
function FieldWithPlus({ label, value, onChangeText, editable, keyboardType, autoCapitalize, multiline, maxLength, placeholder }: {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  editable?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <PlusField
      label={label}
      value={value}
      onChangeText={onChangeText ?? (() => {})}
      editable={editable}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      multiline={multiline}
      maxLength={maxLength}
      placeholder={placeholder}
      labelStyle={styles.popupFieldLabel}
      inputStyle={styles.popupFieldInput}
    />
  );
}

const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Примерная высота попапов — используется, чтобы решить, помещается ли попап
// снизу от поля, или его нужно открыть вверх (см. useFlipDirection ниже).
const TIME_POPOVER_HEIGHT = 290;
const DATE_POPOVER_HEIGHT = 390;

/**
 * Меряет положение якоря относительно окна в момент открытия попапа и решает,
 * в какую сторону он поместится: вниз (по умолчанию) или вверх, если снизу
 * не хватает места, а сверху его больше. Пересчитывается при каждом открытии
 * (positions could change, e.g. after scrolling), не при каждом рендере.
 */
function useFlipDirection(open: boolean, popoverHeight: number): [React.RefObject<any>, 'down' | 'up'] {
  const anchorRef = useRef<any>(null);
  const [direction, setDirection] = useState<'down' | 'up'>('down');
  useEffect(() => {
    if (!open) return;
    const node = anchorRef.current;
    if (!node || typeof node.getBoundingClientRect !== 'function') return;
    const rect = node.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setDirection(spaceBelow < popoverHeight && spaceAbove > spaceBelow ? 'up' : 'down');
  }, [open, popoverHeight]);
  return [anchorRef, direction];
}

/**
 * Закрывает попап по клику вне области якоря (поле + сам попап) — без этого
 * открытый date/timepicker можно было закрыть только повторным кликом по
 * значению или (для времени) кнопкой "Выбрать", а клик мимо ни на что не
 * влиял, попап просто оставался висеть поверх контента.
 */
function useOutsideClick(ref: React.RefObject<any>, active: boolean, onOutside: () => void) {
  const onOutsideRef = useRef(onOutside);
  onOutsideRef.current = onOutside;
  useEffect(() => {
    if (!active) return;
    function handlePointerDown(e: any) {
      const node = ref.current;
      if (node && typeof node.contains === 'function' && e.target && !node.contains(e.target)) {
        onOutsideRef.current();
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [active, ref]);
}

/**
 * Свой календарь вместо нативного <input type="date"> — тот же приём, что
 * и у TimeWheelPicker ниже (свой UI вместо непере-крашиваемого браузерного
 * попапа), плюс сразу решает "нельзя выбрать прошедшую дату": дни до
 * сегодняшнего в сетке недоступны для клика, а не просто выглядят иначе.
 */
function DateWheelPicker({ value, onPick, openUp, onConfirm }: { value: string; onPick: (v: string) => void; openUp?: boolean; onConfirm: () => void }) {
  const today = startOfToday();
  const initial = value ? new Date(`${value}T00:00:00`) : today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  // getDay(): 0=вс..6=сб — сдвигаем так, чтобы неделя начиналась с понедельника.
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewYear, viewMonth, i + 1)),
  ];

  function goMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  return (
    <View style={[styles.dateWheelPopover, openUp ? styles.dateWheelPopoverUp : styles.dateWheelPopoverDown]}>
      <View style={styles.dateWheelHeader}>
        <Pressable onPress={() => goMonth(-1)} hitSlop={8}><Text style={styles.dateWheelNav}>‹</Text></Pressable>
        <Text style={styles.dateWheelHeaderText}>{MONTHS_NOM[viewMonth]} {viewYear}</Text>
        <Pressable onPress={() => goMonth(1)} hitSlop={8}><Text style={styles.dateWheelNav}>›</Text></Pressable>
      </View>
      <View style={styles.dateWheelWeekRow}>
        {WEEKDAYS_SHORT.map((w) => <Text key={w} style={styles.dateWheelWeekday}>{w}</Text>)}
      </View>
      <View style={styles.dateWheelGrid}>
        {cells.map((d, i) => {
          if (!d) return <View key={`blank-${i}`} style={styles.dateWheelCell} />;
          const key = toDateKey(d);
          const disabled = d.getTime() < today.getTime();
          const active = key === value;
          return (
            <Pressable
              key={key}
              style={[styles.dateWheelCell, active && styles.dateWheelCellActive]}
              disabled={disabled}
              onPress={() => onPick(key)}
            >
              <Text style={[styles.dateWheelCellText, disabled && styles.dateWheelCellTextDisabled, active && styles.dateWheelCellTextActive]}>
                {d.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable style={[styles.wheelConfirmBtn, !value && styles.btnDisabled]} disabled={!value} onPress={onConfirm}>
        <Text style={styles.wheelConfirmBtnText}>Выбрать</Text>
      </Pressable>
    </View>
  );
}

/**
 * Дата/время в том же визуальном стиле, что PlusField (подпись + кружок с
 * плюсом), но вместо текстового инпута — свой попап-пикер (см.
 * DateWheelPicker/TimeWheelPicker), абсолютно спозиционированный поверх
 * остального контента — раньше открытый пикер был частью обычного потока
 * разметки и раздвигал родительскую модалку по высоте.
 */
function DateFieldWithPicker({ label, value, onChangeValue, pickerId, openPickerId, onOpenPicker }: {
  label: string; value: string; onChangeValue: (v: string) => void;
  pickerId: string; openPickerId: string | null; onOpenPicker: (id: string | null) => void;
}) {
  const [active, setActive] = useState(false);
  const pickerOpen = openPickerId === pickerId;
  const expanded = active || value.length > 0;
  const dateObj = value ? new Date(`${value}T00:00:00`) : null;
  const display = dateObj && !isNaN(dateObj.getTime())
    ? `${String(dateObj.getDate()).padStart(2, '0')}.${String(dateObj.getMonth() + 1).padStart(2, '0')}.${dateObj.getFullYear()}`
    : '';
  const [anchorRef, direction] = useFlipDirection(pickerOpen, DATE_POPOVER_HEIGHT);
  useOutsideClick(anchorRef, pickerOpen, () => onOpenPicker(null));

  return (
    <View style={[styles.plusFieldWrap, pickerOpen && styles.plusFieldWrapElevated]}>
      <Text style={styles.plusFieldLabel}>{label}</Text>
      {expanded ? (
        <View style={styles.pickerAnchor} ref={anchorRef}>
          <Pressable style={styles.plusFieldValueRow} onPress={() => onOpenPicker(pickerOpen ? null : pickerId)}>
            <Text style={styles.plusFieldValueText}>{display || 'Выберите дату'}</Text>
          </Pressable>
          {/* Попап закрывается кнопкой "Выбрать" внутри него (или кликом
              мимо), а не сразу по клику на день — иначе нельзя было
              рассмотреть выбранную дату перед подтверждением. */}
          {pickerOpen ? (
            <DateWheelPicker value={value} onPick={onChangeValue} openUp={direction === 'up'} onConfirm={() => onOpenPicker(null)} />
          ) : null}
        </View>
      ) : (
        <Pressable onPress={() => { setActive(true); onOpenPicker(pickerId); }} hitSlop={8} style={styles.plusFieldButton}>
          <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="10" stroke="#010101" strokeWidth="1" />
            <Path d="M12 7.5V16.5M7.5 12H16.5" stroke="#010101" strokeWidth="1" strokeLinecap="round" />
          </Svg>
        </Pressable>
      )}
    </View>
  );
}

const WHEEL_HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const WHEEL_MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

/**
 * Свой пикер времени вместо нативного <input type="time"> — у выпадающего
 * попапа браузера (Chrome) выделенная ячейка синяя и никак не перекрашивается
 * через CSS (это внутренний UA-shadow-DOM браузера, не наша разметка).
 * Две прокручиваемые колонки, часы/минуты, выбранная ячейка — фирменный
 * красный, как остальные акценты сайта.
 */
function TimeWheelPicker({ value, onPick, openUp, onConfirm, minTime }: {
  value: string; onPick: (v: string) => void; openUp?: boolean; onConfirm: () => void;
  minTime?: { hour: number; minute: number };
}) {
  const [h, m] = value ? value.split(':') : ['', ''];
  // Пока час ещё не выбран, onPick подставляет "00" (см. ниже) — те же "00"
  // берём и здесь, чтобы список минут дизейблился ровно так же, как реально
  // выберется час при клике по минуте.
  const effectiveHour = h ? Number(h) : 0;
  const hourDisabled = (hh: string) => !!minTime && Number(hh) < minTime.hour;
  const minuteDisabled = (mm: string) => {
    if (!minTime) return false;
    if (effectiveHour > minTime.hour) return false;
    if (effectiveHour < minTime.hour) return true;
    return Number(mm) < minTime.minute;
  };
  return (
    <View style={[styles.timeWheelPopover, openUp ? styles.timeWheelPopoverUp : styles.timeWheelPopoverDown]}>
      <View style={styles.timeWheelColumnsRow}>
        <ScrollView style={styles.timeWheelColumn} showsVerticalScrollIndicator={false}>
          {WHEEL_HOURS.map((hh) => {
            const disabled = hourDisabled(hh);
            return (
              <Pressable key={hh} style={[styles.timeWheelCell, hh === h && styles.timeWheelCellActive]} disabled={disabled} onPress={() => onPick(`${hh}:${m || '00'}`)}>
                <Text style={[styles.timeWheelCellText, disabled && styles.timeWheelCellTextDisabled, hh === h && styles.timeWheelCellTextActive]}>{hh}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <ScrollView style={styles.timeWheelColumn} showsVerticalScrollIndicator={false}>
          {WHEEL_MINUTES.map((mm) => {
            const disabled = minuteDisabled(mm);
            return (
              <Pressable key={mm} style={[styles.timeWheelCell, mm === m && styles.timeWheelCellActive]} disabled={disabled} onPress={() => onPick(`${h || '00'}:${mm}`)}>
                <Text style={[styles.timeWheelCellText, disabled && styles.timeWheelCellTextDisabled, mm === m && styles.timeWheelCellTextActive]}>{mm}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <Pressable style={[styles.wheelConfirmBtn, !(h && m) && styles.btnDisabled]} disabled={!(h && m)} onPress={onConfirm}>
        <Text style={styles.wheelConfirmBtnText}>Выбрать</Text>
      </Pressable>
    </View>
  );
}

function TimeFieldWithPicker({ label, value, onChangeValue, autoActive, referenceDate, pickerId, openPickerId, onOpenPicker }: {
  label?: string; value: string; onChangeValue: (v: string) => void; autoActive?: boolean; referenceDate?: string;
  pickerId: string; openPickerId: string | null; onOpenPicker: (id: string | null) => void;
}) {
  const [active, setActive] = useState(!!autoActive);
  const pickerOpen = openPickerId === pickerId;
  const expanded = active || value.length > 0;
  const [anchorRef, direction] = useFlipDirection(pickerOpen, TIME_POPOVER_HEIGHT);
  useOutsideClick(anchorRef, pickerOpen, () => onOpenPicker(null));

  // autoActive — попап должен быть открыт сразу при появлении поля (см.
  // инлайн-время-пикер для конкретной даты), а не только по клику.
  useEffect(() => {
    if (autoActive) onOpenPicker(pickerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Прошедшее время недоступно для выбора, но только если выбранная дата —
  // сегодня; для будущих дат все часы/минуты открыты.
  const now = new Date();
  const minTime = referenceDate && referenceDate === toDateKey(now)
    ? { hour: now.getHours(), minute: now.getMinutes() }
    : undefined;

  return (
    <View style={[styles.plusFieldWrap, pickerOpen && styles.plusFieldWrapElevated]}>
      {label ? <Text style={styles.plusFieldLabel}>{label}</Text> : null}
      {expanded ? (
        <View style={styles.pickerAnchor} ref={anchorRef}>
          <Pressable style={styles.plusFieldValueRow} onPress={() => onOpenPicker(pickerOpen ? null : pickerId)}>
            <Text style={styles.plusFieldValueText}>{value || 'Выберите время'}</Text>
          </Pressable>
          {/* Часы и минуты — два отдельных клика за одно открытие, поэтому
              попап не закрывается сам по себе; закрывается кнопкой "Выбрать"
              внутри него (или кликом мимо). */}
          {pickerOpen ? (
            <TimeWheelPicker value={value} onPick={onChangeValue} openUp={direction === 'up'} onConfirm={() => onOpenPicker(null)} minTime={minTime} />
          ) : null}
        </View>
      ) : (
        <Pressable onPress={() => { setActive(true); onOpenPicker(pickerId); }} hitSlop={8} style={styles.plusFieldButton}>
          <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="10" stroke="#010101" strokeWidth="1" />
            <Path d="M12 7.5V16.5M7.5 12H16.5" stroke="#010101" strokeWidth="1" strokeLinecap="round" />
          </Svg>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingTop: 24, paddingBottom: 48 },
  pageContent: { paddingHorizontal: 32 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },

  // Выйти/удалить аккаунт — общие для студента и наставника, тот же стиль
  // красной текстовой ссылки, что actionLink ("Изменить личные данные" и т.д.).
  accountActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, marginTop: 40 },

  // DateFieldWithPicker/TimeFieldWithPicker — те же значения, что в PlusField
  // (components/web/plus-field.tsx), для визуальной согласованности.
  // Переопределение размера текста общего PlusField/FieldWithPlus — во всех
  // попапах этой страницы текст 18px, кроме заголовка модалки.
  popupFieldLabel: { fontSize: 18 },
  popupFieldInput: { fontSize: 18, lineHeight: 22 },
  plusFieldWrap: { marginBottom: 24 },
  // Поднимаем поле над соседями по стеку, пока его попап открыт — иначе
  // текст следующих полей/кнопок (напр. "Время", "Отменить") рисуется
  // поверх попапа вместо того, чтобы быть под ним (z-index попапа сам по
  // себе сравнивается только с соседями внутри своего родителя).
  plusFieldWrapElevated: { zIndex: 50 },
  plusFieldLabel: { fontFamily: 'Gramatika-Regular', fontSize: 18, color: '#000', marginBottom: 8 },
  plusFieldButton: { paddingVertical: 2, alignSelf: 'flex-start' },
  plusFieldValueRow: { position: 'relative', paddingVertical: 4 },
  plusFieldValueText: { fontFamily: 'Gramatika-Regular', fontSize: 18, color: '#000' },
  // Якорь для попапов даты/времени — сами попапы position:'absolute'
  // относительно этого блока, чтобы не раздвигать родительскую модалку.
  pickerAnchor: { position: 'relative' },

  // Student view
  bigAvatar: { width: '100%', aspectRatio: 1, backgroundColor: '#E5E5E5', height: 410 },
  bigAvatarPlaceholder: { backgroundColor: '#E5E5E5', height: 410 },
  studentName: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101' },
  profileDesktopLayout: { flexDirection: 'row', gap: 48, alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', marginTop: 40},
  profileLeftCol: { flexBasis: 520, flexGrow: 1, flexShrink: 1, maxWidth: 659, height: '100%' },
  profileRightCol: { flexBasis: 360, flexShrink: 0, maxWidth: 400 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, marginTop: 16, position: 'absolute', bottom: 0, justifyContent: 'space-between', width: '100%' },
  actionLink: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 18, color: '#E02D2D' },
  avatarMobile: { width: 90, height: 90, backgroundColor: '#E5E5E5', marginVertical: 16 },
  actionsRowMobile: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  chipHalf: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#F0F5FB', paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  chipHalfText: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 14, color: '#68717A' },
  // Filled light-blue button used for action chips on mobile widths (see mobile mockups).
  mobileChip: { backgroundColor: '#F0F5FB', borderWidth: 0, minWidth: 0, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  mobileChipText: { color: '#68717A', fontSize: 15 },

  // Modals (shared)
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: '#fff', width: '100%', maxWidth:1021, padding: 24 },
  modalTitle: { fontSize: 40, lineHeight: 23, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#000', marginBottom: 20 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  modalHeaderRowSpread: { justifyContent: 'space-between' },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  passwordDots: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#010101', paddingVertical: 10 },
  modalSaveLink: { alignSelf: 'flex-end', marginTop: 12 },
  backArrow: { fontSize: 25, color: '#010101' },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatarThumb: { width: 44, height: 44, backgroundColor: '#E5E5E5' },
  avatarThumbPlaceholder: { backgroundColor: '#E5E5E5' },
  hint: { fontSize: 18, lineHeight: 22, fontFamily: 'Gramatika-Regular', color: '#9B9B9B', marginTop: -4, marginBottom: 12 },
  paymentCardBlock: { paddingVertical: 16, borderTopWidth: 0, borderColor: '#E5E5E5' },
  paymentCardLabel: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#000' },
  paymentCardNumber: { fontSize: 18, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginTop: 2 },
  paymentCardBank: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#9B9B9B', marginTop: 2 },
  // "Привязать карту" — тот же вид, что и на /profile/payments.
  linkRow: { flexDirection: 'row', borderWidth: 1, borderColor: '#010101', height: 56, marginTop: 16, marginBottom: 8 },
  plusBox: { width: 56, backgroundColor: '#010101', alignItems: 'center', justifyContent: 'center' },
  plusText: { fontSize: 22, fontFamily: 'Gramatika-Regular', color: '#fff' },
  linkTextBox: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  linkText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#010101' },
  verificationNote: { marginTop: 8, fontSize: 13, lineHeight: 18, fontFamily: 'Gramatika-Regular', color: '#010101' },
  editCardNumberBlock: { marginBottom: 16 },
  editCardRow: { flexDirection: 'row', gap: 16 },
  editCardRowItem: { flex: 1 },
  historyScroll: { maxHeight: 420 },
  historyItem: { paddingVertical: 16, borderTopWidth: 1, borderColor: '#E5E5E5' },
  historyTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  historyOrderNumber: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#010101' },
  historyStatus: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#687076' },
  historyTitle: { fontSize: 18, lineHeight: 22, fontFamily: 'Gramatika-Regular', color: '#010101', marginBottom: 4 },
  historySubtitle: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#687076', marginBottom: 6 },
  historyBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyDate: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#687076' },
  historyAmount: { fontSize: 18, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101' },
  infoIconText: { fontSize: 14, color: '#9B9B9B' },
  historyAmountRight: { fontSize: 18, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', textAlign: 'right', marginTop: 8 },
  // Обёртка вокруг значка ⓘ — точка отсчёта для абсолютно спозиционированного
  // всплывающего пузыря с подсказкой (см. "Баланс"/строки истории выплат в макете).
  tooltipAnchor: { position: 'relative' },
  payoutTooltipBubble: { position: 'absolute', top: 22, right: 0, width: 150, backgroundColor: '#010101', padding: 8, zIndex: 10 },
  balanceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 20 },
  balanceLabel: { fontSize: 18, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101' },
  balanceInfoIcon: { marginTop: 2 },
  balanceTooltipBubble: { position: 'absolute', top: 24, left: 0, width: 180, backgroundColor: '#010101', padding: 8, zIndex: 10 },
  tooltipBubbleText: { fontSize: 18, lineHeight: 22, fontFamily: 'Gramatika-Regular', color: '#fff' },
  withdrawMessage: { fontSize: 18, lineHeight: 22, fontFamily: 'Gramatika-Regular', color: '#010101' },
  modalTitleError: { color: '#E02D2D' },
  paymentActionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  paymentHistoryLink: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#010101' },
  paymentRightActions: { flexDirection: 'row', gap: 20 },
  paymentCardDelete: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#E02D2D' },
  paymentCardEdit: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#010101' },

  // Slots modal ("Редактировать слоты для записи")
  slotsModalCard: { maxWidth: 640 },
  slotsModalScroll: { maxHeight: 320, marginBottom: 12 },
  modalFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  modalCancelText: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#687076' },
  modalSaveText: { fontSize: 18, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#E02D2D' },

  // Tutor tabbed view (unchanged)
  tabsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginBottom: 24, borderBottomWidth: 1, borderColor: '#E5E5E5', paddingBottom: 12 },
  tabText: { fontFamily: 'Gramatika-Regular', fontSize: 14, color: '#687076' },
  tabTextActive: { color: '#010101', fontFamily: 'Gramatika-Regular', fontWeight: 'normal' },
  card: { borderWidth: 1, borderColor: '#E5E5E5', padding: 24, maxWidth: 560 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E5E5E5', marginBottom: 16 },
  fieldLabel: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#9B9B9B', marginTop: 12 },
  fieldValue: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#010101' },
  eventTopicsRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 8, marginTop: 8, marginBottom: 8 },
  eventTopicPillText: { fontFamily: 'Gramatika-Regular', fontSize: 18, color: '#838383' },
  eventTopicPillTextActive: { color: '#010101', fontFamily: 'Gramatika-Regular', fontWeight: 'normal' },
  bioText: { fontSize: 18, lineHeight: 20, fontFamily: 'Gramatika-Regular', color: '#000', marginTop: 16 },
  tutorShortBio: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#000', marginTop: 6 },
  sectionTitle: { fontSize: 40, lineHeight: 23, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginTop: 72, marginBottom: 36 },
  emptyText: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#687076',  marginTop: 24, marginBottom: 8 },
  slotDateGroup: { marginBottom: 12 },
  slotDateLabel: { fontSize: 18, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 4 },
  slotTimesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center' },
  slotTimeWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  slotTimeText: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#010101' },
  slotTimeTextSelected: { color: '#E02D2D' },
  // Красный минус в кружочке — появляется при наведении/выборе слота (см.
  // handleRemoveDisplaySlot), тот же стиль кружка, что у slotAddChip, только
  // красный и с минусом вместо плюса.
  slotRemoveChip: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: '#E02D2D', alignItems: 'center', justifyContent: 'center' },
  slotRemoveChipHidden: { opacity: 0, pointerEvents: 'none' },
  addSlotButton: { alignSelf: 'flex-start', marginTop: 8 },
  addSlotLink: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#E02D2D' },
  slotAddChip: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: '#010101', alignItems: 'center', justifyContent: 'center' },
  slotAddChipText: { fontSize: 14, lineHeight: 16, fontFamily: 'Gramatika-Regular', color: '#010101' },
  // Мини-пикер времени под группой даты — виден целиком (не спрятанный
  // <input>), с явной кнопкой "Выбрать", чтобы можно было покликать по часам
  // и минутам сколько нужно, не создавая слот раньше времени.
  slotTimePickerRow: { marginTop: 12 },
  slotTimePickerConfirm: { backgroundColor: '#F0F5FB', paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'flex-start', marginTop: 12 },
  slotTimePickerConfirmText: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 18, color: '#68717A' },

  // Свой пикер времени — см. TimeWheelPicker. Красный акцент вместо синего
  // выделения нативного браузерного попапа (тот не перекрашивается).
  // position:'absolute' — попап лежит поверх контента, а не в потоке
  // разметки, иначе раскрытый пикер раздвигал родительскую модалку.
  timeWheelPopover: {
    position: 'absolute', left: 0, zIndex: 30, width: 224,
    borderWidth: 1, borderColor: '#E5E5E5', backgroundColor: '#fff', padding: 8,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  timeWheelColumnsRow: { flexDirection: 'row', gap: 16 },
  // Направление раскрытия — отдельные стили, а не top:undefined поверх
  // timeWheelPopoverDown: в RN стиль-массивах undefined не "снимает" ранее
  // заданное значение при флэттенинге, оба свойства применяются разом, и
  // абсолютный блок с одновременными top И bottom схлопывается по высоте.
  timeWheelPopoverDown: { top: 32 },
  // Если снизу не хватает места (см. useFlipDirection) — открываем вверх:
  // тот же попап, но растёт от нижнего края якоря вместо верхнего.
  timeWheelPopoverUp: { bottom: 32 },
  timeWheelColumn: { width: 88, maxHeight: 224 },
  timeWheelCell: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  timeWheelCellActive: { backgroundColor: '#E02D2D' },
  timeWheelCellText: { fontFamily: 'Gramatika-Regular', fontSize: 18, color: '#010101' },
  timeWheelCellTextDisabled: { color: '#D0D0D0' },
  timeWheelCellTextActive: { color: '#fff', fontWeight: 'bold' },

  // Свой календарь — см. DateWheelPicker. Тот же приём попапа, что у времени.
  dateWheelPopover: {
    position: 'absolute', left: 0, zIndex: 30, width: 280,
    borderWidth: 1, borderColor: '#E5E5E5', backgroundColor: '#fff', padding: 12,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  dateWheelPopoverDown: { top: 32 },
  dateWheelPopoverUp: { bottom: 32 },
  dateWheelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  dateWheelNav: { fontSize: 20, lineHeight: 22, color: '#010101', paddingHorizontal: 8 },
  dateWheelHeaderText: { fontFamily: 'Gramatika-Regular', fontSize: 18, color: '#010101' },
  dateWheelWeekRow: { flexDirection: 'row', marginBottom: 4 },
  dateWheelWeekday: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: 'Gramatika-Regular', fontSize: 18, color: '#9B9B9B' },
  dateWheelGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dateWheelCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dateWheelCellActive: { backgroundColor: '#E02D2D' },
  dateWheelCellText: { fontFamily: 'Gramatika-Regular', fontSize: 18, color: '#010101' },
  dateWheelCellTextDisabled: { color: '#D0D0D0' },
  dateWheelCellTextActive: { color: '#fff', fontWeight: 'bold' },

  // Кнопка "Выбрать" внутри попапа (и у даты, и у времени) — подтверждает и
  // закрывает именно этот попап; отдельно от кнопки "Добавить слот", которая
  // сабмитит слот целиком, когда оба поля (дата и время) уже заполнены.
  wheelConfirmBtn: { backgroundColor: '#010101', paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  wheelConfirmBtnText: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 14, color: '#fff' },

  fieldInputWrap: { position: 'relative', marginBottom: 16 },
  errorText: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#E02D2D', marginTop: 4, marginBottom: 12 },
  successText: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#1E7E34', marginTop: 12 },
  primaryButton: { backgroundColor: '#010101', paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  primaryButtonText: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 18, color: '#FFFFFF' },
});
