import { useEffect, useState } from 'react';

import { getSiteSettings, type SiteSettings } from '@/lib/api/site-settings';

const EMPTY: SiteSettings = { navItems: [], banner: {}, articleBanner: {}, partners: [], topics: [], aboutUs: {} };

// Модульный кэш — один фетч на всю сессию вкладки, а не по разу на каждый
// компонент (шапка, футер, баннер и т.д. монтируются одновременно).
let cache: SiteSettings | null = null;
let inflight: Promise<SiteSettings> | null = null;

// Keep the cache current even while only the admin screen is mounted.
if (typeof window !== 'undefined') {
  window.addEventListener('site-settings-updated', (event) => {
    cache = (event as CustomEvent<SiteSettings>).detail;
  });
}

function load(): Promise<SiteSettings> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = getSiteSettings().then((s) => { cache = s; inflight = null; return s; });
  }
  return inflight;
}

/**
 * Настройки сайта из админки (навигация/баннер/партнёры/рубрикатор).
 * Пустые поля/массивы — админ ещё не задавал значение, вызывающий компонент
 * сам решает, каким дефолтом это заменить (см. использования).
 */
export function useSiteSettings(): SiteSettings {
  const [settings, setSettings] = useState<SiteSettings>(cache ?? EMPTY);

  useEffect(() => {
    let active = true;
    load().then((s) => { if (active) setSettings(s); });
    const onUpdate = (event: Event) => {
      cache = (event as CustomEvent<SiteSettings>).detail;
      if (active && cache) setSettings(cache);
    };
    if (typeof window !== 'undefined') window.addEventListener('site-settings-updated', onUpdate);
    return () => {
      active = false;
      if (typeof window !== 'undefined') window.removeEventListener('site-settings-updated', onUpdate);
    };
  }, []);

  return settings;
}
