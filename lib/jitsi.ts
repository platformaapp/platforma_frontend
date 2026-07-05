import { router } from 'expo-router';
import { Platform } from 'react-native';

const MEET_JIT_SI = 'https://meet.jit.si';

/** Deterministic room name from entity type + id (дефисы убраны — Jitsi чувствителен к спецсимволам). */
export function buildJitsiUrl(type: 'event' | 'booking', id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${MEET_JIT_SI}/platforma-${type}-${safe}`;
}

/**
 * Отключает встроенный в Jitsi экран "открыть в приложении / в браузере" —
 * без этого флага Jitsi на мобильном user-agent всегда показывает этот экран,
 * даже внутри нашего собственного WebView.
 */
function withInAppConfig(url: string): string {
  const flag = 'config.disableDeepLinking=true';
  return url.includes('#') ? `${url}&${flag}` : `${url}#${flag}`;
}

/** URL комнаты приходит с бэкенда (/api/events/:id/join или /api/{role}/bookings/:id/join). */
export async function openJitsi(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    // window.open(_blank) is blocked by mobile Safari when called after an await.
    // location.href navigates in the same tab and is never blocked by popup blockers.
    const w = (globalThis as any).window;
    if (w) w.location.href = url;
    return;
  }
  // Открываем встречу прямо в приложении (WebView-экран), а не во внешнем браузере.
  router.push({ pathname: '/conference', params: { url: withInAppConfig(url) } });
}
