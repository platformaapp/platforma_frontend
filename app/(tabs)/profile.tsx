import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

export default function ProfileScreen() {
  const slots = [
    '23.06\n18:00',
    '23.06\n20:00',
    '24.06\n18:00',
    '24.06\n20:00',
    '25.06\n20:00',
  ];

  return (
    <View style={styles.container}>
      <View style={styles.profileCard}>
        <View style={styles.profileImageWrapper}>
          <Image source={require('@/assets/images/react-logo.png')} style={styles.profileImage} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>Андрей Осетров</Text>
          <Text style={styles.profileRole}>Куратор, исследователь визуальной культуры</Text>
        </View>
      </View>

      <View style={styles.actionsCard}>
        <Pressable style={[styles.actionButton, styles.actionButtonFirst]}>
          <Text style={styles.actionText}>Изменить личные данные</Text>
        </Pressable>
        <Pressable style={styles.actionButton}>
          <Text style={styles.actionText}>Платежи</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.actionPrimary]}>
          <Text style={[styles.actionText, styles.actionPrimaryText]}>Создать событие</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Свободные слоты</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slotsRow}>
        {slots.map((slot, index) => (
          <View key={`${slot}-${index}`} style={styles.slotCard}>
            <Text style={styles.slotText}>{slot}</Text>
          </View>
        ))}
      </ScrollView>

      <Pressable style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Все слоты</Text>
      </Pressable>
      <Pressable style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Добавить слот</Text>
      </Pressable>

      <View style={styles.inviteCard}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
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
});



