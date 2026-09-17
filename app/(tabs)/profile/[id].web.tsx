import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { MOBILE_BREAKPOINT, SiteShell } from '@/components/web/site-shell';
import { SiteFooter } from '@/components/web/site-footer';
import { uploadEventImage } from '@/lib/api/events';
import { deletePaymentMethod, getPaymentMethods, type Card } from '@/lib/api/student-payments';
import { changePassword, getStudentProfile, updateStudentProfile } from '@/lib/api/student';
import { createTutorEventFull, createTutorSlot, deleteTutorSlot, getTutorProfile, getTutorSlots, updateTutorProfile, type Slot } from '@/lib/api/tutor';
import { getAuthRole, getAuthToken, getUserProfile } from '@/lib/auth';

function EyeIcon() {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <Path d="M2 12C3.7 7.6 7.5 5 12 5C16.5 5 20.3 7.6 22 12C20.3 16.4 16.5 19 12 19C7.5 19 3.7 16.4 2 12Z" stroke="#181818" strokeWidth="1.5" />
      <Circle cx="12" cy="12" r="3" stroke="#181818" strokeWidth="1.5" />
    </Svg>
  );
}

/** Группирует слоты по дате (для отображения "13 мая: 14:00 15:00 20:00"), сортируя даты и время. */
function groupSlotsByDate(slots: Slot[]): { date: string; slots: Slot[] }[] {
  const map = new Map<string, Slot[]>();
  for (const s of slots) {
    const arr = map.get(s.date) ?? [];
    arr.push(s);
    map.set(s.date, arr);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, daySlots]) => ({ date, slots: [...daySlots].sort((a, b) => a.time.localeCompare(b.time)) }));
}

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
  const [avatarUrl, setAvatarUrl] = useState('');

  const [slots, setSlots] = useState<Slot[]>([]);
  const [newSlotDate, setNewSlotDate] = useState('');
  const [newSlotTime, setNewSlotTime] = useState('');
  const [slotsModalVisible, setSlotsModalVisible] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  // ── Tutor-only modals ───────────────────────────────────────────────────────
  const [tutorEditModalVisible, setTutorEditModalVisible] = useState(false);
  const [newEventModalVisible, setNewEventModalVisible] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventPrice, setEventPrice] = useState('');
  const [eventMax, setEventMax] = useState('');
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

  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showNew2, setShowNew2] = useState(false);
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
          setTelegram(tp.telegram ?? '');
          const rate = tp.hourlyRate ?? tp.hourly_rate ?? tp.pricePerHour;
          if (typeof rate === 'number') setHourlyRate(String(rate));
          setAvatarUrl(tp.avatarUrl ?? tp.avatar_url ?? '');
          const nowTs = Date.now();
          setSlots(tutorSlots.filter((s) => new Date(`${s.date}T${s.time}:00`).getTime() > nowTs));
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
    try {
      setPaymentCards(await getPaymentMethods());
    } catch {
      setPaymentCards([]);
    } finally {
      setPaymentsLoading(false);
    }
  }

  async function handleDeleteCard(card: Card) {
    setDeletingCardId(card.id);
    try {
      await deletePaymentMethod(card.id);
      setPaymentCards((prev) => prev.filter((c) => c.id !== card.id));
    } catch { /* keep card in list, user can retry */ }
    finally {
      setDeletingCardId(null);
    }
  }

  function goToPaymentsPage() {
    setPaymentsModalVisible(false);
    router.push('/(tabs)/profile/payments' as any);
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
              <ActivityIndicator color="#181818" />
            ) : paymentCards.length === 0 ? (
              <Text style={styles.emptyText}>Карта не привязана</Text>
            ) : (
              paymentCards.map((card) => (
                <View key={card.id} style={styles.paymentCardBlock}>
                  <Text style={styles.paymentCardLabel}>Карта</Text>
                  <Text style={styles.paymentCardNumber}>{card.cardMasked ?? card.card_masked ?? '****'}</Text>
                  {(card.cardType ?? card.provider) ? <Text style={styles.paymentCardBank}>{card.cardType ?? card.provider}</Text> : null}
                  <View style={styles.paymentActionsRow}>
                    <Pressable onPress={goToPaymentsPage}>
                      <Text style={styles.paymentHistoryLink}>История платежей</Text>
                    </Pressable>
                    <View style={styles.paymentRightActions}>
                      <Pressable onPress={() => handleDeleteCard(card)} disabled={deletingCardId === card.id}>
                        <Text style={styles.paymentCardDelete}>{deletingCardId === card.id ? '…' : 'Удалить'}</Text>
                      </Pressable>
                      <Pressable onPress={goToPaymentsPage}>
                        <Text style={styles.paymentCardEdit}>Изменить</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))
            )}
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
      });
      setTutorSaveOk(true);
      setTutorEditModalVisible(false);
    } catch (e: any) {
      setTutorSaveError(e?.message ?? 'Не удалось сохранить');
    } finally {
      setTutorSaving(false);
    }
  }

  async function handleAddSlot() {
    if (!newSlotDate || !newSlotTime) return;
    try {
      const slot = await createTutorSlot({ date: newSlotDate, time: newSlotTime });
      setSlots((prev) => [...prev, slot]);
      setNewSlotDate('');
      setNewSlotTime('');
    } catch { /* keep form values so the user can retry */ }
  }

  async function handleRemoveSlot(id: string) {
    try {
      await deleteTutorSlot(id);
      setSlots((prev) => prev.filter((s) => s.id !== id));
    } catch { /* ignore — slot stays in list, user can retry */ }
  }

  async function handleCreateEvent() {
    setCreatingEvent(true);
    setEventError('');
    try {
      let coverUrl: string | undefined;
      if (eventCoverUri) coverUrl = await uploadEventImage(eventCoverUri);
      await createTutorEventFull({
        title: eventTitle, description: eventDescription, date: eventDate, time: eventTime,
        price: eventPrice ? Number(eventPrice) : 0, max_participants: eventMax ? Number(eventMax) : 0, cover_image: coverUrl,
      });
      setEventCreated(true);
      setEventTitle(''); setEventDescription(''); setEventDate(''); setEventTime(''); setEventPrice(''); setEventMax(''); setEventCoverUri(null);
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
    return <SiteShell><View style={styles.centered}><ActivityIndicator size="large" color="#181818" /></View></SiteShell>;
  }

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
          <Pressable style={styles.backButton} onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile' as any))} hitSlop={8}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>

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
              <FieldWithPlus label="Телеграм" value={telegram} onChangeText={setTelegram} autoCapitalize="none" />
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
                    <Text style={styles.backArrow}>←</Text>
                  </Pressable>
                  <Text style={styles.modalTitle}>Новый пароль</Text>
                </View>
                <Pressable onPress={() => setPasswordModalVisible(false)}><Text style={styles.backArrow}>✕</Text></Pressable>
              </View>
              <Text style={styles.fieldLabel}>Старый пароль</Text>
              <PasswordField value={oldPassword} onChangeText={setOldPassword} visible={showOld} onToggle={() => setShowOld((v) => !v)} />
              <Text style={styles.fieldLabel}>Новый пароль</Text>
              <PasswordField value={newPassword} onChangeText={setNewPassword} visible={showNew} onToggle={() => setShowNew((v) => !v)} />
              <Text style={styles.fieldLabel}>Повторите новый пароль</Text>
              <PasswordField value={newPassword2} onChangeText={setNewPassword2} visible={showNew2} onToggle={() => setShowNew2((v) => !v)} />
              <Text style={styles.hint}>Пароль должен быть не меньше 7 символов и состоять из букв, цифр и прописных символов</Text>
              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
              <Pressable style={[styles.modalSaveLink, passwordSaving && styles.btnDisabled]} onPress={handleSavePassword} disabled={passwordSaving}>
                <Text style={styles.modalSaveText}>{passwordSaving ? 'Сохраняем…' : 'Сохранить'}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {renderPaymentsModal()}
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
        <Pressable style={styles.backButton} onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile' as any))} hitSlop={8}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>

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
        <Pressable style={[styles.addSlotButton, isMobile && styles.mobileChip]} onPress={() => { setSelectedSlotId(null); setSlotsModalVisible(true); }}>
          <Text style={[styles.addSlotLink, isMobile && styles.mobileChipText]}>Добавить слот</Text>
        </Pressable>

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
              <FieldWithPlus label="Телеграм" value={telegram} onChangeText={setTelegram} autoCapitalize="none" />
              <FieldWithPlus label="Доп. информация" value={bio} onChangeText={setBio} multiline style={styles.inputMultiline} />
              <FieldWithPlus label="Стоимость часа" value={hourlyRate} onChangeText={setHourlyRate} keyboardType="numeric" />
              {hourlyRate && Number(hourlyRate) > 0 ? (
                <Text style={styles.hint}>Комиссия 10% — вы получите {Math.round(Number(hourlyRate) * 0.9)} ₽</Text>
              ) : null}
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
                <Text style={styles.backArrow}>←</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Новый пароль</Text>
            </View>
            <PasswordField placeholder="Старый пароль" value={oldPassword} onChangeText={setOldPassword} visible={showOld} onToggle={() => setShowOld((v) => !v)} />
            <PasswordField placeholder="Новый пароль" value={newPassword} onChangeText={setNewPassword} visible={showNew} onToggle={() => setShowNew((v) => !v)} />
            <PasswordField placeholder="Повторите пароль" value={newPassword2} onChangeText={setNewPassword2} visible={showNew2} onToggle={() => setShowNew2((v) => !v)} />
            <Text style={styles.hint}>Пароль должен быть не меньше 7 символов и состоять из букв, цифр и спецсимволов</Text>
            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            <Pressable style={[styles.primaryButton, passwordSaving && styles.btnDisabled]} onPress={handleSavePassword} disabled={passwordSaving}>
              <Text style={styles.primaryButtonText}>{passwordSaving ? 'Сохраняем…' : 'Сохранить'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {renderPaymentsModal()}

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
              <FieldWithPlus label="Описание" value={eventDescription} onChangeText={setEventDescription} multiline style={styles.inputMultiline} />
              <FieldWithPlus label="Дата" value={eventDate} onChangeText={setEventDate} />
              <FieldWithPlus label="Время" value={eventTime} onChangeText={setEventTime} />
              <FieldWithPlus label="Стоимость участия" value={eventPrice} onChangeText={setEventPrice} keyboardType="numeric" />
              <FieldWithPlus label="Максимальное количество участников" value={eventMax} onChangeText={setEventMax} keyboardType="numeric" />
              <Text style={styles.fieldLabel}>Обложка</Text>
              <Pressable style={styles.fieldInputWrap} onPress={handlePickCover}>
                {eventCoverUri ? <Image source={{ uri: eventCoverUri }} style={styles.avatarThumb} /> : <Text style={styles.plusIcon}>⊕</Text>}
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

      <Modal transparent animationType="fade" visible={slotsModalVisible} onRequestClose={() => setSlotsModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setSlotsModalVisible(false)}>
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
                      const selected = selectedSlotId === s.id;
                      return (
                        <View key={s.id} style={styles.slotTimeWrap}>
                          <Pressable onPress={() => setSelectedSlotId(selected ? null : s.id)}>
                            <Text style={[styles.slotTimeText, selected && styles.slotTimeTextSelected]}>{s.time.slice(0, 5)}</Text>
                          </Pressable>
                          {selected ? (
                            <Pressable onPress={() => { handleRemoveSlot(s.id); setSelectedSlotId(null); }} hitSlop={6}>
                              <Text style={styles.slotRemoveIcon}>⊖</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      );
                    })}
                    <Pressable style={styles.slotAddChip} onPress={() => setNewSlotDate(group.date)}>
                      <Text style={styles.slotAddChipText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>

            <FieldWithPlus label="Дата" value={newSlotDate} onChangeText={setNewSlotDate} />
            <FieldWithPlus label="Время" value={newSlotTime} onChangeText={setNewSlotTime} />

            <View style={styles.modalFooterRow}>
              <Pressable onPress={() => setSlotsModalVisible(false)}><Text style={styles.modalCancelText}>Отменить</Text></Pressable>
              <Pressable onPress={handleAddSlot}><Text style={styles.modalSaveText}>Сохранить</Text></Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SiteShell>
  );
}

