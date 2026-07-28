import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { SiteShell } from '@/components/web/site-shell';
import { uploadEventImage } from '@/lib/api/events';
import { deletePaymentMethod, getPaymentMethods, type PaymentMethod } from '@/lib/api/student-payments';
import { getStudentProfile, updateStudentProfile } from '@/lib/api/student';
import { createTutorEventFull, createTutorSlot, deleteTutorSlot, getTutorProfile, getTutorSlots, updateTutorProfile, type Slot } from '@/lib/api/tutor';
import { getAuthRole, getAuthToken, getUserProfile } from '@/lib/auth';

type Tab = 'profile' | 'edit' | 'payments' | 'new-event';

/**
 * Веб-версия личного кабинета (своего профиля). Смена пароля в макете
 * показана как форма "старый/новый пароль" прямо на странице — но такого
 * эндпоинта в бэкенде нет, только сброс по ссылке на почту (как в нативном
 * new-password.tsx). Здесь так же: кнопка отправляет ссылку на почту.
 */
export default function ProfileScreenWeb() {
  const router = useRouter();
  const [role, setRole] = useState<'student' | 'tutor'>('student');
  const [tab, setTab] = useState<Tab>('profile');
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [telegram, setTelegram] = useState('');
  const [bio, setBio] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveOk, setSaveOk] = useState(false);

  const [cards, setCards] = useState<PaymentMethod[]>([]);
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

  const [copied, setCopied] = useState(false);

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
          const paymentCards = await getPaymentMethods().catch(() => [] as PaymentMethod[]);
          if (active) setCards(paymentCards);
        }
      } catch { /* show empty form on failure */ }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [router]);

  async function handleCopyLink() {
    const profile = await getUserProfile();
    await Clipboard.setStringAsync(`https://platformaapp.ru/explore/${profile?.id ?? ''}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    setSaveOk(false);
    try {
      if (role === 'tutor') {
        await updateTutorProfile({
          fullName,
          bio,
          avatarUrl: avatarUrl || undefined,
          hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
        });
      } else {
        await updateStudentProfile({ fullName, avatarUrl: avatarUrl || undefined });
      }
      setSaveOk(true);
    } catch (e: any) {
      setSaveError(e?.message ?? 'Не удалось сохранить');
    } finally {
      setSaving(false);
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

  async function handleDeleteCard(id: string) {
    const w = (globalThis as any).window;
    if (w && !w.confirm('Удалить карту?')) return;
    try {
      await deletePaymentMethod(id);
      setCards((prev) => prev.filter((c) => c.id !== id));
    } catch { /* ignore */ }
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

  const tabs: { key: Tab; label: string }[] = role === 'tutor'
    ? [{ key: 'profile', label: 'Профиль' }, { key: 'edit', label: 'Изменить личные данные' }, { key: 'new-event', label: 'Создать событие' }]
    : [{ key: 'profile', label: 'Профиль' }, { key: 'edit', label: 'Изменить личные данные' }, { key: 'payments', label: 'Платежи' }];

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.name}>{fullName || 'Профиль'}</Text>

        <View style={styles.tabsRow}>
          {tabs.map((t) => (
            <Pressable key={t.key} onPress={() => setTab(t.key)}>
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
          <Pressable onPress={handleCopyLink}><Text style={styles.tabText}>{copied ? 'Ссылка скопирована' : 'Копировать ссылку'}</Text></Pressable>
        </View>

        {tab === 'profile' ? (
          <View style={styles.card}>
            {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatar} /> : null}
            <Text style={styles.fieldLabel}>Имя</Text>
            <Text style={styles.fieldValue}>{fullName}</Text>
            <Text style={styles.fieldLabel}>Почта</Text>
            <Text style={styles.fieldValue}>{email}</Text>
            {role === 'tutor' ? (
              <>
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
              </>
            ) : null}
          </View>
        ) : null}

        {tab === 'edit' ? (
          <View style={styles.card}>
            <Pressable style={styles.uploadButton} onPress={handlePickAvatar}>
              <Text style={styles.uploadButtonText}>{avatarUrl ? 'Заменить фото' : 'Загрузить фото'}</Text>
            </Pressable>
            <Text style={styles.fieldLabel}>Имя</Text>
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />
            {role === 'tutor' ? (
              <>
                <Text style={styles.fieldLabel}>Описание</Text>
                <TextInput style={[styles.input, styles.inputMultiline]} value={bio} onChangeText={setBio} multiline />
                <Text style={styles.fieldLabel}>Стоимость часа</Text>
                <TextInput style={styles.input} value={hourlyRate} onChangeText={setHourlyRate} keyboardType="numeric" />
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>Почта</Text>
                <TextInput style={styles.input} value={email} editable={false} />
                <Text style={styles.fieldLabel}>Телеграм</Text>
                <TextInput style={styles.input} value={telegram} onChangeText={setTelegram} autoCapitalize="none" />
              </>
            )}
            {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
            {saveOk ? <Text style={styles.successText}>Сохранено</Text> : null}
            <Pressable style={[styles.primaryButton, saving && styles.btnDisabled]} onPress={handleSave} disabled={saving}>
              <Text style={styles.primaryButtonText}>{saving ? 'Сохраняем…' : 'Сохранить'}</Text>
            </Pressable>
            <Pressable style={styles.linkButton} onPress={() => router.push('/(tabs)/profile/new-password' as any)}>
              <Text style={styles.linkButtonText}>Сменить пароль (ссылка на почту)</Text>
            </Pressable>
          </View>
        ) : null}

        {tab === 'payments' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Карты</Text>
            {cards.length === 0 ? <Text style={styles.emptyText}>Карты не привязаны</Text> : cards.map((c) => (
              <View key={c.id} style={styles.slotRow}>
                <Text style={styles.slotText}>{c.cardType ?? 'Карта'} *{c.cardMasked}</Text>
                <Pressable onPress={() => handleDeleteCard(c.id)}><Text style={styles.removeLink}>Удалить</Text></Pressable>
              </View>
            ))}
            <Pressable style={styles.primaryButton} onPress={() => router.push('/(tabs)/profile/payments' as any)}>
              <Text style={styles.primaryButtonText}>Привязать карту</Text>
            </Pressable>
          </View>
        ) : null}

        {tab === 'new-event' ? (
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
  scrollContent: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 48, maxWidth: 560 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
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
  input: { borderWidth: 1, borderColor: '#181818', paddingVertical: 10, paddingHorizontal: 12, marginTop: 4, fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  errorText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#E02D2D', marginTop: 12 },
  successText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#1E7E34', marginTop: 12 },
  primaryButton: { backgroundColor: '#181818', paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  btnDisabled: { opacity: 0.6 },
  primaryButtonText: { fontFamily: 'Inter-Medium', fontSize: 14, color: '#FFFFFF' },
  linkButton: { marginTop: 12, alignItems: 'center' },
  linkButtonText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#687076', textDecorationLine: 'underline' },
});
