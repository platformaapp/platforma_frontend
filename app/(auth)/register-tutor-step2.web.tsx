import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Circle, Path, Svg } from 'react-native-svg';

import { PlusField } from '@/components/web/plus-field';
import { SiteShell } from '@/components/web/site-shell';
import { TOPICS } from '@/constants/topics';
import { uploadEventImage } from '@/lib/api/events';
import { updateTutorProfile } from '@/lib/api/tutor';

const SHORT_BIO_LIMIT = 70;
const ABOUT_LIMIT = 400;

/**
 * Веб-версия регистрации наставника, шаг 2. В отличие от нативной версии
 * (register-tutor-step2.tsx), здесь данные реально уходят на бэкенд через
 * PUT /tutor/profile — в нативной версии это была заглушка (setTimeout),
 * собранные поля никуда не отправлялись. Нативную не трогаем (вне
 * текущей задачи — только веб), но стоит знать про этот разрыв.
 */
export default function RegisterTutorStep2ScreenWeb() {
  const router = useRouter();
  const [shortBio, setShortBio] = useState('');
  const [about, setAbout] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [groupMeetings, setGroupMeetings] = useState('');
  const [specialization, setSpecialization] = useState<string | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rateValue = hourlyRate ? parseInt(hourlyRate) || 0 : 0;

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
  }

  async function onSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      let avatarUrl: string | undefined;
      if (avatarUri) avatarUrl = await uploadEventImage(avatarUri);

      await updateTutorProfile({
        shortBio: shortBio.trim() || undefined,
        bio: about.trim() || undefined,
        hourlyRate: rateValue > 0 ? rateValue : undefined,
        groupMeetings: groupMeetings.trim() || undefined,
        specialization: specialization ?? undefined,
        avatarUrl,
      });

      router.replace('/tutor-application-sent');
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось отправить заявку');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SiteShell>
      {/* Modal (не обычный View с flex:1) — гарантированно перекрывает всю
          страницу независимо от окружающего flex-контекста, см. cookie-banner. */}
      <Modal transparent animationType="fade" visible onRequestClose={() => router.back()}>
      <View style={[styles.page, { pointerEvents: 'box-none' }]}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Регистрация наставника</Text>
            <Pressable onPress={() => router.back()}><Text style={styles.close}>✕</Text></Pressable>
          </View>

          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            <PlusField
              label="Короткое био"
              hint="(например, фотограф The Blueprint)"
              value={shortBio}
              onChangeText={(t) => t.length <= SHORT_BIO_LIMIT && setShortBio(t)}
              multiline
            />

            <PlusField
              label="О себе в свободной форме"
              value={about}
              onChangeText={(t) => t.length <= ABOUT_LIMIT && setAbout(t)}
              multiline
            />

            <PlusField label="Стоимость часа" value={hourlyRate} onChangeText={setHourlyRate} keyboardType="numeric" />
            {rateValue > 0 ? <Text style={styles.hint}>Комиссия 10% — вы получите {Math.round(rateValue * 0.9)} ₽</Text> : null}

            <PlusField label="Собираете ли вы групповые встречи? Как часто?" value={groupMeetings} onChangeText={setGroupMeetings} multiline />

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Специализация</Text>
              <View style={styles.topicsRow}>
                {TOPICS.map((t) => {
                  const active = t === specialization;
                  return (
                    <Pressable key={t} onPress={() => setSpecialization(active ? null : t)}>
                      <Text style={[styles.topicPillText, active && styles.topicPillTextActive]}>{t}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Фото</Text>
              {avatarUri ? (
                <Pressable style={styles.uploadWithPhoto} onPress={pickImage}>
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                  <Text style={styles.replacePhotoText}>Заменить фото</Text>
                </Pressable>
              ) : (
                <Pressable onPress={pickImage} hitSlop={8} style={styles.plusButton}>
                  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <Circle cx="12" cy="12" r="10" stroke="#010101" strokeWidth="1" />
                    <Path d="M12 7.5V16.5M7.5 12H16.5" stroke="#010101" strokeWidth="1" strokeLinecap="round" />
                  </Svg>
                </Pressable>
              )}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.footerRow}>
            <Pressable onPress={() => router.back()}><Text style={styles.cancelLink}>Назад</Text></Pressable>
            <Pressable onPress={onSubmit} disabled={isSubmitting}>
              <Text style={styles.nextLink}>{isSubmitting ? 'Отправляем…' : 'Отправить заявку'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
      </Modal>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 16 },
  card: { width: '100%', maxWidth: 520, maxHeight: '85%', backgroundColor: '#fff', padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 40, lineHeight: 36, color: '#010101' },
  close: { fontSize: 20, color: '#010101' },
  scroll: { flexGrow: 0 },
  fieldWrap: { marginBottom: 24 },
  fieldLabel: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#010101', marginBottom: 8 },
  topicsRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 8 },
  topicPillText: { fontFamily: 'Gramatika-Regular', fontSize: 14, color: '#838383' },
  topicPillTextActive: { color: '#010101', fontFamily: 'Gramatika-Regular', fontWeight: 'normal' },
  hint: { fontFamily: 'Gramatika-Regular', fontSize: 12, lineHeight: 16, color: '#687076', marginTop: -16, marginBottom: 16 },
  plusButton: { paddingVertical: 2, alignSelf: 'flex-start' },
  uploadWithPhoto: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, backgroundColor: '#E5E5E5' },
  replacePhotoText: { fontFamily: 'Gramatika-Regular', fontSize: 14, color: '#010101' },
  errorText: { fontFamily: 'Gramatika-Regular', fontSize: 13, color: '#E02D2D', marginTop: 4 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  cancelLink: { fontFamily: 'Gramatika-Regular', fontSize: 14, color: '#687076' },
  nextLink: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 15, color: '#E02D2D' },
});
