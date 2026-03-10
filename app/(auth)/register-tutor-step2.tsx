import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const SHORT_BIO_LIMIT = 70;
const ABOUT_LIMIT = 400;

export default function RegisterTutorStep2Screen() {
  const router = useRouter();
  const [shortBio, setShortBio] = useState('');
  const [about, setAbout] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [groupMeetings, setGroupMeetings] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingRate, setIsEditingRate] = useState(true);

  const rateValue = hourlyRate ? parseInt(hourlyRate) || 0 : 0;
  const commission = rateValue * 0.1;
  const finalAmount = rateValue - commission;

  const shortBioRemaining = SHORT_BIO_LIMIT - shortBio.length;
  const aboutRemaining = ABOUT_LIMIT - about.length;

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
    }
  }

  async function onSubmit() {
    setIsSubmitting(true);
    try {
      // Здесь будет отправка данных второго шага на сервер
      // await fetch(endpoints.tutorStep2, { ... });
      await new Promise(resolve => setTimeout(resolve, 1000));
      router.replace('/tutor-application-sent');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Неизвестная ошибка');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })} keyboardVerticalOffset={Platform.select({ ios: 80, android: 0 })}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedView>
          <Pressable style={styles.close} onPress={() => router.back()}>
            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <Path d="M2 2L22 22M22 2L2 22" stroke="#181818"/>
            </Svg>
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <ThemedText type="title" style={styles.title}>РЕГИСТРАЦИЯ{"\n"}НАСТАВНИКА</ThemedText>
            <View style={styles.stepBadge}><ThemedText>Шаг 2</ThemedText></View>
          </View>

          <View style={styles.inputWithCounter}>
            <TextInput
              placeholder="Короткое био (например, фотограф в The Blueprint)"
              placeholderTextColor="#888"
              style={[styles.input, styles.textArea]}
              value={shortBio}
              onChangeText={(text) => {
                if (text.length <= SHORT_BIO_LIMIT) {
                  setShortBio(text);
                }
              }}
              multiline
              numberOfLines={3}
            />
            <View style={styles.counter}>
              <ThemedText style={[styles.counterText, shortBioRemaining === 0 && styles.counterTextError]}>
                {shortBioRemaining}
              </ThemedText>
            </View>
          </View>

          <View style={styles.inputWithCounter}>
            <TextInput
              placeholder="О себе в свободной форме"
              placeholderTextColor="#888"
              style={[styles.input, styles.textArea]}
              value={about}
              onChangeText={(text) => {
                if (text.length <= ABOUT_LIMIT) {
                  setAbout(text);
                }
              }}
              multiline
              numberOfLines={4}
            />
            <View style={styles.counter}>
              <ThemedText style={[styles.counterText, aboutRemaining === 0 && styles.counterTextError]}>
                {aboutRemaining}
              </ThemedText>
            </View>
          </View>

          <View style={styles.rateContainer}>
            {hourlyRate && !isEditingRate ? (
              <Pressable 
                style={{ flex: 1 }}
                onPress={() => setIsEditingRate(true)}
              >
                <ThemedText style={styles.rateDisplay}>
                  Стоимость часа — {rateValue} ₽
                </ThemedText>
              </Pressable>
            ) : (
              <TextInput
                placeholder="Стоимость часа"
                placeholderTextColor="#888"
                style={styles.rateInput}
                value={hourlyRate}
                onChangeText={(text) => {
                  setHourlyRate(text);
                }}
                keyboardType="numeric"
                onBlur={() => {
                  if (hourlyRate && parseInt(hourlyRate) > 0) {
                    setIsEditingRate(false);
                  }
                }}
                autoFocus={isEditingRate && hourlyRate ? true : false}
              />
            )}
            {hourlyRate && rateValue > 0 ? (
              <View style={styles.commissionInfo}>
                <ThemedText style={styles.commissionText}>Комиссия 10%</ThemedText>
                <ThemedText style={styles.finalAmountText}>
                  Вы получите {finalAmount} ₽
                </ThemedText>
              </View>
            ) : (
              <ThemedText style={styles.commissionText}>Комиссия 10%</ThemedText>
            )}
          </View>

          <TextInput
            placeholder="Собираетесь ли вы проводить групповые встречи? Как часто?"
            placeholderTextColor="#888"
            style={[styles.input, styles.textArea]}
            value={groupMeetings}
            onChangeText={setGroupMeetings}
            multiline
            numberOfLines={3}
          />

          <Pressable style={[styles.upload, avatarUri && styles.uploadWithPhotoContainer]} onPress={pickImage}>
            {avatarUri ? (
              <View style={styles.uploadWithPhoto}>
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
                <View style={styles.replacePhotoContainer}>
                  <ThemedText style={styles.replacePhotoText}>Заменить фото</ThemedText>
                </View>
              </View>
            ) : (
              <ThemedText style={{ textAlign: 'center' }}>Загрузить фото</ThemedText>
            )}
          </Pressable>

          <Pressable 
            style={[styles.btn, styles.btnPrimary, isSubmitting && { opacity: 0.6 }]} 
            onPress={onSubmit} 
            disabled={isSubmitting}
          >
            <ThemedText style={[styles.btnPrimaryText, styles.btnPrimaryTextCustom]}>
              Отправить заявку
            </ThemedText>
          </Pressable>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    marginTop: 48,
    marginBottom: 24,
    fontFamily: "Inter-Regular",
    fontSize: 28,
    fontWeight: "400",
    fontStyle: "normal",
    lineHeight: 36,
    letterSpacing: -2,
    color: "#181818"
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(24, 24, 24, 1.0)",
    borderRadius: 0,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
    fontFamily: "Inter-Regular",
    fontSize: 14,
  },
  inputWithCounter: {
    position: 'relative',
    marginBottom: 12,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 14,
    paddingRight: 50,
  },
  counter: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#181818',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 0,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "400",
  },
  counterTextError: {
    color: "#E02D2D",
  },
  rateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: "rgba(24, 24, 24, 1.0)",
    borderRadius: 0,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
    minHeight: 52,
  },
  rateInput: {
    flex: 1,
    fontFamily: "Inter-Regular",
    fontSize: 14,
    color: "#181818",
    padding: 0,
    margin: 0,
    minHeight: 50,
    borderWidth: 0,
    outlineWidth: 0,
  },
  rateDisplay: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    color: "#181818",
    flex: 1,
    minHeight: 24,
    paddingVertical: 4,
  },
  commissionInfo: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  commissionText: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    color: "#888",
    marginBottom: 4,
  },
  finalAmountText: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    color: "#181818",
  },
  upload: {
    borderWidth: 1,
    borderColor: "rgba(24, 24, 24, 1.0)",
    borderRadius: 0,
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
    paddingHorizontal: 0,
  },
  avatar: {
    width: 52,
    height: 52,
    backgroundColor: '#f0f0f0',
    marginLeft: 0,
  },
  replacePhotoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 16,
    height: 52,
  },
  replacePhotoText: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    color: "#181818",
    textAlign: 'center',
  },
  btn: {
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    height: 52,
    marginTop: 4,
  },
  btnPrimary: {
    backgroundColor: '#111',
    borderColor: "rgba(24, 24, 24, 1.0)",
  },
  btnPrimaryText: {
    color: '#FFF',
  },
  btnPrimaryTextCustom: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    fontWeight: "400",
    fontStyle: "normal",
    lineHeight: 20,
    color: "#FAFAFA",
  },
  stepBadge: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 0,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 48,
  },
  close: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 1,
    padding: 8,
  },
});

