import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

export default function EditProfileScreen() {
  const router = useRouter();
  const [name, setName] = useState('Андрей Осетров');
  const [role, setRole] = useState('Куратор, исследователь визуальной культуры');
  const [email, setEmail] = useState('andrey_osetrov@yandex.ru');
  const [telegram, setTelegram] = useState('Телеграм: @andrrrr');
  const [bio, setBio] = useState(
    'Преподаю на стыке современного искусства, медиа и теории восприятия. Веду открытые курсы по визуальной грамотности, сотрудничал с Третьяковской галереей, ГЭС-2 и Garage Digital. Умею объяснять сложно просто, без пафоса и скуки. Считаю, что понимание искусства — это не про образование, а про внимание.'
  );
  const [price, setPrice] = useState('Стоимость часовой консультации: 600 ₽');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ThemedText>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="#181818" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>ИЗМЕНЕНИЕ ДАННЫХ</Text>

        <TextInput value={name} onChangeText={setName} style={styles.input} />
        <TextInput value={role} onChangeText={setRole} style={styles.input} />
        <TextInput value={email} onChangeText={setEmail} style={styles.input} />
        <TextInput value={telegram} onChangeText={setTelegram} style={styles.input} />
        <TextInput
          value={bio}
          onChangeText={setBio}
          style={[styles.input, styles.textArea]}
          multiline
          textAlignVertical="top"
        />
        <TextInput value={price} onChangeText={setPrice} style={styles.input} />

        <View style={styles.photoRow}>
          <View style={styles.photoBox}>
            <Image source={require('@/assets/images/avatar.png')} style={styles.photo} />
          </View>
          <View style={styles.photoAction}>
            <Text style={styles.photoActionText}>Заменить фото</Text>
          </View>
        </View>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.push('/(tabs)/new-password')}
        >
          <Text style={styles.secondaryButtonText}>Изменить пароль</Text>
        </Pressable>

        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Сохранить изменения</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
  photoRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#1E1E1E',
    marginBottom: 12,
  },
  photoBox: {
    width: 64,
    height: 64,
    borderRightWidth: 1,
    borderColor: '#1E1E1E',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActionText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
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
  primaryButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#FAFAFA',
  },
});
