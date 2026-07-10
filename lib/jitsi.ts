import { router } from 'expo-router';

const MEET_JIT_SI = 'https://meet.jit.si';

/** Deterministic room name from entity type + id (дефисы убраны — Jitsi чувствителен к спецсимволам). */
export function buildJitsiUrl(type: 'event' | 'booking', id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${MEET_JIT_SI}/platforma-${type}-${safe}`;
}

/**
 * Отключает встроенный в Jitsi экран "открыть в приложении / в браузере" —
 * на мобильном user-agent он показывается всегда, даже когда мы уже сами
 * решили, где открывать встречу (наш собственный выбор на /conference).
 */
export function withoutDeepLinkingPrompt(url: string): string {
  const flag = 'config.disableDeepLinking=true';
  return url.includes('#') ? `${url}&${flag}` : `${url}#${flag}`;
}

/**
 * URL комнаты приходит с бэкенда (/api/events/:id/join или /api/{role}/bookings/:id/join).
 * Экран /conference сам решает, как показать встречу: в приложении — сразу
 * встроенный WebView с Jitsi IFrame API; в вебе — свой выбор "в браузере / в приложении".
 */
export async function openJitsi(url: string, meta?: { title?: string }): Promise<void> {
  router.push({ pathname: '/conference', params: { url, title: meta?.title ?? '' } });
}
