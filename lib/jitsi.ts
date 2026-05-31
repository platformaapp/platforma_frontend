import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

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
