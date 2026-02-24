import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { endpoints } from '@/constants/env';
import { getTutorSlots } from '@/lib/api/tutor';
import { extractRefreshTokenFromResponse, extractTokenFromResponse, getAuthRole, getAuthToken, getRefreshToken, saveAuthToken } from '@/lib/auth';
import { toDisplayDate } from '@/lib/slots-utils';

export default function ProfileScreen() {
  const router = useRouter();
  const [role, setRole] = useState<'student' | 'tutor'>('student');
  const [isSwitching, setIsSwitching] = useState(false);
  const studentProfile = {
    name: 'Варвара Михайлова',
  };
  const tutorProfile = {
    name: 'Андрей Осетров',
    role: 'Куратор, исследователь визуальной культуры',
  };
  const [slots, setSlots] = useState<{ date: string; time: string }[]>([]);
  const [isShareVisible, setShareVisible] = useState(false);
  const [isShareCopied, setShareCopied] = useState(false);

  const profileUrl = Linking.createURL('/(tabs)/profile');

  const handleCopyProfileLink = async () => {
    await Clipboard.setStringAsync(profileUrl);
    setShareCopied(true);
  };

  useFocusEffect(
    useCallback(() => {
      if (role !== 'tutor') return;
      getTutorSlots()
        .then((s) => setSlots(s.map((x) => ({ date: toDisplayDate(x.date), time: x.time }))))
        .catch(() => setSlots([]));
    }, [role])
  );

  useEffect(() => {
    let isMounted = true;
    const loadRole = async () => {
      const token = await getAuthToken();
      if (!token) {
        router.replace('/login');
        return;
      }
      const storedRole = await getAuthRole();
      if (isMounted && (storedRole === 'student' || storedRole === 'tutor')) {
        setRole(storedRole);
      }
    };
    loadRole();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleSwitchRole = async (nextRole: 'student' | 'tutor') => {
    if (isSwitching || nextRole === role) return;
    const token = await getAuthToken();
    if (!token) {
      Alert.alert('Ошибка', 'Для смены роли нужно войти в аккаунт');
      router.push('/login');
      return;
    }
    setIsSwitching(true);
    try {
      const requestSwitchRole = async (url: string) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role: nextRole }),
        });
        const contentType = response.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');
        const payload = isJson ? await response.json() : await response.text();
        return { response, payload };
      };

      let { response, payload } = await requestSwitchRole(endpoints.switchRole);
      if (!response.ok && (response.status === 404 || response.status === 405)) {
        const retry = await requestSwitchRole(endpoints.switchRoleLegacy);
        response = retry.response;
        payload = retry.payload;
      }

      if (!response.ok) {
        const message = typeof payload === 'string' ? payload : payload?.message || 'Не удалось сменить роль';
        throw new Error(message);
      }

      const newToken = extractTokenFromResponse(payload) || token;
      const storedRefresh = await getRefreshToken();
      const refreshToken = extractRefreshTokenFromResponse(payload) || storedRefresh || undefined;
      await saveAuthToken(newToken, nextRole, refreshToken);
      setRole(nextRole);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось сменить роль');
    } finally {
      setIsSwitching(false);
    }
  };

  const renderStudentContent = () => (
    <>
      <View style={styles.profileCard}>
        <View style={styles.profileImageWrapper}>
          <Image source={require('@/assets/images/avatar.png')} style={styles.profileImage} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{studentProfile.name}</Text>
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

      <View style={styles.studentInviteCard}>
        <View style={styles.studentInviteContent}>
          <Text style={styles.studentInviteText}>
            Отправьте товарищу ссылку на платформу и ходите на мастер-классы вместе
          </Text>
        </View>
        <View style={styles.inviteIconBox}>
          <ThemedText>
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 6.66667L10 1.66667M15 6.66667L10 11.6667M15 6.66667H5C3.89543 6.66667 3 7.5621 3 8.66667V15.3333C3 16.4379 3.89543 17.3333 5 17.3333H12.3333C13.4379 17.3333 14.3333 16.4379 14.3333 15.3333V6.66667" stroke="#181818" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </ThemedText>
        </View>
      </View>
    </>
  );

  const renderTutorContent = () => (
    <>
      <View style={styles.profileCard}>
        <View style={styles.profileImageWrapper}>
          <Image source={require('@/assets/images/avatar.png')} style={styles.profileImage} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{tutorProfile.name}</Text>
          <Text style={styles.profileRole}>{tutorProfile.role}</Text>
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
          <ThemedText>
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 6.66667L10 1.66667M15 6.66667L10 11.6667M15 6.66667H5C3.89543 6.66667 3 7.5621 3 8.66667V15.3333C3 16.4379 3.89543 17.3333 5 17.3333H12.3333C13.4379 17.3333 14.3333 16.4379 14.3333 15.3333V6.66667" stroke="#181818" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </ThemedText>
        </View>
      </Pressable>

      <Modal transparent animationType="none" visible={isShareVisible} onRequestClose={() => setShareVisible(false)}>
        <Pressable style={styles.shareModalOverlay} onPress={() => setShareVisible(false)}>
          <Pressable style={styles.shareModalSheet} onPress={() => {}}>
            <Text style={styles.shareModalTitle}>Поделиться профилем</Text>
            <View style={styles.shareModalCard}>
              <Text style={styles.shareModalUrl} numberOfLines={2}>{profileUrl}</Text>
            </View>
            {isShareCopied ? <Text style={styles.shareCopiedText}>Ссылка скопирована</Text> : null}
            <Pressable style={styles.shareModalButton} onPress={handleCopyProfileLink}>
              <Text style={styles.shareModalButtonText}>Скопировать ссылку</Text>
            </Pressable>
            <Pressable style={styles.shareModalClose} onPress={() => setShareVisible(false)}>
              <Text style={styles.shareModalCloseText}>Закрыть</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );

  return (
    <View style={styles.container}>
      <View style={styles.roleSwitch}>
        <Pressable
          style={[styles.roleButton, role === 'student' && styles.roleButtonActive]}
          onPress={() => handleSwitchRole('student')}
          disabled={isSwitching}
        >
          <Text style={[styles.roleButtonText, role === 'student' && styles.roleButtonTextActive]}>
            Ученик
          </Text>
        </Pressable>
        <Pressable
          style={[styles.roleButton, role === 'tutor' && styles.roleButtonActive]}
          onPress={() => handleSwitchRole('tutor')}
          disabled={isSwitching}
        >
          <Text style={[styles.roleButtonText, role === 'tutor' && styles.roleButtonTextActive]}>
            Наставник
          </Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {role === 'student' ? renderStudentContent() : renderTutorContent()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  roleSwitch: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#1E1E1E',
    marginBottom: 16,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: '#111',
  },
  roleButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  roleButtonTextActive: {
    color: '#FAFAFA',
  },
  studentInviteCard: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    flexDirection: 'row',
    marginBottom: 24,
  },
  studentInviteContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  studentInviteText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  profileCard: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    flexDirection: 'row',
    marginBottom: 16,
  },
  profileImageWrapper: {
    width: 96,
    height: 96,
    borderRightWidth: 1,
    borderColor: '#1E1E1E',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E5E5',
  },
  profileInfo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  profileName: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  actionsCard: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    marginBottom: 24,
  },
  actionButton: {
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#1E1E1E',
  },
  actionButtonFirst: {
    borderTopWidth: 0,
  },
  actionText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  actionPrimary: {
    backgroundColor: '#111',
  },
  actionPrimaryText: {
    color: '#FAFAFA',
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginBottom: 12,
  },
  slotsRow: {
    gap: 12,
    paddingBottom: 16,
  },
  slotCard: {
    width: 76,
    height: 64,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  slotText: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    textAlign: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
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
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  primaryButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#FAFAFA',
  },
  inviteCard: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    flexDirection: 'row',
  },
  inviteContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inviteTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginBottom: 4,
  },
  inviteSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  inviteIconBox: {
    width: 64,
    borderLeftWidth: 1,
    borderColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    padding: 16,
  },
  shareModalSheet: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  shareModalTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginBottom: 12,
  },
  shareModalCard: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    padding: 12,
  },
  shareModalUrl: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  shareCopiedText: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  shareModalButton: {
    marginTop: 16,
    backgroundColor: '#1E1E1E',
    paddingVertical: 14,
    alignItems: 'center',
  },
  shareModalButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
  },
  shareModalClose: {
    marginTop: 12,
    alignItems: 'center',
  },
  shareModalCloseText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
});