function PasswordField({ visible, onToggle, ...props }: any) {
  return (
    <View style={styles.passwordFieldWrap}>
      <TextInput style={styles.input} secureTextEntry={!visible} {...props} />
      <Pressable style={styles.eyeButton} onPress={onToggle}><EyeIcon /></Pressable>
    </View>
  );
}

/**
 * Поле без рамки: пустое значение показывает "⊕" вместо пустого поля ввода
 * (см. "Добавить событие"/"Изменение данных" в макете) — сам TextInput
 * всегда под курсором, "⊕" — просто декоративная подсказка поверх него.
 */
function FieldWithPlus({ label, value, style, ...props }: { label: string; value: string; style?: any } & Omit<React.ComponentProps<typeof TextInput>, 'style' | 'value'>) {
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldInputWrap}>
        <TextInput style={[styles.borderlessInput, style]} value={value} {...props} />
        {!value ? <Text style={styles.plusIcon} pointerEvents="none">⊕</Text> : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 48 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },

  // Student view
  backButton: { alignSelf: 'flex-start', marginBottom: 16 },
  bigAvatar: { width: '100%', aspectRatio: 1, backgroundColor: '#E5E5E5' },
  bigAvatarPlaceholder: { backgroundColor: '#E5E5E5' },
  studentName: { fontSize: 28, lineHeight: 34, fontFamily: 'Inter-Bold', color: '#181818' },
  profileDesktopLayout: { flexDirection: 'row', gap: 48, alignItems: 'flex-start' },
  profileLeftCol: { flexBasis: 520, flexGrow: 1, flexShrink: 1 },
  profileRightCol: { flexBasis: 360, flexShrink: 0, maxWidth: 400 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, marginTop: 16 },
  actionLink: { fontFamily: 'Inter-Medium', fontSize: 15, color: '#E02D2D' },
  avatarMobile: { width: 90, height: 90, backgroundColor: '#E5E5E5', marginVertical: 16 },
  actionsRowMobile: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  chipHalf: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#F0F5FB', paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  chipHalfText: { fontFamily: 'Inter-Medium', fontSize: 14, color: '#68717A' },
  // Filled light-blue button used for action chips on mobile widths (see mobile mockups).
  mobileChip: { backgroundColor: '#F0F5FB', borderWidth: 0, minWidth: 0, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  mobileChipText: { color: '#68717A', fontSize: 15 },

  // Modals (shared)
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: '#fff', width: '100%', maxWidth: 420, padding: 24 },
  modalTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#181818', marginBottom: 20 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  modalHeaderRowSpread: { justifyContent: 'space-between' },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  passwordDots: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818', paddingVertical: 10 },
  modalSaveLink: { alignSelf: 'flex-end', marginTop: 12 },
  backArrow: { fontSize: 20, color: '#181818' },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatarThumb: { width: 44, height: 44, backgroundColor: '#E5E5E5' },
  avatarThumbPlaceholder: { backgroundColor: '#E5E5E5' },
  passwordFieldWrap: { position: 'relative', justifyContent: 'center' },
  eyeButton: { position: 'absolute', right: 10 },
  hint: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginTop: -4, marginBottom: 12 },
  paymentCardBlock: { paddingVertical: 16, borderTopWidth: 1, borderColor: '#E5E5E5' },
  paymentCardLabel: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  paymentCardNumber: { fontSize: 15, fontFamily: 'Inter-Medium', color: '#181818', marginTop: 2 },
  paymentCardBank: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginTop: 2 },
  paymentActionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  paymentHistoryLink: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#181818' },
  paymentRightActions: { flexDirection: 'row', gap: 20 },
  paymentCardDelete: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#E02D2D' },
  paymentCardEdit: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#181818' },

  // Slots modal ("Редактировать слоты для записи")
  slotsModalCard: { maxWidth: 640 },
  slotsModalScroll: { maxHeight: 320, marginBottom: 12 },
  modalFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  modalCancelText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#687076' },
  modalSaveText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#E02D2D' },

  // Tutor tabbed view (unchanged)
  tabsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginBottom: 24, borderBottomWidth: 1, borderColor: '#E5E5E5', paddingBottom: 12 },
  tabText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#687076' },
  tabTextActive: { color: '#181818', fontFamily: 'Inter-Medium' },
  card: { borderWidth: 1, borderColor: '#E5E5E5', padding: 24, maxWidth: 560 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E5E5E5', marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginTop: 12 },
  fieldValue: { fontSize: 15, fontFamily: 'Inter-Regular', color: '#181818' },
  bioText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818', marginTop: 16 },
  tutorShortBio: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#687076', marginTop: 6 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter-Medium', color: '#181818', marginTop: 24, marginBottom: 8 },
  emptyText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#687076' },
  slotDateGroup: { marginBottom: 12 },
  slotDateLabel: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#181818', marginBottom: 4 },
  slotTimesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center' },
  slotTimeWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  slotTimeText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  slotTimeTextSelected: { color: '#E02D2D' },
  slotRemoveIcon: { fontSize: 15, color: '#E02D2D' },
  addSlotButton: { alignSelf: 'flex-start', marginTop: 8 },
  addSlotLink: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#E02D2D' },
  slotAddChip: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: '#181818', alignItems: 'center', justifyContent: 'center' },
  slotAddChipText: { fontSize: 14, lineHeight: 16, fontFamily: 'Inter-Regular', color: '#181818' },
  input: { borderWidth: 1, borderColor: '#181818', paddingVertical: 10, paddingHorizontal: 12, marginTop: 4, marginBottom: 8, fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  fieldInputWrap: { position: 'relative', marginBottom: 16 },
  // borderWidth:0 обязателен явно — иначе <textarea> (многострочный TextInput
  // в RN Web) показывает браузерную рамку по умолчанию.
  borderlessInput: { borderWidth: 0, padding: 0, fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818', minHeight: 20 },
  plusIcon: { position: 'absolute', top: 0, left: 0, fontSize: 18, color: '#181818' },
  errorText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#E02D2D', marginTop: 4, marginBottom: 12 },
  successText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#1E7E34', marginTop: 12 },
  primaryButton: { backgroundColor: '#181818', paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  primaryButtonText: { fontFamily: 'Inter-Medium', fontSize: 14, color: '#FFFFFF' },
});
