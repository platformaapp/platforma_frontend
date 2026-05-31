import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

const MEET_JIT_SI = 'https://meet.jit.si';

/** Deterministic room name from entity type + id (дефисы убраны — Jitsi чувствителен к спецсимволам). */
export function buildJitsiUrl(type: 'event' | 'booking', id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${MEET_JIT_SI}/platforma-${type}-${safe}`;
}

/** URL комнаты приходит с бэкенда (/api/events/:id/join или /api/{role}/bookings/:id/join). */
export async function openJitsi(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    (globalThis as any).window?.open(url, '_blank', 'noopener,noreferrer');
  } else {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });
  }
}
