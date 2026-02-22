import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { getTutorProfile, updateTutorProfile } from '@/lib/api/tutor';

export default function EditProfileScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [telegram, setTelegram] = useState('');
  const [bio, setBio] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getTutorProfile()
      .then((p) => {
        if (!cancelled) {
          setName(p.full_name ?? '');
          setBio(p.bio ?? '');
          setEmail(p.email ?? '');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setName('Андрей Осетров');
          setRole('Куратор, исследователь визуальной культуры');
          setEmail('andrey_osetrov@yandex.ru');
          setTelegram('Телеграм: @andrrrr');
          setBio('Преподаю на стыке современного искусства, медиа и теории восприятия. Веду открытые курсы по визуальной грамотности, сотрудничал с Третьяковской галереей, ГЭС-2 и Garage Digital. Умею объяснять сложно просто, без пафоса и скуки. Считаю, что понимание искусства — это не про образование, а про внимание.');
          setPrice('Стоимость часовой консультации: 600 ₽');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await updateTutorProfile({
        full_name: name.trim(),
        bio: bio.trim(),
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="chevron-left" size={24} color="#181818" />
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
          onPress={() => router.push('/(tabs)/profile/new-password')}
        >
          <Text style={styles.secondaryButtonText}>Изменить пароль</Text>
        </Pressable>

        <Pressable style={[styles.primaryButton, saving && styles.primaryButtonDisabled]} onPress={handleSave} disabled={saving}>
          <Text style={styles.primaryButtonText}>{saving ? 'Сохранение...' : 'Сохранить изменения'}</Text>
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
