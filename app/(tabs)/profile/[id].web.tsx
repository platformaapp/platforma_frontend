import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { SiteShell } from '@/components/web/site-shell';
import { uploadEventImage } from '@/lib/api/events';
import { changeStudentPassword, getStudentProfile, updateStudentProfile } from '@/lib/api/student';
import { createTutorEventFull, createTutorSlot, deleteTutorSlot, getTutorProfile, getTutorSlots, updateTutorProfile, type Slot } from '@/lib/api/tutor';
import { getAuthRole, getAuthToken, getUserProfile } from '@/lib/auth';

type TutorTab = 'profile' | 'edit' | 'payments' | 'new-event';
type StudentModal = 'none' | 'edit' | 'password' | 'invite';

function CloseIcon() {
  return (
    <Svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <Path d="M2 2L18 18M18 2L2 18" stroke="#181818" strokeWidth="1.4" />
    </Svg>
  );
}

function BackIcon() {
  return (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <Path d="M15 18L9 12L15 6" stroke="#181818" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ShareIcon() {
  return (
    <Svg width="22" height="22" viewBox="0 0 25 25" fill="none">
      <Path d="M16.0961 11.2467H19.7603V22.203H5.10352V11.2467H8.76772M12.4319 2.66064L17.0381 7.26684M12.4319 2.66064L7.82569 7.26684M12.4319 2.66064V15.9086" stroke="#181818" />
    </Svg>
  );
}

function PasswordField({
  placeholder,
  value,
  onChangeText,
}: {
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.passwordFieldWrap}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#9B9B9B"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
      />
      <Pressable style={styles.eyeButton} onPress={() => setVisible((v) => !v)}>
        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <Path d="M2 12C3.7 7.6 7.5 5 12 5C16.5 5 20.3 7.6 22 12C20.3 16.4 16.5 19 12 19C7.5 19 3.7 16.4 2 12Z" stroke="#181818" strokeWidth="1.5" />
          <Circle cx="12" cy="12" r="3" stroke="#181818" strokeWidth="1.5" />
        </Svg>
      </Pressable>
    </View>
  );
}

/**
 * Веб-версия личного кабинета. Для ученика оформлена по макету "Личный
 * кабинет ученика": фото + имя, справа кнопки "Изменить личные данные" /
 * "Платежи", блок приглашения под фото. Изменение данных, смена пароля и
 * приглашение — попапы (см. StudentModal), а не отдельные страницы.
 *
 * Смена пароля в макете — форма "старый/новый пароль" прямо в попапе, но
 * такого эндпоинта в бэкенде нет (только сброс по ссылке на почту, как в
 * native new-password.tsx). changeStudentPassword() бросает ошибку с
 * code === 'NOT_IMPLEMENTED' на 404/405 — попап показывает это и
 * предлагает запасной вариант со ссылкой на почту.
 */
export default function ProfileScreenWeb() {
  const router = useRouter();
  const [role, setRole] = useState<'student' | 'tutor'>('student');
  const [tutorTab, setTutorTab] = useState<TutorTab>('profile');
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [telegram, setTelegram] = useState('');
  const [bio, setBio] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [slots, setSlots] = useState<Slot[]>([]);
  const [newSlotDate, setNewSlotDate] = useState('');
  const [newSlotTime, setNewSlotTime] = useState('');

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

  // Student cabinet popups
  const [modal, setModal] = useState<StudentModal>('none');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordUnsupported, setPasswordUnsupported] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const inviteLink = `https://platformaapp.ru/explore/${profileId}`;

  useEffect(() => {
    let active = true;
    (async () => {
      const token = await getAuthToken();
      if (!token) { router.replace('/login' as any); return; }
      const [authRole, profile] = await Promise.all([getAuthRole(), getUserProfile()]);
      const effectiveRole = authRole === 'tutor' ? 'tutor' : 'student';
      if (!active) return;
      setRole(effectiveRole);
      if (profile?.id) setProfileId(profile.id);

      try {
        if (effectiveRole === 'tutor') {
          const [tp, tutorSlots] = await Promise.all([getTutorProfile(), getTutorSlots()]);
          if (!active) return;
          setFullName(tp.fullName ?? tp.full_name ?? profile?.full_name ?? '');
          setEmail(tp.email ?? profile?.email ?? '');
          setBio(tp.bio ?? '');
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

  function openEditModal() {
    setSaveError('');
    setModal('edit');
  }

  function openPasswordModal() {
    setOldPassword('');
    setNewPassword('');
    setRepeatPassword('');
    setPasswordError('');
    setPasswordUnsupported(false);
    setPasswordSaved(false);
    setModal('password');
  }

  function openInviteModal() {
    setLinkCopied(false);
    setModal('invite');
  }

  function closeModal() {
    setModal('none');
  }

  async function handleSaveProfile() {
    setSaving(true);
    setSaveError('');
    try {
      if (role === 'tutor') {
        await updateTutorProfile({
          fullName,
          bio,
          avatarUrl: avatarUrl || undefined,
          hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
        });
      } else {
        const payload: Record<string, string> = { fullName, full_name: fullName };
        if (telegram.trim()) payload.telegram = telegram.trim().replace(/^@/, '');
        if (avatarUrl) { payload.avatarUrl = avatarUrl; payload.avatar_url = avatarUrl; }
        await updateStudentProfile(payload);
      }
      closeModal();
    } catch (e: any) {
      setSaveError(e?.message ?? 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePassword() {
    setPasswordError('');
    setPasswordUnsupported(false);
    if (newPassword.length < 7) {
      setPasswordError('Пароль должен быть не меньше 7 символов');
      return;
    }
    if (newPassword !== repeatPassword) {
      setPasswordError('Пароли не совпадают');
      return;
    }
    setPasswordSaving(true);
    try {
      await changeStudentPassword(oldPassword, newPassword);
      setPasswordSaved(true);
    } catch (e: any) {
      if (e?.code === 'NOT_IMPLEMENTED') {
        setPasswordUnsupported(true);
      } else {
        setPasswordError(e?.message ?? 'Не удалось сменить пароль');
      }
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleCopyInviteLink() {
    await Clipboard.setStringAsync(inviteLink);
    setLinkCopied(true);
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
        title: eventTitle,
        description: eventDescription,
        date: eventDate,
        time: eventTime,
        price: eventPrice ? Number(eventPrice) : 0,
        max_participants: eventMax ? Number(eventMax) : 0,
        cover_image: coverUrl,
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

  if (role === 'student') {
    return (
      <SiteShell>
        <ScrollView contentContainerStyle={styles.studentScroll}>
          <View style={styles.studentTopRow}>
            <View style={styles.studentPhotoCol}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.studentPhoto} />
              ) : (
                <Image source={require('@/assets/images/avatar.png')} style={styles.studentPhoto} />
              )}
            </View>
            <Text style={styles.studentName}>{fullName || 'Профиль'}</Text>
            <View style={styles.studentActionsBox}>
              <Pressable style={styles.studentActionButton} onPress={openEditModal}>
                <Text style={styles.studentActionText}>Изменить личные данные</Text>
              </Pressable>
              <Pressable style={[styles.studentActionButton, styles.studentActionButtonLast]} onPress={() => router.push('/(tabs)/profile/payments' as any)}>
                <Text style={styles.studentActionText}>Платежи</Text>
              </Pressable>
            </View>
          </View>

          <Pressable style={styles.inviteCard} onPress={openInviteModal}>
            <Text style={styles.inviteCardText}>
              Отправьте товарищу ссылку на платформу{'\n'}и ходите на мастер-классы вместе
            </Text>
            <View style={styles.inviteCardIcon}>
              <ShareIcon />
            </View>
          </Pressable>
        </ScrollView>

        {/* Изменение данных */}
        <Modal transparent animationType="fade" visible={modal === 'edit'} onRequestClose={closeModal}>
          <Pressable style={styles.overlay} onPress={closeModal}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Pressable style={styles.modalClose} onPress={closeModal}><CloseIcon /></Pressable>
              <Text style={styles.modalTitle}>ИЗМЕНЕНИЕ ДАННЫХ</Text>

              <TextInput style={styles.input} placeholder="Имя" placeholderTextColor="#9B9B9B" value={fullName} onChangeText={setFullName} />
              <TextInput style={styles.input} placeholder="Почта" placeholderTextColor="#9B9B9B" value={email} editable={false} />
              <TextInput
                style={styles.input}
                placeholder="Телеграм: @username"
                placeholderTextColor="#9B9B9B"
                value={telegram}
                onChangeText={(t) => setTelegram(t.replace(/^@/, ''))}
                autoCapitalize="none"
              />

              <Pressable style={styles.replacePhotoButton} onPress={handlePickAvatar}>
                {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.replacePhotoThumb} /> : null}
                <Text style={styles.replacePhotoText}>Заменить фото</Text>
              </Pressable>

              <Pressable style={styles.secondaryButton} onPress={openPasswordModal}>
                <Text style={styles.secondaryButtonText}>Изменить пароль</Text>
              </Pressable>

              {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

              <Pressable style={[styles.primaryButton, saving && styles.btnDisabled]} onPress={handleSaveProfile} disabled={saving}>
                <Text style={styles.primaryButtonText}>{saving ? 'Сохраняем…' : 'Сохранить изменения'}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Новый пароль */}
        <Modal transparent animationType="fade" visible={modal === 'password'} onRequestClose={closeModal}>
          <Pressable style={styles.overlay} onPress={closeModal}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Pressable style={styles.modalBack} onPress={() => setModal('edit')}><BackIcon /></Pressable>
              <Pressable style={styles.modalClose} onPress={closeModal}><CloseIcon /></Pressable>
              <Text style={[styles.modalTitle, styles.modalTitleCentered]}>НОВЫЙ ПАРОЛЬ</Text>

              {passwordSaved ? (
                <Text style={styles.successText}>Пароль изменён</Text>
              ) : passwordUnsupported ? (
                <>
                  <Text style={styles.errorText}>
                    Смена пароля по старому паролю пока недоступна на сервере.
                  </Text>
                  <Pressable style={styles.secondaryButton} onPress={() => router.push('/(tabs)/profile/new-password' as any)}>
                    <Text style={styles.secondaryButtonText}>Отправить ссылку на почту</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <PasswordField placeholder="Старый пароль" value={oldPassword} onChangeText={setOldPassword} />
                  <PasswordField placeholder="Новый пароль" value={newPassword} onChangeText={setNewPassword} />
                  <PasswordField placeholder="Повторите пароль" value={repeatPassword} onChangeText={setRepeatPassword} />
                  <Text style={styles.helperText}>
                    Пароль должен быть не меньше 7 символов и состоять из букв, цифр и прикольных символов
                  </Text>
                  {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
                </>
              )}

              <Pressable
                style={[styles.primaryButton, passwordSaving && styles.btnDisabled]}
                onPress={passwordSaved ? closeModal : handleSavePassword}
                disabled={passwordSaving}
              >
                <Text style={styles.primaryButtonText}>
                  {passwordSaved ? 'Закрыть' : passwordSaving ? 'Сохраняем…' : 'Сохранить'}
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Пригласить на платформу */}
        <Modal transparent animationType="fade" visible={modal === 'invite'} onRequestClose={closeModal}>
          <Pressable style={styles.overlay} onPress={closeModal}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Pressable style={styles.modalClose} onPress={closeModal}><CloseIcon /></Pressable>
              <Text style={styles.modalTitle}>ПРИГЛАСИТЬ{'\n'}НА ПЛАТФОРМУ</Text>

              <View style={styles.inviteLinkBox}>
                <Text style={styles.inviteLinkText} numberOfLines={1}>{inviteLink}</Text>
              </View>
              <Pressable style={styles.primaryButton} onPress={handleCopyInviteLink}>
                <Text style={styles.primaryButtonText}>{linkCopied ? 'Ссылка скопирована' : 'Скопировать ссылку'}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </SiteShell>
    );
  }

  // ── Наставник: прежний интерфейс с вкладками ──────────────────────────────
  const tabs: { key: TutorTab; label: string }[] = [
    { key: 'profile', label: 'Профиль' },
    { key: 'edit', label: 'Изменить личные данные' },
    { key: 'new-event', label: 'Создать событие' },
  ];

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.name}>{fullName || 'Профиль'}</Text>

        <View style={styles.tabsRow}>
          {tabs.map((t) => (
            <Pressable key={t.key} onPress={() => setTutorTab(t.key)}>
              <Text style={[styles.tabText, tutorTab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {tutorTab === 'profile' ? (
          <View style={styles.card}>
            {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatar} /> : null}
            <Text style={styles.fieldLabel}>Имя</Text>
            <Text style={styles.fieldValue}>{fullName}</Text>
            <Text style={styles.fieldLabel}>Почта</Text>
            <Text style={styles.fieldValue}>{email}</Text>
            <Text style={styles.sectionTitle}>Свободные слоты</Text>
            {slots.length === 0 ? <Text style={styles.emptyText}>Слотов пока нет</Text> : slots.map((s) => (
              <View key={s.id} style={styles.slotRow}>
                <Text style={styles.slotText}>{s.date} {s.time.slice(0, 5)}</Text>
                <Pressable onPress={() => handleRemoveSlot(s.id)}><Text style={styles.removeLink}>Удалить</Text></Pressable>
              </View>
            ))}
            <View style={styles.addSlotRow}>
              <TextInput style={styles.slotInput} placeholder="ГГГГ-ММ-ДД" value={newSlotDate} onChangeText={setNewSlotDate} />
              <TextInput style={styles.slotInput} placeholder="ЧЧ:ММ" value={newSlotTime} onChangeText={setNewSlotTime} />
              <Pressable style={styles.smallButton} onPress={handleAddSlot}><Text style={styles.smallButtonText}>Добавить слот</Text></Pressable>
            </View>
          </View>
        ) : null}

        {tutorTab === 'edit' ? (
          <View style={styles.card}>
            <Pressable style={styles.uploadButton} onPress={handlePickAvatar}>
              <Text style={styles.uploadButtonText}>{avatarUrl ? 'Заменить фото' : 'Загрузить фото'}</Text>
            </Pressable>
            <Text style={styles.fieldLabel}>Имя</Text>
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />
            <Text style={styles.fieldLabel}>Описание</Text>
            <TextInput style={[styles.input, styles.inputMultiline]} value={bio} onChangeText={setBio} multiline />
            <Text style={styles.fieldLabel}>Стоимость часа</Text>
            <TextInput style={styles.input} value={hourlyRate} onChangeText={setHourlyRate} keyboardType="numeric" />
            {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
            <Pressable style={[styles.primaryButton, saving && styles.btnDisabled]} onPress={handleSaveProfile} disabled={saving}>
              <Text style={styles.primaryButtonText}>{saving ? 'Сохраняем…' : 'Сохранить'}</Text>
            </Pressable>
            <Pressable style={styles.linkButton} onPress={() => router.push('/(tabs)/profile/new-password' as any)}>
              <Text style={styles.linkButtonText}>Сменить пароль (ссылка на почту)</Text>
            </Pressable>
          </View>
        ) : null}

        {tutorTab === 'new-event' ? (
          <View style={styles.card}>
            {eventCreated ? <Text style={styles.successText}>Событие создано</Text> : null}
            <Text style={styles.fieldLabel}>Название</Text>
            <TextInput style={styles.input} value={eventTitle} onChangeText={setEventTitle} />
            <Text style={styles.fieldLabel}>Описание</Text>
            <TextInput style={[styles.input, styles.inputMultiline]} value={eventDescription} onChangeText={setEventDescription} multiline />
            <Text style={styles.fieldLabel}>Дата (ГГГГ-ММ-ДД)</Text>
            <TextInput style={styles.input} value={eventDate} onChangeText={setEventDate} />
            <Text style={styles.fieldLabel}>Время (ЧЧ:ММ)</Text>
            <TextInput style={styles.input} value={eventTime} onChangeText={setEventTime} />
            <Text style={styles.fieldLabel}>Стоимость участия</Text>
            <TextInput style={styles.input} value={eventPrice} onChangeText={setEventPrice} keyboardType="numeric" />
            <Text style={styles.fieldLabel}>Максимальное количество участников</Text>
            <TextInput style={styles.input} value={eventMax} onChangeText={setEventMax} keyboardType="numeric" />
            <Pressable style={styles.uploadButton} onPress={handlePickCover}>
              <Text style={styles.uploadButtonText}>{eventCoverUri ? 'Обложка выбрана' : 'Загрузить обложку'}</Text>
            </Pressable>
            {eventError ? <Text style={styles.errorText}>{eventError}</Text> : null}
            <Pressable style={[styles.primaryButton, creatingEvent && styles.btnDisabled]} onPress={handleCreateEvent} disabled={creatingEvent}>
              <Text style={styles.primaryButtonText}>{creatingEvent ? 'Создаём…' : 'Сохранить'}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },

  // Student cabinet — matches the desktop "личный кабинет ученика" mockup
  studentScroll: { paddingHorizontal: 32, paddingTop: 40, paddingBottom: 48 },
  studentTopRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
  studentPhotoCol: { width: 288, height: 288, backgroundColor: '#EFEAE0' },
  studentPhoto: { width: '100%', height: '100%' },
  studentName: { flex: 1, fontSize: 40, lineHeight: 46, fontFamily: 'Inter-Regular', color: '#181818', marginLeft: 32, marginTop: 16 },
  studentActionsBox: { width: 260, borderWidth: 1, borderColor: '#181818' },
  studentActionButton: { paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#181818' },
  studentActionButtonLast: { borderBottomWidth: 0 },
  studentActionText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  inviteCard: { maxWidth: 640, borderWidth: 1, borderColor: '#181818', flexDirection: 'row', alignItems: 'stretch' },
  inviteCardText: { flex: 1, paddingHorizontal: 16, paddingVertical: 16, fontSize: 13, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#181818' },
  inviteCardIcon: { width: 72, borderLeftWidth: 1, borderColor: '#181818', alignItems: 'center', justifyContent: 'center' },

  // Popups
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 430, backgroundColor: '#fff', padding: 32, position: 'relative' },
  modalClose: { position: 'absolute', top: 20, right: 20, padding: 4 },
  modalBack: { position: 'absolute', top: 20, left: 20, padding: 4 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter-Medium', color: '#181818', textTransform: 'uppercase', marginBottom: 20, letterSpacing: 0.5 },
  modalTitleCentered: { textAlign: 'center' },

  replacePhotoButton: { borderWidth: 1, borderColor: '#181818', flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 12, minHeight: 48 },
  replacePhotoThumb: { width: 46, height: 46, backgroundColor: '#EFEAE0' },
  replacePhotoText: { flex: 1, textAlign: 'center', fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  secondaryButton: { borderWidth: 1, borderColor: '#181818', paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  secondaryButtonText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  helperText: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginTop: 4, marginBottom: 12 },
  passwordFieldWrap: { position: 'relative', marginBottom: 12 },
  eyeButton: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },

  inviteLinkBox: { borderWidth: 1, borderColor: '#181818', paddingHorizontal: 14, paddingVertical: 14, marginBottom: 0 },
  inviteLinkText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#181818' },

  // Наставник (tabs)
  scrollContent: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 48, maxWidth: 560 },
  name: { fontSize: 24, fontFamily: 'Inter-Bold', color: '#181818', marginBottom: 16 },
  tabsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginBottom: 24, borderBottomWidth: 1, borderColor: '#E5E5E5', paddingBottom: 12 },
  tabText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#687076' },
  tabTextActive: { color: '#181818', fontFamily: 'Inter-Medium' },
  card: { borderWidth: 1, borderColor: '#E5E5E5', padding: 24 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E5E5E5', marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginTop: 12 },
  fieldValue: { fontSize: 15, fontFamily: 'Inter-Regular', color: '#181818' },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter-Medium', color: '#181818', marginTop: 24, marginBottom: 8 },
  emptyText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#687076' },
  slotRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  slotText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  removeLink: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#E02D2D' },
  addSlotRow: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
  slotInput: { borderWidth: 1, borderColor: '#181818', paddingVertical: 8, paddingHorizontal: 10, fontSize: 13, width: 110 },
  smallButton: { borderWidth: 1, borderColor: '#181818', paddingVertical: 8, paddingHorizontal: 12 },
  smallButtonText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#181818' },
  uploadButton: { borderWidth: 1, borderColor: '#181818', paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  uploadButtonText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  input: { borderWidth: 1, borderColor: '#181818', paddingVertical: 12, paddingHorizontal: 12, marginBottom: 12, fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  errorText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#E02D2D', marginBottom: 12 },
  successText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#1E7E34', marginBottom: 16 },
  primaryButton: { backgroundColor: '#181818', paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  primaryButtonText: { fontFamily: 'Inter-Medium', fontSize: 14, color: '#FFFFFF' },
  linkButton: { marginTop: 12, alignItems: 'center' },
  linkButtonText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#687076', textDecorationLine: 'underline' },
});
