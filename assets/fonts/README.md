# Инструкция по добавлению шрифтов

## 1. Размещение файлов шрифтов

Поместите файлы шрифтов (`.ttf`, `.otf`) в эту папку: `assets/fonts/`

**⚠️ ВАЖНО:** React Native/Expo **НЕ поддерживает** формат `.woff` или `.woff2`. Используйте только `.ttf` или `.otf` форматы!

Если у вас есть `.woff` файлы, их нужно конвертировать в `.ttf`. См. инструкцию в папке `Inter/КАК_ПОЛУЧИТЬ_TTF.md`

Пример структуры:
```
assets/
  fonts/
    Inter-Regular.ttf
    Inter-Bold.ttf
    Inter-Medium.ttf
    Inter-SemiBold.ttf
```

## 2. Загрузка шрифтов в приложении

Шрифты загружаются в файле `app/_layout.tsx` через `useFonts` из `expo-font`:

```typescript
const [fontsLoaded] = useFonts({
  'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
  'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
  'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
});
```

**Важно:** Ключ объекта (например, `'Inter-Regular'`) — это имя, которое вы будете использовать в `fontFamily`.

## 3. Применение шрифта к элементу

### В StyleSheet:
```typescript
const styles = StyleSheet.create({
  title: {
    fontFamily: 'Inter-Regular', // Имя должно совпадать с ключом в useFonts
    fontSize: 28,
    fontWeight: '400',
  },
});
```

### Инлайн стили:
```typescript
<ThemedText style={{ fontFamily: 'Inter-Regular', fontSize: 16 }}>
  Текст
</ThemedText>
```

## 4. Использование разных начертаний

Для разных начертаний (Regular, Bold, Medium) используйте разные имена:

```typescript
// В useFonts:
'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),

// В стилях:
fontFamily: 'Inter-Regular', // для обычного текста
fontFamily: 'Inter-Bold',    // для жирного текста
```

**Примечание:** В React Native `fontWeight` не всегда работает с кастомными шрифтами. Лучше использовать отдельные файлы для каждого начертания.

## 5. Где скачать шрифты

- [Google Fonts](https://fonts.google.com/)
- [Font Squirrel](https://www.fontsquirrel.com/)
- [Adobe Fonts](https://fonts.adobe.com/)

После скачивания убедитесь, что у вас есть файлы `.ttf` или `.otf` формата.

