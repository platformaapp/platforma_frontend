import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { SiteShell } from '@/components/web/site-shell';
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
      <View style={styles.page}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Регистрация наставника</Text>
            <Pressable onPress={() => router.back()}><Text style={styles.close}>✕</Text></Pressable>
          </View>

          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Короткое био <Text style={styles.fieldHintInline}>(например, фотограф The Blueprint)</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={shortBio}
              onChangeText={(t) => t.length <= SHORT_BIO_LIMIT && setShortBio(t)}
              multiline
            />

            <Text style={styles.fieldLabel}>О себе в свободной форме</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={about}
              onChangeText={(t) => t.length <= ABOUT_LIMIT && setAbout(t)}
              multiline
            />

            <Text style={styles.fieldLabel}>Стоимость часа</Text>
            <TextInput style={styles.input} value={hourlyRate} onChangeText={setHourlyRate} keyboardType="numeric" />
            {rateValue > 0 ? <Text style={styles.hint}>Комиссия 10% — вы получите {Math.round(rateValue * 0.9)} ₽</Text> : null}

            <Text style={styles.fieldLabel}>Собираете ли вы групповые встречи? Как часто?</Text>
            <TextInput style={[styles.input, styles.textArea]} value={groupMeetings} onChangeText={setGroupMeetings} multiline />

            <Text style={styles.fieldLabel}>Фото</Text>
            <Pressable style={[styles.upload, avatarUri && styles.uploadWithPhotoContainer]} onPress={pickImage}>
              {avatarUri ? (
                <View style={styles.uploadWithPhoto}>
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                  <Text style={styles.replacePhotoText}>Заменить фото</Text>
                </View>
              ) : (
                <Text style={styles.uploadButtonText}>Загрузить фото</Text>
              )}
            </Pressable>

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
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 16 },
  card: { width: '100%', maxWidth: 520, maxHeight: '85%', backgroundColor: '#fff', padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title: { fontFamily: 'Inter-Bold', fontSize: 22, color: '#181818' },
  close: { fontSize: 20, color: '#181818' },
  scroll: { flexGrow: 0 },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 6 },
  fieldHintInline: { color: '#9B9B9B' },
  input: { borderWidth: 1, borderColor: '#181818', paddingVertical: 12, paddingHorizontal: 12, marginBottom: 16, fontFamily: 'Inter-Regular', fontSize: 14, color: '#181818' },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  hint: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 16, color: '#687076', marginTop: -12, marginBottom: 16 },
  upload: { borderWidth: 1, borderColor: '#181818', paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12, minHeight: 48 },
  uploadWithPhotoContainer: { paddingVertical: 0, paddingHorizontal: 0 },
  uploadWithPhoto: { flexDirection: 'row', width: '100%', alignItems: 'center', paddingHorizontal: 12, gap: 12 },
  uploadButtonText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#181818' },
  avatar: { width: 40, height: 40, backgroundColor: '#f0f0f0' },
  replacePhotoText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#181818' },
  errorText: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#E02D2D', marginTop: 4 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  cancelLink: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#687076' },
  nextLink: { fontFamily: 'Inter-Medium', fontSize: 15, color: '#E02D2D' },
});
