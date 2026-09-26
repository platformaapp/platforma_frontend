import { useEffect, useState } from 'react';

import { getSiteSettings, type SiteSettings } from '@/lib/api/site-settings';

const EMPTY: SiteSettings = { navItems: [], banner: {}, partners: [], topics: [] };

// Модульный кэш — один фетч на всю сессию вкладки, а не по разу на каждый
// компонент (шапка, футер, баннер и т.д. монтируются одновременно).
let cache: SiteSettings | null = null;
let inflight: Promise<SiteSettings> | null = null;

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
    return () => { active = false; };
  }, []);

  return settings;
}
