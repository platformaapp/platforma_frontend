# Как получить TTF файлы шрифта Inter

## Проблема
У вас есть только `.woff` файлы, но React Native/Expo поддерживает только `.ttf` и `.otf` форматы.

## Решение 1: Скачать TTF с Google Fonts (рекомендуется)

1. Перейдите на [Google Fonts - Inter](https://fonts.google.com/specimen/Inter)
2. Нажмите "Download family" (Скачать семейство)
3. Распакуйте архив
4. Найдите папку `static` внутри архива
5. Скопируйте нужные `.ttf` файлы в `assets/fonts/Inter/`:
   - `Inter-Regular.ttf`
   - `Inter-Bold.ttf`
   - `Inter-Medium.ttf`

## Решение 2: Онлайн-конвертер

1. Используйте один из онлайн-конвертеров:
   - [CloudConvert](https://cloudconvert.com/woff-to-ttf)
   - [Convertio](https://convertio.co/woff-ttf/)
   - [FontSquirrel Webfont Generator](https://www.fontsquirrel.com/tools/webfont-generator)

2. Загрузите ваши `.woff` файлы
3. Конвертируйте в `.ttf`
4. Скачайте и поместите в `assets/fonts/Inter/`

## Решение 3: Использовать npm пакет (альтернатива)

Можно использовать пакет для автоматической загрузки:

```bash
npm install --save-dev @expo-google-fonts/inter
```

Но это требует изменения кода загрузки шрифтов.

## После получения TTF файлов

Убедитесь, что файлы находятся здесь:
- `assets/fonts/Inter/Inter-Regular.ttf`
- `assets/fonts/Inter/Inter-Bold.ttf`
- `assets/fonts/Inter/Inter-Medium.ttf`

Затем перезапустите приложение:
```bash
npx expo start --clear
```




