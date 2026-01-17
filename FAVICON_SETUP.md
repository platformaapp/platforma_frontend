# Настройка фавиконок

## Текущая конфигурация

Фавиконка для веб-версии настроена в `app.json`:
```json
"web": {
  "favicon": "./assets/images/favicon.png"
}
```

## Как обновить фавиконку

### 1. Подготовка изображения

**Рекомендуемые параметры:**
- **Формат**: PNG (предпочтительно) или ICO
- **Размер**: 512x512 пикселей (Expo автоматически создаст нужные размеры)
- **Прозрачность**: Поддерживается
- **Фон**: Прозрачный или однотонный

### 2. Замена файла

**Вариант А: Заменить существующий файл**
```bash
# Просто замените файл
assets/images/favicon.png
```

**Вариант Б: Использовать другой файл**
Обновите путь в `app.json`:
```json
"web": {
  "favicon": "./assets/images/your-favicon.png"
}
```

### 3. Дополнительные настройки (опционально)

Для более продвинутой настройки можно добавить в `app.json`:

```json
"web": {
  "output": "static",
  "favicon": "./assets/images/favicon.png",
  "bundler": "metro",
  "name": "Platforma App",
  "shortName": "Platforma",
  "lang": "ru",
  "scope": "/",
  "themeColor": "#181818",
  "backgroundColor": "#ffffff",
  "display": "standalone",
  "orientation": "portrait",
  "startUrl": "/",
  "description": "Описание вашего приложения"
}
```

### 4. Размеры для разных платформ

- **Web (favicon)**: 32x32, 48x48, 512x512 (Expo создаст автоматически)
- **iOS (icon)**: 1024x1024 (уже настроен в `icon`)
- **Android (adaptiveIcon)**: 
  - Foreground: 1024x1024
  - Background: 1024x1024
  - Monochrome: 1024x1024

### 5. После обновления

После замены файла или изменения конфигурации:

```bash
# Очистите кеш и перезапустите
npx expo start --clear

# Для веб-версии
npx expo start --web
```

## Инструменты для создания фавиконок

1. **Онлайн генераторы:**
   - [Favicon.io](https://favicon.io/) - создание из текста или изображения
   - [RealFaviconGenerator](https://realfavicongenerator.net/) - генератор всех размеров
   - [Favicon Generator](https://www.favicon-generator.org/)

2. **Из существующего изображения:**
   - Используйте любой графический редактор (Photoshop, Figma, GIMP)
   - Экспортируйте в PNG 512x512

## Проверка

После настройки проверьте фавиконку:
1. Запустите веб-версию: `npx expo start --web`
2. Откройте вкладку браузера - должна отображаться ваша фавиконка
3. Проверьте в DevTools (F12) → Elements → `<head>` → должен быть `<link rel="icon">`

## Текущие файлы иконок

- `assets/images/favicon.png` - фавиконка для веб
- `assets/images/icon.png` - основная иконка приложения (1024x1024)
- `assets/images/android-icon-foreground.png` - Android foreground
- `assets/images/android-icon-background.png` - Android background
- `assets/images/android-icon-monochrome.png` - Android monochrome

