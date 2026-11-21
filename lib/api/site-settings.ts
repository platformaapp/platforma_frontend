import { endpoints } from '@/constants/env';
import { getAdminToken } from '@/lib/admin-auth';

export interface NavItemSetting {
  label: string;
  iconUrl?: string;
}

export interface BannerSetting {
  mobileImageUrl?: string;
  imageUrl?: string;
  linkUrl?: string;
}

export interface PartnerSetting {
  name: string;
  logoUrl: string;
  linkUrl?: string;
}

/** Страница "О нас" (ссылка p(34) в шапке) — большое фото/заголовок/текст. */
export interface AboutUsSetting {
  photoUrl?: string;
  heading?: string;
  text?: string;
}

export interface SiteSettings {
  navItems: NavItemSetting[];
  banner: BannerSetting;
  articleBanner: BannerSetting;
  partners: PartnerSetting[];
  topics: string[];
  aboutUs: AboutUsSetting;
}

const EMPTY_SETTINGS: SiteSettings = { navItems: [], banner: {}, articleBanner: {}, partners: [], topics: [], aboutUs: {} };

/** GET /api/settings/site — публично, без авторизации. */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const res = await fetch(endpoints.settingsSite);
    if (!res.ok) return EMPTY_SETTINGS;
    const data = await res.json();
    return {
      navItems: Array.isArray(data?.navItems) ? data.navItems : [],
      banner: data?.banner ?? {},
      articleBanner: data?.articleBanner ?? {},
      partners: Array.isArray(data?.partners) ? data.partners : [],
      topics: Array.isArray(data?.topics) ? data.topics : [],
      aboutUs: data?.aboutUs ?? {},
    };
  } catch {
    return EMPTY_SETTINGS;
  }
}

/** PUT /api/admin/settings/site — только админ. */
export async function updateSiteSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  const token = await getAdminToken();
  const res = await fetch(endpoints.adminSettingsSite, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload?.message ?? 'Не удалось сохранить настройки');
  }
  const settings = await res.json();
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('site-settings-updated', { detail: settings }));
  return settings;
}

/** GET /api/admin/settings/site — только админ (то же тело, что и публичный). */
export async function getAdminSiteSettings(): Promise<SiteSettings> {
  const token = await getAdminToken();
  const res = await fetch(endpoints.adminSettingsSite, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return EMPTY_SETTINGS;
  return res.json();
}
