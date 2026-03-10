import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const ROLE_KEY = 'auth_role';
const USER_PROFILE_KEY = 'auth_user_profile';

const isWeb = Platform.OS === 'web';

export interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  phone?: string;
  role?: string;
  avatar_url?: string;
  bio?: string;
  [key: string]: unknown;
}

export async function saveAuthToken(token: string, role?: string, refreshToken?: string, userProfile?: UserProfile) {
  if (!token) return;

  if (isWeb) {
    // Для веб-версии используем только localStorage
    try {
      const ls = (globalThis as any)?.localStorage;
      if (ls && typeof ls.setItem === 'function') {
        ls.setItem('access_token', token);
        ls.setItem(TOKEN_KEY, token);
        if (role) {
          ls.setItem(ROLE_KEY, role);
        }
        if (refreshToken) {
          ls.setItem(REFRESH_TOKEN_KEY, refreshToken);
        }
        if (userProfile) {
          ls.setItem(USER_PROFILE_KEY, JSON.stringify(userProfile));
        }
      }
    } catch (error) {
      console.error('Ошибка сохранения токена в localStorage:', error);
    }
  } else {
    // Для нативных платформ используем SecureStore
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      if (role) {
        await SecureStore.setItemAsync(ROLE_KEY, role);
      }
      if (refreshToken) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      }
      if (userProfile) {
        await SecureStore.setItemAsync(USER_PROFILE_KEY, JSON.stringify(userProfile));
      }
      
      // Дополнительно сохраняем в localStorage для совместимости
      try {
        const ls = (globalThis as any)?.localStorage;
        if (ls && typeof ls.setItem === 'function') {
          ls.setItem('access_token', token);
        }
      } catch {
        // Игнорируем ошибки localStorage на нативных платформах
      }
    } catch (error) {
      console.error('Ошибка сохранения токена в SecureStore:', error);
      throw error;
    }
  }
}

export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    let raw: string | null = null;
    if (isWeb) {
      const ls = (globalThis as any)?.localStorage;
      if (ls && typeof ls.getItem === 'function') {
        raw = ls.getItem(USER_PROFILE_KEY);
      }
    } else {
      raw = await SecureStore.getItemAsync(USER_PROFILE_KEY);
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

export async function getAuthToken() {
  if (isWeb) {
    try {
      const ls = (globalThis as any)?.localStorage;
      if (ls && typeof ls.getItem === 'function') {
        return ls.getItem(TOKEN_KEY) || ls.getItem('access_token') || null;
      }
    } catch {
      return null;
    }
    return null;
  } else {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  }
}

export async function getRefreshToken() {
  if (isWeb) {
    try {
      const ls = (globalThis as any)?.localStorage;
      if (ls && typeof ls.getItem === 'function') {
        return ls.getItem(REFRESH_TOKEN_KEY) || null;
      }
    } catch {
      return null;
    }
    return null;
  } else {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  }
}

export async function getAuthRole() {
  if (isWeb) {
    try {
      const ls = (globalThis as any)?.localStorage;
      if (ls && typeof ls.getItem === 'function') {
        return ls.getItem(ROLE_KEY) || null;
      }
    } catch {
      return null;
    }
    return null;
  } else {
    try {
      return await SecureStore.getItemAsync(ROLE_KEY);
    } catch {
      return null;
    }
  }
}

export async function clearAuth() {
  if (isWeb) {
    try {
      const ls = (globalThis as any)?.localStorage;
      if (ls && typeof ls.removeItem === 'function') {
        ls.removeItem(TOKEN_KEY);
        ls.removeItem(REFRESH_TOKEN_KEY);
        ls.removeItem(ROLE_KEY);
        ls.removeItem(USER_PROFILE_KEY);
        ls.removeItem('access_token');
      }
    } catch {
      // Игнорируем ошибки
    }
  } else {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(ROLE_KEY);
      await SecureStore.deleteItemAsync(USER_PROFILE_KEY);
    } catch {
      // Игнорируем ошибки
    }
  }
}

export function extractTokenFromResponse(data: any): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  return (
    data.token ||
    data.access_token ||
    data.accessToken ||
    data.jwt ||
    data?.data?.token ||
    data?.data?.access_token ||
    data?.data?.accessToken
  );
}

export function extractRefreshTokenFromResponse(data: any): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  return (
    data.refreshToken ||
    data.refresh_token ||
    data.refresh ||
    data?.data?.refreshToken ||
    data?.data?.refresh_token ||
    data?.data?.refresh
  );
}

export function extractUserFromResponse(data: any): UserProfile | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const user = data.user ?? data.data?.user ?? data.data ?? (data.id ? data : null);
  if (!user || typeof user !== 'object' || !user.id) return undefined;
  return {
    id: String(user.id),
    email: user.email,
    full_name: user.full_name ?? user.fullName ?? user.name,
    phone: user.phone,
    role: user.role,
    avatar_url: user.avatar_url ?? user.avatarUrl,
    bio: user.bio,
  };
}


