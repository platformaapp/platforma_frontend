import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

/**
 * Хэштеги контента (статья/наставник/событие) — рендерятся напротив имени
 * (автора статьи / наставника / события), тем же размером шрифта, что и имя
 * (textStyle — стиль имени, передаётся как есть). Строка-обёртка (имя+теги)
 * выравнивается по правому краю заголовка самим родителем (flex-row с
 * justifyContent:'space-between' на всю ширину блока заголовка) — этот
 * компонент сам по себе только рендерит теги, выровненные по правому краю
 * СВОЕГО контейнера.
 */
export function TagList({ tags, textStyle }: { tags?: string[] | null; textStyle?: StyleProp<TextStyle> }) {
  if (!tags || tags.length === 0) return null;
  return (
    <View style={styles.row}>
      {tags.map((t) => (
        <Text key={t} style={[styles.tag, textStyle]} numberOfLines={1}>#{t}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // flexShrink:0 — теги никогда не сжимаются/не обрезаются текстом с
  // троеточием: при нехватке места сжимается соседнее имя/заголовок (см.
  // flexShrink:1 на нём в каждом месте использования), не теги.
  row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4, justifyContent: 'flex-end', flexShrink: 0 },
  tag: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101' },
});
