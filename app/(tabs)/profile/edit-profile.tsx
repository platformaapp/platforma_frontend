import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AuthError } from '@/lib/api/auth-error';
import { uploadEventImage } from '@/lib/api/events';
import { getStudentProfile, updateStudentProfile } from '@/lib/api/student';
import { getTutorProfile, updateTutorProfile } from '@/lib/api/tutor';
import { getAuthRole, getUserProfile, getAuthToken } from '@/lib/auth';

const SHORT_BIO_LIMIT = 70;
const ABOUT_LIMIT = 400;

function pick<T>(obj: T | null | undefined, ...keys: (keyof T)[]): string {
  if (!obj) return '';
  for (const k of keys) {
    const v = (obj as Record<string, unknown>)[k as string];
    if (v != null && typeof v === 'string') return v;
  }
  return '';
}

export default function EditProfileScreen() {
  const router = useRouter();
  const [role, setRole] = useState<'student' | 'tutor' | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [shortBio, setShortBio] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [about, setAbout] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [groupMeetings, setGroupMeetings] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const shortBioRemaining = SHORT_BIO_LIMIT - shortBio.length;
  const aboutRemaining = ABOUT_LIMIT - about.length;
  const isStudent = role === 'student';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const token = await getAuthToken();
      if (!token) { router.replace('/login'); return; }
      const loginProfile = await getUserProfile();
      const currentRole = await getAuthRole();
      if (!cancelled) {
        setRole(currentRole === 'tutor' ? 'tutor' : 'student');
        if (loginProfile?.id) setProfileId(loginProfile.id);
      }

      if (currentRole === 'tutor') {
        if (loginProfile && !cancelled) {
          setFullName(loginProfile.full_name ?? '');
          setEmail(loginProfile.email ?? '');
        }
        try {
          const p = await getTutorProfile();
          if (!cancelled) {
            setFullName((pick(p, 'fullName', 'full_name') || loginProfile?.full_name) ?? '');
            setEmail((pick(p, 'email') || loginProfile?.email) ?? '');
            setTelegram(pick(p, 'phone') ?? '');
            const bio = pick(p, 'bio') ?? '';
            setAbout(bio);
            const sb = pick(p, 'shortBio', 'short_bio') ?? bio.slice(0, SHORT_BIO_LIMIT);
            setShortBio(sb);
            const url = pick(p, 'avatarUrl', 'avatar_url') ?? '';
            setAvatarUrl(url);
            if (url && !url.startsWith('file://')) setAvatarUri(url);
            const rate = (p as Record<string, unknown>).hourlyRate ?? (p as Record<string, unknown>).hourly_rate ?? (p as Record<string, unknown>).pricePerHour;
            if (typeof rate === 'number' && rate > 0) setHourlyRate(String(rate));
            const gm = pick(p, 'groupMeetings', 'group_meetings');
            if (gm) setGroupMeetings(gm);
          }
        } catch (e: unknown) {
          if (!cancelled) {
            if (e instanceof AuthError || (e as { name?: string })?.name === 'AuthError') {
              router.replace('/login');
              return;
            }
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      } else {
        if (loginProfile && !cancelled) {
          setFullName(loginProfile.full_name ?? '');
          setEmail(loginProfile.email ?? '');
          setPhone(loginProfile.phone ?? '');
          const url = loginProfile.avatar_url ?? '';
          if (url) {
            setAvatarUrl(url);
            if (!url.startsWith('file://')) setAvatarUri(url);
          }
        }
        try {
          const p = await getStudentProfile();
          if (!cancelled) {
            setFullName((pick(p, 'fullName', 'full_name') || loginProfile?.full_name) ?? '');
            setEmail((pick(p, 'email') || loginProfile?.email) ?? '');
            setPhone(pick(p, 'phone') ?? loginProfile?.phone ?? '');
            const url = pick(p, 'avatarUrl', 'avatar_url') ?? '';
            if (url) {
              setAvatarUrl(url);
              if (!url.startsWith('file://')) setAvatarUri(url);
            }
          }
        } catch {
          // GET /api/student/profile может не существовать — используем данные из login
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [router]);

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Ошибка', 'Необходимо разрешение на доступ к фотографиям');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      setAvatarUrl(result.assets[0].uri);
    }
  }

  async function handleSave() {
    if (saving) return;
    const currentRole = await getAuthRole();
    setSaving(true);
    try {
      if (currentRole === 'tutor') {
        const bio = about.trim() || shortBio.trim();
        const payload: Record<string, string | number | undefined> = {};
        if (fullName.trim()) payload.fullName = fullName.trim();
        if (email.trim()) payload.email = email.trim();
        if (bio) payload.bio = bio;
        if (shortBio.trim()) payload.shortBio = shortBio.trim();
        if (telegram.trim()) payload.phone = telegram.trim();
        if (avatarUrl) payload.avatarUrl = avatarUrl;
        const rate = hourlyRate ? parseInt(hourlyRate, 10) : 0;
        if (rate > 0) {
          payload.hourlyRate = rate;
          payload.hourly_rate = rate;
        }
        if (groupMeetings.trim()) {
          payload.groupMeetings = groupMeetings.trim();
          payload.group_meetings = groupMeetings.trim();
        }
        await updateTutorProfile(payload);
      } else {
        const payload: Record<string, string> = {};
        if (fullName.trim()) payload.fullName = fullName.trim();
        if (fullName.trim()) payload.full_name = fullName.trim();
        if (email.trim()) payload.email = email.trim();
        if (phone.trim()) payload.phone = phone.trim();
        // If user picked a new local image, upload it first to get a server URL
        let finalAvatarUrl = avatarUrl;
        if (avatarUri && avatarUri.startsWith('file://')) {
          try {
            finalAvatarUrl = await uploadEventImage(avatarUri);
          } catch { /* ignore upload error — save other fields */ }
        }
        if (finalAvatarUrl && !finalAvatarUrl.startsWith('file://')) {
          payload.avatarUrl = finalAvatarUrl;
          payload.avatar_url = finalAvatarUrl;
        }
        await updateStudentProfile(payload);
      }
      if (profileId) {
        router.replace(`/(tabs)/profile/${profileId}`);
      } else {
        router.back();
      }
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (e instanceof AuthError || err?.name === 'AuthError') {
        router.replace('/login');
        return;
      }
      Alert.alert('Ошибка', err?.message ?? 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ThemedText>Загрузка...</ThemedText>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 80, android: 0 })}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => {
              if (profileId) {
                router.replace(`/(tabs)/profile/${profileId}`);
              } else {
                router.back();
              }
            }}
          >
            <MaterialIcons name="chevron-left" size={24} color="#181818" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>ИЗМЕНЕНИЕ ДАННЫХ</Text>

          <Text style={styles.label}>{isStudent ? 'Имя' : 'Имя и фамилия'}</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            style={styles.input}
            placeholder={isStudent ? 'Имя' : 'Имя и фамилия'}
            placeholderTextColor="#9B9B9B"
          />

          <Text style={styles.label}>Почта</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholder="Почта"
            placeholderTextColor="#9B9B9B"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {isStudent && (
            <>
              <Text style={styles.label}>Телефон</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                style={styles.input}
                placeholder="Телефон"
                placeholderTextColor="#9B9B9B"
                keyboardType="phone-pad"
              />
            </>
          )}

          {!isStudent && (
            <>
              <Text style={styles.label}>Короткое био</Text>
              <View style={styles.inputWithCounter}>
                <TextInput
                  value={shortBio}
                  onChangeText={(t) => t.length <= SHORT_BIO_LIMIT && setShortBio(t)}
                  style={[styles.input, styles.textArea]}
                  placeholder="Короткое био (например, фотограф в The Blueprint)"
                  placeholderTextColor="#9B9B9B"
                  multiline
                  numberOfLines={2}
                />
                <View style={styles.counter}>
                  <Text style={[styles.counterText, shortBioRemaining === 0 && styles.counterTextError]}>
                    {shortBioRemaining}
                  </Text>
                </View>
              </View>

              <Text style={styles.label}>Телеграм</Text>
              <TextInput
                value={telegram}
                onChangeText={setTelegram}
                style={styles.input}
                placeholder="Телеграм"
                placeholderTextColor="#9B9B9B"
              />

              <Text style={styles.label}>О себе</Text>
              <View style={styles.inputWithCounter}>
                <TextInput
                  value={about}
                  onChangeText={(t) => t.length <= ABOUT_LIMIT && setAbout(t)}
                  style={[styles.input, styles.textArea]}
                  placeholder="О себе в свободной форме"
                  placeholderTextColor="#9B9B9B"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                <View style={styles.counter}>
                  <Text style={[styles.counterText, aboutRemaining === 0 && styles.counterTextError]}>
                    {aboutRemaining}
                  </Text>
                </View>
              </View>

              <Text style={styles.label}>Стоимость часа</Text>
              <TextInput
                value={hourlyRate}
                onChangeText={(t) => setHourlyRate(t.replace(/\D/g, ''))}
                style={styles.input}
                placeholder="Стоимость часа"
                placeholderTextColor="#9B9B9B"
                keyboardType="numeric"
              />

              <Text style={styles.label}>Собираетесь ли вы проводить групповые встречи</Text>
              <TextInput
                value={groupMeetings}
                onChangeText={setGroupMeetings}
                style={[styles.input, styles.textArea]}
                placeholder="Собираетесь ли вы проводить групповые встречи? Как часто?"
                placeholderTextColor="#9B9B9B"
                multiline
                numberOfLines={3}
              />
            </>
          )}

          <Text style={styles.label}>Заменить фото</Text>
          <Pressable
            style={[styles.upload, avatarUri && styles.uploadWithPhotoContainer]}
            onPress={pickImage}
          >
            {avatarUri ? (
              <View style={styles.uploadWithPhoto}>
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
                <View style={styles.replacePhotoContainer}>
                  <Text style={styles.replacePhotoText}>Заменить фото</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.uploadPlaceholder}>Загрузить фото</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push('/(tabs)/profile/new-password')}
          >
            <Text style={styles.secondaryButtonText}>Изменить пароль</Text>
          </Pressable>

          <Pressable
            style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.primaryButtonText}>
              {saving ? 'Сохранение...' : 'Сохранить изменения'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginBottom: 12,
  },
  inputWithCounter: {
    position: 'relative',
    marginBottom: 12,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
    paddingRight: 50,
    textAlignVertical: 'top',
  },
  counter: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#181818',
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#FFFFFF',
  },
  counterTextError: {
    color: '#E02D2D',
  },
  upload: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 52,
    justifyContent: 'center',
  },
  uploadWithPhotoContainer: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  uploadWithPhoto: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    backgroundColor: '#f0f0f0',
  },
  replacePhotoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 64,
  },
  replacePhotoText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#181818',
  },
  uploadPlaceholder: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#181818',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingVertical: 16,
    alignItems: 'center',
    height: 52,
    marginBottom: 16,
  },
  secondaryButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  primaryButton: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#111',
    paddingVertical: 16,
    alignItems: 'center',
    height: 52,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#FAFAFA',
  },
});
