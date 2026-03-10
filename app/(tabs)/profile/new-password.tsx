import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';


export default function NewPasswordScreen() {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <Path d="M15 18L9 12L15 6" stroke="#181818" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </Svg>
        </Pressable>
      </View>

      <Text style={styles.title}>НОВЫЙ ПАРОЛЬ</Text>

      <View style={styles.fieldRow}>
        <TextInput
          value={oldPassword}
          onChangeText={setOldPassword}
          style={styles.input}
          placeholder="Старый пароль"
          placeholderTextColor="#9B9B9B"
          secureTextEntry={!showOld}
        />
        <Pressable style={styles.eyeButton} onPress={() => setShowOld((prev) => !prev)}>
          <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <Path d="M2 12C3.7 7.6 7.5 5 12 5C16.5 5 20.3 7.6 22 12C20.3 16.4 16.5 19 12 19C7.5 19 3.7 16.4 2 12Z" stroke="#181818" strokeWidth="1.5"/>
            <Circle cx="12" cy="12" r="3" stroke="#181818" strokeWidth="1.5"/>
          </Svg>
        </Pressable>
      </View>

      <View style={styles.fieldRow}>
        <TextInput
          value={newPassword}
          onChangeText={setNewPassword}
          style={styles.input}
          placeholder="Новый пароль"
          placeholderTextColor="#9B9B9B"
          secureTextEntry={!showNew}
        />
        <Pressable style={styles.eyeButton} onPress={() => setShowNew((prev) => !prev)}>
          <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <Path d="M2 12C3.7 7.6 7.5 5 12 5C16.5 5 20.3 7.6 22 12C20.3 16.4 16.5 19 12 19C7.5 19 3.7 16.4 2 12Z" stroke="#181818" strokeWidth="1.5"/>
            <Circle cx="12" cy="12" r="3" stroke="#181818" strokeWidth="1.5"/>
          </Svg>
        </Pressable>
      </View>

      <View style={styles.fieldRow}>
        <TextInput
          value={repeatPassword}
          onChangeText={setRepeatPassword}
          style={styles.input}
          placeholder="Повторите пароль"
          placeholderTextColor="#9B9B9B"
          secureTextEntry={!showRepeat}
        />
        <Pressable style={styles.eyeButton} onPress={() => setShowRepeat((prev) => !prev)}>
          <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <Path d="M2 12C3.7 7.6 7.5 5 12 5C16.5 5 20.3 7.6 22 12C20.3 16.4 16.5 19 12 19C7.5 19 3.7 16.4 2 12Z" stroke="#181818" strokeWidth="1.5"/>
            <Circle cx="12" cy="12" r="3" stroke="#181818" strokeWidth="1.5"/>
          </Svg>
        </Pressable>
      </View>

      <Text style={styles.helperText}>
        Пароль должен быть не меньше 7 символов{'\n'}
        и состоять из букв, цифр и прикольных символов
      </Text>

      <Pressable style={styles.saveButton}>
        <Text style={styles.saveButtonText}>Сохранить</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  header: {
    paddingTop: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 12,
    marginBottom: 16,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  fieldRow: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  eyeButton: {
    width: 44,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderColor: '#1E1E1E',
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginTop: 4,
  },
  saveButton: {
    marginTop: 'auto',
    marginBottom: 24,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#111',
    paddingVertical: 16,
    alignItems: 'center',
    height: 52,
  },
  saveButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#FAFAFA',
  },
});
