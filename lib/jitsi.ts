/**
 * Jitsi Meet integration.
 *
 * Комнаты создаются on-the-fly — никакого API не нужно.
 * Имя комнаты генерируется детерминированно из ID события/бронирования,
 * поэтому наставник и ученик автоматически попадают в одну комнату.
 *
 * Бэкенд может переопределить URL, вернув своё значение в поле
 * video_room.url (события) или videoUrl (бронирования).
 */

import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

const JITSI_BASE = 'https://meet.jit.si';

/**
 * Имя комнаты по типу и ID.
 * Формат: platforma-event-<id> | platforma-booking-<id>
 */
export function buildJitsiRoomName(type: 'event' | 'booking', id: string): string {
  // Убираем символы, недопустимые в URL-path (Jitsi чувствителен к спецсимволам)
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '');
  return `platforma-${type}-${safe}`;
}

/** Полный URL Jitsi-комнаты. */
export function buildJitsiUrl(type: 'event' | 'booking', id: string): string {
  return `${JITSI_BASE}/${buildJitsiRoomName(type, id)}`;
}

/**
 * Открывает Jitsi-комнату.
 * - Web: новая вкладка (Jitsi требует отдельный origin для WebRTC-разрешений)
 * - Native: встроенный браузер через expo-web-browser
 */
export async function openJitsi(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    (globalThis as any).window?.open(url, '_blank', 'noopener,noreferrer');
  } else {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });
  }
}
