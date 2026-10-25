import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').trim();
}

/**
 * Редактор хэштегов для админки (статьи/события/наставники) — чипы с ✕ +
 * поле ввода, тег добавляется по Enter или запятой. Хранится без ведущего
 * "#" (см. backend utils/tags.ts) — "#" добавляется только на сайте при
 * отображении.
 */
export function AdminTagsInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (tags: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState('');

  function commit() {
    const tag = normalizeTag(input);
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setInput('');
  }

  function remove(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <View>
      {tags.length > 0 ? (
        <View style={styles.chipsRow}>
          {tags.map((t) => (
            <View key={t} style={styles.chip}>
              <Text style={styles.chipText}>#{t}</Text>
              <Pressable onPress={() => remove(t)}><Text style={styles.chipRemove}>✕</Text></Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <TextInput
        style={styles.input}
        value={input}
        onChangeText={(v) => {
          // Запятая в наборе — коммитим тег сразу, не дожидаясь Enter
          // (удобно при вставке списка "тег1, тег2, тег3").
          if (v.endsWith(',')) {
            const tag = normalizeTag(v.slice(0, -1));
            if (tag && !tags.includes(tag)) onChange([...tags, tag]);
            setInput('');
            return;
          }
          setInput(v);
        }}
        onSubmitEditing={commit}
        onBlur={commit}
        placeholder={placeholder ?? 'Добавить тег и нажать Enter (например, искусство)'}
        placeholderTextColor="#9B9B9B"
        blurOnSubmit={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#E5E5E5', paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#FAFAFA' },
  chipText: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#181818' },
  chipRemove: { fontSize: 12, color: '#9B9B9B' },
  input: {
    borderBottomWidth: 1, borderColor: '#E5E5E5', paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#181818', backgroundColor: '#FAFAFA',
  },
});
