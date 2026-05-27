import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

const JITSI_BASE = process.env.EXPO_PUBLIC_JITSI_BASE ?? 'https://jitsi.platformaapp.ru';

/** Заменяет публичный meet.jit.si на наш приватный сервер. */
function normalizeJitsiUrl(url: string): string {
  return url.replace(/^https?:\/\/meet\.jit\.si\//, `${JITSI_BASE}/`);
}

/** URL комнаты приходит с бэкенда (/api/events/:id/join или /api/{role}/bookings/:id/join). */
export async function openJitsi(url: string): Promise<void> {
  const normalized = normalizeJitsiUrl(url);
  if (Platform.OS === 'web') {
    (globalThis as any).window?.open(normalized, '_blank', 'noopener,noreferrer');
  } else {
    await WebBrowser.openBrowserAsync(normalized, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });
  }
}
