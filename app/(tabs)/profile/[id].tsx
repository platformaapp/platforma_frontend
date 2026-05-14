import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { endpoints } from '@/constants/env';
import { AuthError } from '@/lib/api/auth-error';
import { getTutorProfile, getTutorSlots } from '@/lib/api/tutor';
import { getStudentProfile } from '@/lib/api/student';
import { clearAuth, extractRefreshTokenFromResponse, extractTokenFromResponse, getAuthRole, getAuthToken, getRefreshToken, getUserProfile, saveAuthToken, UserProfile } from '@/lib/auth';
import { toDisplayDate } from '@/lib/slots-utils';

export default function ProfileByIdScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [role, setRole] = useState<'student' | 'tutor'>('student');
  const [isSwitching, setIsSwitching] = useState(false);
  const [userProfile, setUserProfile] = useState<{ full_name?: string; email?: string; bio?: string; avatar_url?: string } | null>(null);
  const [tutorAvatarUrl, setTutorAvatarUrl] = useState<string | null>(null);
  const [tutorHourlyRate, setTutorHourlyRate] = useState<number | null>(null);
  const [tutorShortBio, setTutorShortBio] = useState<string>('');
  const [slots, setSlots] = useState<{ date: string; time: string }[]>([]);
  const [isShareVisible, setShareVisible] = useState(false);
  const [isShareCopied, setShareCopied] = useState(false);
  const [isInviteVisible, setInviteVisible] = useState(false);
  const [isInviteCopied, setInviteCopied] = useState(false);
  const [isBecomeTutorVisible, setBecomeTutorVisible] = useState(false);
  const [hasTutorProfile, setHasTutorProfile] = useState<boolean | null>(null);
  const [tutorApplicationStatus, setTutorApplicationStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);

  // Inline tutor registration form state
  const [tutorRegPassword, setTutorRegPassword] = useState('');
  const [tutorRegErrors, setTutorRegErrors] = useState<{ password?: string; general?: string }>({});
  const [isTutorRegSubmitting, setIsTutorRegSubmitting] = useState(false);
  const [tutorRegSuccess, setTutorRegSuccess] = useState(false);

  const profileUrl = `https://platformaapp.ru/explore/${id ?? ''}`;
  const platformUrl = 'https://platformaapp.ru';

  const handleCopyProfileLink = async () => {
    await Clipboard.setStringAsync(profileUrl);
    setShareCopied(true);
  };

  useFocusEffect(
    useCallback(() => {
      if (role !== 'tutor') return;
      const nowTs = Date.now();
      getTutorSlots()
        .then((s) => {
          const upcoming = s.filter((x) => {
            try {
              return new Date(`${x.date}T${x.time}:00`).getTime() > nowTs;
            } catch {
              return true;
            }
          });
          setSlots(upcoming.map((x) => ({ date: toDisplayDate(x.date), time: x.time.slice(0, 5) })));
        })
        .catch((e) => {
          if (e instanceof AuthError || e?.name === 'AuthError') {
            router.replace('/login');
            return;
          }
          setSlots([]);
        });
    }, [role, router])
  );

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const token = await getAuthToken();
      if (!token) { router.replace('/login'); return; }

      const [storedRole, storedProfile] = await Promise.all([getAuthRole(), getUserProfile()]);
      const effectiveRole = storedRole === 'tutor' ? 'tutor' : 'student';

      if (isMounted) {
        setRole(effectiveRole);
        if (storedProfile) setUserProfile(storedProfile);
      }

      if (effectiveRole === 'student') {
        // Try to detect if user already has a tutor profile (may work if backend allows cross-role GET)
        getTutorProfile()
          .then((tp) => {
            if (!isMounted) return;
            setHasTutorProfile(true);
            const avatar = tp.avatarUrl ?? tp.avatar_url ?? null;
            if (avatar) setTutorAvatarUrl(avatar);
          })
          .catch(() => {
            if (isMounted) setHasTutorProfile(false);
          });

        // Fetch fresh data from server to get avatar and up-to-date name/email
        try {
          const sp = await getStudentProfile();
          if (!isMounted) return;

          const merged: UserProfile = {
            id: String((sp as any).id ?? storedProfile?.id ?? ''),
            email: sp.email ?? storedProfile?.email,
            full_name: sp.full_name ?? (sp as any).fullName ?? (sp as any).name ?? storedProfile?.full_name,
            phone: sp.phone ?? storedProfile?.phone,
            avatar_url: (sp as any).avatar_url ?? (sp as any).avatarUrl ?? storedProfile?.avatar_url,
            bio: storedProfile?.bio,
            role: 'student',
          };

          setUserProfile(merged);

          // Persist to SecureStore so next load is instant
          if (merged.id && token) {
            await saveAuthToken(token, 'student', undefined, merged);
          }
        } catch {
          // Server fetch failed — storedProfile was already set above (or null, nothing to show)
        }
      } else {
        // Tutor: safe to call getTutorProfile() — 401 here means token expired (correct)
        try {
          const tp = await getTutorProfile();
          if (isMounted) {
            setHasTutorProfile(true);
            const avatar = tp.avatarUrl ?? tp.avatar_url ?? null;
            if (avatar) setTutorAvatarUrl(avatar);
            const rate = (tp as any).hourlyRate ?? (tp as any).hourly_rate ?? (tp as any).pricePerHour ?? null;
            if (typeof rate === 'number' && rate > 0) setTutorHourlyRate(rate);
            const sb = (tp as any).shortBio ?? (tp as any).short_bio ?? '';
            if (sb) setTutorShortBio(sb);
            const appStatus = tp.applicationStatus ?? tp.application_status ?? null;
            if (appStatus) setTutorApplicationStatus(appStatus);
          }
        } catch {
          if (isMounted) setHasTutorProfile(false);
        }
      }
    };
    load();
    return () => { isMounted = false; };
  }, [router]);

  // Switch role only for users who already have both roles
  const handleSwitchRole = async (nextRole: 'student' | 'tutor') => {
    if (isSwitching || nextRole === role) return;
    const token = await getAuthToken();
    if (!token) { router.replace('/login'); return; }
    setIsSwitching(true);
    try {
      const refreshToken = await getRefreshToken();
      const body: Record<string, unknown> = { role: nextRole };
      if (refreshToken) { body.refreshToken = refreshToken; body.refresh_token = refreshToken; }

      const response = await fetch(endpoints.switchRole, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await response.json() : await response.text();

      if (response.status === 401 || response.status === 403) {
        const msg = typeof payload === 'object' ? String(payload?.message ?? '') : '';
        const msgLower = msg.toLowerCase();
        if (nextRole === 'tutor') {
          if (msgLower.includes('already registered') || msgLower.includes('уже зарегистрирован')) {
            // User has a tutor profile but token can't switch — update UI state
            setHasTutorProfile(true);
            Alert.alert(
              'Аккаунт наставника уже существует',
              'Выйдите из аккаунта и войдите снова, чтобы переключить роль.',
              [{ text: 'ОК' }]
            );
          } else if (msgLower.includes('tutor') || msgLower.includes('role')) {
            // User doesn't have tutor profile yet
            setHasTutorProfile(false);
            setBecomeTutorVisible(true);
          } else {
            Alert.alert('Сессия истекла', 'Войдите снова.', [
              { text: 'Войти', onPress: () => router.replace('/login') },
            ]);
          }
          return;
        }
        Alert.alert('Сессия истекла', 'Войдите снова.', [
          { text: 'Войти', onPress: () => router.replace('/login') },
        ]);
        return;
      }

      if (!response.ok) {
        const message = typeof payload === 'string' ? payload : payload?.message || 'Не удалось сменить роль';
        throw new Error(message);
      }

      const newToken = extractTokenFromResponse(payload) || token;
      const newRefreshToken = extractRefreshTokenFromResponse(payload) || refreshToken || undefined;
      await saveAuthToken(newToken, nextRole, newRefreshToken);
      setRole(nextRole);

      if (nextRole === 'tutor') {
        try {
          const tp = await getTutorProfile();
          const avatar = tp.avatarUrl ?? tp.avatar_url ?? null;
          if (avatar) setTutorAvatarUrl(avatar);
          const rate = (tp as any).hourlyRate ?? (tp as any).hourly_rate ?? (tp as any).pricePerHour ?? null;
          if (typeof rate === 'number' && rate > 0) setTutorHourlyRate(rate);
          setHasTutorProfile(true);
        } catch {}
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось сменить роль');
    } finally {
      setIsSwitching(false);
    }
  };

  // Inline tutor registration — POST /api/auth/register with role: tutor
  const handleBecomeTutor = async () => {
    const newErrors: typeof tutorRegErrors = {};
    if (tutorRegPassword.length < 7) {
      newErrors.password = 'Пароль слишком короткий!';
    }
    if (Object.keys(newErrors).length > 0) {
      setTutorRegErrors(newErrors);
      return;
    }

    setIsTutorRegSubmitting(true);
    try {
      const storedPhone = (userProfile as any)?.phone ?? '';
      const requestBody: Record<string, string> = {
        email: userProfile?.email ?? '',
        password: tutorRegPassword,
        fullName: userProfile?.full_name ?? '',
        role: 'tutor',
        bio: '',
      };
      if (storedPhone) requestBody.phone = normalizePhoneRU(storedPhone);
      if (userProfile?.avatar_url) requestBody.avatarUrl = userProfile.avatar_url;

      const res = await fetch(endpoints.register, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.message ?? data?.error ?? `Ошибка (${res.status})`;
        setTutorRegErrors({ general: Array.isArray(msg) ? msg.join(', ') : String(msg) });
        return;
      }

      const token = extractTokenFromResponse(data);
      const refreshToken = extractRefreshTokenFromResponse(data);
      if (token) await saveAuthToken(token, 'tutor', refreshToken);

      if (userProfile?.avatar_url) setTutorAvatarUrl(userProfile.avatar_url);
      setHasTutorProfile(true);
      setTutorApplicationStatus('pending');
      // Show success message inside the modal — user closes it manually
      setTutorRegSuccess(true);
      setTutorRegErrors({});
    } catch (e: any) {
      setTutorRegErrors({ general: e?.message ?? 'Ошибка соединения' });
    } finally {
      setIsTutorRegSubmitting(false);
    }
  };

  const openBecomeTutor = () => {
    setTutorRegPassword('');
    setTutorRegErrors({});
    setBecomeTutorVisible(true);
  };

  const displayName = userProfile?.full_name ?? '';
  const displayRole = role === 'tutor' ? tutorShortBio : undefined;
  const studentAvatarUrl = userProfile?.avatar_url ?? null;

  const renderStudentContent = () => (
    <>
      <View style={styles.profileCard}>
        <View style={styles.profileImageWrapper}>
          <Image
            source={studentAvatarUrl ? { uri: studentAvatarUrl } : require('@/assets/images/avatar.png')}
            style={styles.profileImage}
          />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{displayName}</Text>
          {userProfile?.email ? <Text style={styles.profileRole}>{userProfile.email}</Text> : null}
        </View>
      </View>

      <View style={styles.actionsCard}>
        <Pressable
          style={[styles.actionButton, styles.actionButtonFirst]}
          onPress={() => router.push('/(tabs)/profile/edit-profile')}
        >
          <Text style={styles.actionText}>Изменить личные данные</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={() => router.push('/(tabs)/profile/payments')}>
          <Text style={styles.actionText}>Платежи</Text>
        </Pressable>
      </View>

      <Pressable style={styles.studentInviteCard} onPress={() => { setInviteCopied(false); setInviteVisible(true); }}>
        <View style={styles.studentInviteContent}>
          <Text style={styles.studentInviteText}>
            Отправьте товарищу ссылку на платформу и ходите на мастер-классы вместе
          </Text>
        </View>
        <View style={styles.inviteIconBox}>
          <Svg width="25" height="25" viewBox="0 0 25 25" fill="none">
            <Path d="M16.0961 11.2467H19.7603V22.203H5.10352V11.2467H8.76772M12.4319 2.66064L17.0381 7.26684M12.4319 2.66064L7.82569 7.26684M12.4319 2.66064V15.9086" stroke="#181818"/>
          </Svg>
        </View>
      </Pressable>

      <Modal transparent animationType="slide" visible={isInviteVisible} onRequestClose={() => setInviteVisible(false)}>
        <Pressable style={styles.shareModalOverlay} onPress={() => setInviteVisible(false)}>
          <Pressable style={styles.shareModalSheet} onPress={() => {}}>
            <Text style={styles.shareModalTitle}>Поделиться платформой</Text>
            <View style={styles.shareModalCard}>
              <Text style={styles.shareModalUrl} numberOfLines={2}>{platformUrl}</Text>
            </View>
            {isInviteCopied ? <Text style={styles.shareCopiedText}>Ссылка скопирована</Text> : null}
            <Pressable style={styles.shareModalButton} onPress={async () => { await Clipboard.setStringAsync(platformUrl); setInviteCopied(true); }}>
              <Text style={styles.shareModalButtonText}>{isInviteCopied ? 'Ссылка скопирована' : 'Скопировать ссылку'}</Text>
            </Pressable>
            <Pressable style={styles.shareModalClose} onPress={() => setInviteVisible(false)}>
              <Text style={styles.shareModalCloseText}>Закрыть</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Стать наставником — только если нет профиля наставника */}
      {hasTutorProfile === false && (
        <Pressable style={styles.becomeTutorCard} onPress={openBecomeTutor}>
          <View style={styles.becomeTutorContent}>
            <Text style={styles.becomeTutorTitle}>Стать наставником</Text>
            <Text style={styles.becomeTutorSubtitle}>Проводите мастер-классы и личные встречи на платформе</Text>
          </View>
          <View style={styles.becomeTutorArrow}>
            <Text style={styles.becomeTutorArrowText}>›</Text>
          </View>
        </Pressable>
      )}

      {/* Inline tutor registration modal */}
      <Modal transparent animationType="fade" visible={isBecomeTutorVisible} onRequestClose={() => { if (!isTutorRegSubmitting) { setBecomeTutorVisible(false); setTutorRegSuccess(false); } }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
          <Pressable style={styles.shareModalOverlay} onPress={() => { if (!isTutorRegSubmitting) { setBecomeTutorVisible(false); setTutorRegSuccess(false); } }}>
            <Pressable style={styles.shareModalSheet} onPress={() => {}}>
              {tutorRegSuccess ? (
                <>
                  <Text style={styles.shareModalTitle}>Заявка отправлена</Text>
                  <View style={styles.appStatusBanner}>
                    <Text style={styles.appStatusBannerText}>
                      Ваша заявка отправлена, ожидайте подтверждения администратора
                    </Text>
                  </View>
                  <Pressable
                    style={styles.shareModalButton}
                    onPress={() => { setBecomeTutorVisible(false); setTutorRegSuccess(false); }}
                  >
                    <Text style={styles.shareModalButtonText}>Закрыть</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.shareModalTitle}>Стать наставником</Text>

                  <View style={styles.tutorRegInfo}>
                    {userProfile?.full_name ? <Text style={styles.tutorRegInfoText}>{userProfile.full_name}</Text> : null}
                    {userProfile?.email ? <Text style={styles.tutorRegInfoText}>{userProfile.email}</Text> : null}
                    {(userProfile as any)?.phone ? <Text style={styles.tutorRegInfoText}>{formatPhoneRU((userProfile as any).phone.replace(/\D/g, ''))}</Text> : null}
                  </View>

                  <TextInput
                    placeholder="Текущий пароль"
                    value={tutorRegPassword}
                    onChangeText={(text) => {
                      setTutorRegPassword(text);
                      if (tutorRegErrors.password) setTutorRegErrors((e) => ({ ...e, password: undefined }));
                    }}
                    secureTextEntry
                    style={[styles.tutorRegInput, tutorRegErrors.password && styles.tutorRegInputError]}
                    placeholderTextColor={tutorRegErrors.password ? '#E02D2D' : '#888'}
                  />
                  {tutorRegErrors.password ? <Text style={styles.tutorRegErrorText}>{tutorRegErrors.password}</Text> : null}
                  {tutorRegErrors.general ? <Text style={styles.tutorRegErrorText}>{tutorRegErrors.general}</Text> : null}

                  <Pressable
                    style={[styles.shareModalButton, isTutorRegSubmitting && { opacity: 0.6 }]}
                    disabled={isTutorRegSubmitting}
                    onPress={handleBecomeTutor}
                  >
                    <Text style={styles.shareModalButtonText}>
                      {isTutorRegSubmitting ? 'Отправка...' : 'Отправить заявку'}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.shareModalClose}
                    onPress={() => { if (!isTutorRegSubmitting) setBecomeTutorVisible(false); }}
                  >
                    <Text style={styles.shareModalCloseText}>Отмена</Text>
                  </Pressable>
                </>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Pressable style={styles.logoutButton} onPress={async () => { await clearAuth(); router.replace('/login'); }}>
        <Text style={styles.logoutButtonText}>Выйти из аккаунта</Text>
      </Pressable>
    </>
  );

  const APP_STATUS_LABEL: Record<string, string> = {
    pending: 'Заявка на рассмотрении — ожидайте подтверждения администратора',
    rejected: 'Заявка отклонена — свяжитесь с поддержкой для уточнения причины',
  };
  const APP_STATUS_COLOR: Record<string, string> = {
    pending: '#856404', rejected: '#721c24',
  };
  const APP_STATUS_BG: Record<string, string> = {
    pending: '#FFF3CD', rejected: '#F8D7DA',
  };

  const renderTutorContent = () => (
    <>
      {tutorApplicationStatus && tutorApplicationStatus !== 'approved' && (
        <View style={[styles.appStatusBanner, { backgroundColor: APP_STATUS_BG[tutorApplicationStatus] ?? '#FFF3CD' }]}>
          <Text style={[styles.appStatusBannerText, { color: APP_STATUS_COLOR[tutorApplicationStatus] ?? '#856404' }]}>
            {APP_STATUS_LABEL[tutorApplicationStatus] ?? tutorApplicationStatus}
          </Text>
        </View>
      )}
      <View style={styles.profileCard}>
        <View style={styles.profileImageWrapper}>
          <Image
            source={tutorAvatarUrl ? { uri: tutorAvatarUrl } : require('@/assets/images/avatar.png')}
            style={styles.profileImage}
          />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{displayName}</Text>
          {displayRole ? <Text style={styles.profileRole}>{displayRole}</Text> : null}
          {tutorHourlyRate ? (
            <Text style={styles.profileRate}>{tutorHourlyRate.toLocaleString('ru-RU')} ₽ / час</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.actionsCard}>
        <Pressable
          style={[styles.actionButton, styles.actionButtonFirst]}
          onPress={() => router.push('/(tabs)/profile/edit-profile')}
        >
          <Text style={styles.actionText}>Изменить личные данные</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={() => router.push('/(tabs)/profile/tutor-payments')}>
          <Text style={styles.actionText}>Платежи</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.actionPrimary]}
          onPress={() => router.push('/(tabs)/profile/new-event')}
        >
          <Text style={[styles.actionText, styles.actionPrimaryText]}>Создать событие</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Свободные слоты</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slotsRow}>
        {slots.map((slot, index) => (
          <View key={`${slot.date}-${slot.time}-${index}`} style={styles.slotCard}>
            <Text style={styles.slotText}>{`${slot.date}\n${slot.time}`}</Text>
          </View>
        ))}
      </ScrollView>

      <Pressable style={styles.secondaryButton} onPress={() => router.push('/(tabs)/profile/slots')}>
        <Text style={styles.secondaryButtonText}>Все слоты</Text>
      </Pressable>
      <Pressable style={styles.primaryButton} onPress={() => router.push('/(tabs)/profile/add-slot')}>
        <Text style={styles.primaryButtonText}>Добавить слот</Text>
      </Pressable>

      <Pressable style={styles.inviteCard} onPress={() => { setShareCopied(false); setShareVisible(true); }}>
        <View style={styles.inviteContent}>
          <Text style={styles.inviteTitle}>Инвайт</Text>
          <Text style={styles.inviteSubtitle}>Отправьте ссылку на ваш профиль</Text>
        </View>
        <View style={styles.inviteIconBox}>
          <Svg width="22" height="22" viewBox="0 0 25 25" fill="none">
            <Path d="M16.0961 11.2467H19.7603V22.203H5.10352V11.2467H8.76772M12.4319 2.66064L17.0381 7.26684M12.4319 2.66064L7.82569 7.26684M12.4319 2.66064V15.9086" stroke="#181818"/>
          </Svg>
        </View>
      </Pressable>

      <Modal transparent animationType="slide" visible={isShareVisible} onRequestClose={() => setShareVisible(false)}>
        <Pressable style={styles.shareModalOverlay} onPress={() => setShareVisible(false)}>
          <Pressable style={styles.shareModalSheet} onPress={() => {}}>
            <Text style={styles.shareModalTitle}>Поделиться профилем</Text>
            <View style={styles.shareModalCard}>
              <Text style={styles.shareModalUrl} numberOfLines={2}>{profileUrl}</Text>
            </View>
            <Pressable style={styles.shareModalButton} onPress={handleCopyProfileLink}>
              <Text style={styles.shareModalButtonText}>{isShareCopied ? 'Ссылка скопирована' : 'Скопировать ссылку'}</Text>
            </Pressable>
            <Pressable style={styles.shareModalClose} onPress={() => setShareVisible(false)}>
              <Text style={styles.shareModalCloseText}>Закрыть</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Pressable style={styles.logoutButton} onPress={async () => { await clearAuth(); router.replace('/login'); }}>
        <Text style={styles.logoutButtonText}>Выйти из аккаунта</Text>
      </Pressable>
    </>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      {/* Role switch tabs — only when user has both roles */}
      {hasTutorProfile === true && role !== 'tutor' && (
        <View style={styles.roleSwitch}>
          <Pressable
            style={[styles.roleButton, role === 'student' && styles.roleButtonActive]}
            onPress={() => handleSwitchRole('student')}
            disabled={isSwitching}
          >
            <Text style={[styles.roleButtonText, role === 'student' && styles.roleButtonTextActive]}>Ученик</Text>
          </Pressable>
          <Pressable
            style={[styles.roleButton, role === 'tutor' && styles.roleButtonActive]}
            onPress={() => handleSwitchRole('tutor')}
            disabled={isSwitching}
          >
            <Text style={[styles.roleButtonText, role === 'tutor' && styles.roleButtonTextActive]}>Наставник</Text>
          </Pressable>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {role === 'student' ? renderStudentContent() : renderTutorContent()}
      </ScrollView>
    </View>
  );
}

function formatPhoneRU(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';
  let value = digits;
  if (value.startsWith('8')) value = '7' + value.slice(1);
  if (!value.startsWith('7')) value = '7' + value;
  value = value.slice(0, 11);
  const parts = [value.slice(0, 1), value.slice(1, 4), value.slice(4, 7), value.slice(7, 9), value.slice(9, 11)];
  let out = '+' + parts[0];
  if (parts[1]) out += ' (' + parts[1] + ')';
  if (parts[2]) out += ' ' + parts[2];
  if (parts[3]) out += '-' + parts[3];
  if (parts[4]) out += '-' + parts[4];
  return out;
}

function normalizePhoneRU(input: string): string {
  const digits = input.replace(/\D/g, '');
  let value = digits;
  if (value.startsWith('8')) value = '7' + value.slice(1);
  if (!value.startsWith('7')) value = '7' + value;
  return '+' + value.slice(0, 11);
}

function isValidPhoneRU(input: string): boolean {
  const digits = input.replace(/\D/g, '');
  const norm = digits.startsWith('8') ? '7' + digits.slice(1) : digits.startsWith('7') ? digits : '7' + digits;
  return norm.length === 11;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 16 },
  roleSwitch: { flexDirection: 'row', borderWidth: 1, borderColor: '#1E1E1E', marginBottom: 16 },
  roleButton: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  roleButtonActive: { backgroundColor: '#111' },
  roleButtonText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },
  roleButtonTextActive: { color: '#FAFAFA' },
  studentInviteCard: { borderWidth: 1, borderColor: '#1E1E1E', flexDirection: 'row', marginBottom: 24 },
  studentInviteContent: { flex: 1, paddingHorizontal: 12, paddingVertical: 12 },
  studentInviteText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },
  profileCard: { borderWidth: 1, borderColor: '#1E1E1E', flexDirection: 'row', marginBottom: 16 },
  profileImageWrapper: { width: 96, height: 96, borderRightWidth: 1, borderColor: '#1E1E1E' },
  profileImage: { width: '100%', height: '100%', backgroundColor: '#E5E5E5' },
  profileInfo: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  profileName: { fontSize: 18, lineHeight: 24, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 4 },
  profileRole: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },
  profileRate: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginTop: 4 },
  actionsCard: { borderWidth: 1, borderColor: '#1E1E1E', marginBottom: 24 },
  actionButton: { paddingVertical: 14, alignItems: 'center', borderTopWidth: 1, borderColor: '#1E1E1E' },
  actionButtonFirst: { borderTopWidth: 0 },
  actionText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },
  actionPrimary: { backgroundColor: '#111' },
  actionPrimaryText: { color: '#FAFAFA' },
  sectionTitle: { fontSize: 20, lineHeight: 28, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 12 },
  slotsRow: { gap: 12, paddingBottom: 16 },
  slotCard: { width: 76, height: 64, borderWidth: 1, borderColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  slotText: { fontSize: 14, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#181818', textAlign: 'center' },
  secondaryButton: { borderWidth: 1, borderColor: '#1E1E1E', paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  secondaryButtonText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },
  primaryButton: { backgroundColor: '#111', borderWidth: 1, borderColor: '#111', paddingVertical: 14, alignItems: 'center', marginBottom: 24 },
  primaryButtonText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#FAFAFA' },
  inviteCard: { borderWidth: 1, borderColor: '#1E1E1E', flexDirection: 'row' },
  inviteContent: { flex: 1, paddingHorizontal: 12, paddingVertical: 12 },
  inviteTitle: { fontSize: 18, lineHeight: 24, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 4 },
  inviteSubtitle: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },
  inviteIconBox: { width: 64, borderLeftWidth: 1, borderColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center' },
  shareModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  shareModalSheet: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 },
  shareModalTitle: { marginTop: 0, marginBottom: 8, fontFamily: 'Inter-Regular', fontWeight: '700', fontSize: 28, textTransform: 'uppercase', lineHeight: 36, letterSpacing: -1, color: '#181818' },
  shareModalCard: { borderWidth: 1, borderColor: '#1E1E1E', backgroundColor: '#fff' },
  shareModalUrl: { paddingHorizontal: 16, paddingVertical: 16, fontSize: 16, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#1E1E1E' },
  shareModalButton: { marginTop: 16, backgroundColor: '#1E1E1E', paddingVertical: 14, alignItems: 'center' },
  shareModalButtonText: { fontSize: 16, fontFamily: 'Inter-Regular', color: '#fff' },
  shareCopiedText: { marginTop: 4, fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, color: '#181818' },
  shareModalClose: { marginTop: 12, height: 52, width: '100%', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1E1E1E' },
  shareModalCloseText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },
  logoutButton: { marginTop: 24, marginBottom: 32, borderWidth: 1, borderColor: '#E02D2D', paddingVertical: 14, alignItems: 'center' },
  logoutButtonText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#E02D2D' },
  becomeTutorCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#1E1E1E', marginTop: 16, backgroundColor: '#F8F8F8' },
  becomeTutorContent: { flex: 1, paddingHorizontal: 16, paddingVertical: 14 },
  becomeTutorTitle: { fontSize: 15, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 4 },
  becomeTutorSubtitle: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  becomeTutorArrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  becomeTutorArrowText: { fontSize: 26, color: '#181818', marginTop: -2 },
  tutorRegInfo: { borderWidth: 1, borderColor: '#E5E5E5', padding: 12, marginBottom: 12, backgroundColor: '#F8F8F8' },
  tutorRegInfoText: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  tutorRegInput: { borderWidth: 1, borderColor: '#1E1E1E', paddingVertical: 14, paddingHorizontal: 12, marginBottom: 4, fontFamily: 'Inter-Regular', fontSize: 14, color: '#181818' },
  tutorRegInputError: { borderColor: '#E02D2D', color: '#E02D2D' },
  tutorRegErrorText: { fontFamily: 'Inter-Regular', fontSize: 12, color: '#E02D2D', marginBottom: 6 },
  appStatusBanner: { backgroundColor: '#FFF3CD', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 },
  appStatusBannerText: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#856404' },
});
