import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AuthError } from '@/lib/api/auth-error';
import { getTutorProfile, updateTutorProfile } from '@/lib/api/tutor';
import { getAuthRole, getUserProfile } from '@/lib/auth';

const FALLBACK = {
  name: 'Андрей Осетров',
  role: 'Куратор, исследователь визуальной культуры',
  email: 'andrey_osetrov@yandex.ru',
  telegram: 'Телеграм: @andrrrr',
  bio: 'Преподаю на стыке современного искусства, медиа и теории восприятия. Веду открытые курсы по визуальной грамотности, сотрудничал с Третьяковской галереей, ГЭС-2 и Garage Digital. Умею объяснять сложно просто, без пафоса и скуки. Считаю, что понимание искусства — это не про образование, а про внимание.',
  price: 'Стоимость часовой консультации: 600 ₽',
};

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
    const load = async () => {
      const loginProfile = await getUserProfile();
      if (!cancelled && loginProfile) {
        setName(loginProfile.full_name ?? '');
        setEmail(loginProfile.email ?? '');
        setBio(loginProfile.bio ?? '');
      }
      const currentRole = await getAuthRole();
      if (currentRole === 'tutor') {
        getTutorProfile()
          .then((p) => {
            if (!cancelled) {
              setName(p.full_name ?? loginProfile?.full_name ?? FALLBACK.name);
              setBio(p.bio ?? loginProfile?.bio ?? FALLBACK.bio);
              setEmail(p.email ?? loginProfile?.email ?? FALLBACK.email);
            }
          })
          .catch((e) => {
            if (!cancelled) {
              if (e instanceof AuthError || e?.name === 'AuthError') {
                setLoading(false);
                router.replace('/login');
                return;
              }
              if (!loginProfile) {
                setName(FALLBACK.name);
                setRole(FALLBACK.role);
                setEmail(FALLBACK.email);
                setTelegram(FALLBACK.telegram);
                setBio(FALLBACK.bio);
                setPrice(FALLBACK.price);
              }
            }
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      } else {
        if (!cancelled && !loginProfile) {
          setName(FALLBACK.name);
          setEmail(FALLBACK.email);
        }
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [router]);

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
      if (e instanceof AuthError || e?.name === 'AuthError') {
        router.replace('/login');
        return;
      }
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

        <TextInput
          value={name}
          onChangeText={setName}
          style={styles.input}
          placeholder="Имя"
          placeholderTextColor="#9B9B9B"
        />
        <TextInput
          value={role}
          onChangeText={setRole}
          style={styles.input}
          placeholder="Роль"
          placeholderTextColor="#9B9B9B"
        />
        <TextInput
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9B9B9B"
        />
        <TextInput
          value={telegram}
          onChangeText={setTelegram}
          style={styles.input}
          placeholder="Телеграм"
          placeholderTextColor="#9B9B9B"
        />
        <TextInput
          value={bio}
          onChangeText={setBio}
          style={[styles.input, styles.textArea]}
          multiline
          textAlignVertical="top"
          placeholder="О себе"
          placeholderTextColor="#9B9B9B"
        />
        <TextInput
          value={price}
          onChangeText={setPrice}
          style={styles.input}
          placeholder="Стоимость"
          placeholderTextColor="#9B9B9B"
        />

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
