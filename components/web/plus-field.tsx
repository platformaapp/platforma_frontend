import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

type PlusFieldProps = {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  multiline?: boolean;
  error?: string;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
};

/**
 * Поле формы по референсу: подпись + кружок с плюсом вместо рамки.
 * Клик по плюсу превращает его в обычный текстовый инпут с курсором;
 * если поле остаётся пустым при потере фокуса — снова схлопывается в плюс.
 * Поле с уже введённым значением (например, при возврате на шаг назад)
 * сразу открыто.
 */
export function PlusField({ label, hint, value, onChangeText, secureTextEntry, multiline, error, keyboardType, autoCapitalize, maxLength }: PlusFieldProps) {
  const [active, setActive] = useState(false);
  const [secureVisible, setSecureVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const expanded = active || value.length > 0;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, error && styles.labelError]}>
        {label}
        {hint ? <Text style={styles.hint}> {hint}</Text> : null}
      </Text>
      {expanded ? (
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            autoFocus={active}
            onBlur={() => { if (!value) setActive(false); }}
            secureTextEntry={secureTextEntry && !secureVisible}
            multiline={multiline}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            maxLength={maxLength}
          />
          {secureTextEntry ? (
            <Pressable onPress={() => setSecureVisible((v) => !v)} style={styles.eye} hitSlop={8}>
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <Path d="M2 12C3.7 7.6 7.5 5 12 5C16.5 5 20.3 7.6 22 12C20.3 16.4 16.5 19 12 19C7.5 19 3.7 16.4 2 12Z" stroke="#010101" strokeWidth="1.5" />
                <Circle cx="12" cy="12" r="3" stroke="#010101" strokeWidth="1.5" />
              </Svg>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Pressable onPress={() => setActive(true)} hitSlop={8} style={styles.plusButton}>
          <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="10" stroke={error ? '#E02D2D' : '#010101'} strokeWidth="1" />
            <Path d="M12 7.5V16.5M7.5 12H16.5" stroke={error ? '#E02D2D' : '#010101'} strokeWidth="1" strokeLinecap="round" />
          </Svg>
        </Pressable>
      )}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 24 },
  label: { fontFamily: 'Gramatika-Regular', fontSize: 13, color: '#010101', marginBottom: 8 },
  labelError: { color: '#E02D2D' },
  hint: { color: '#9B9B9B' },
  plusButton: { paddingVertical: 2, alignSelf: 'flex-start' },
  inputRow: { position: 'relative' },
  input: {
    fontFamily: 'Gramatika-Regular',
    fontSize: 15,
    color: '#010101',
    paddingVertical: 4,
    paddingHorizontal: 0,
    paddingRight: 28,
    borderWidth: 0,
    backgroundColor: 'transparent',
    outlineStyle: 'none',
  } as any,
  eye: { position: 'absolute', right: 0, top: 4 },
  errorText: { fontFamily: 'Gramatika-Regular', fontSize: 12, color: '#E02D2D', marginTop: 4 },
});
