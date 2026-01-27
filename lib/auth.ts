import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';
const ROLE_KEY = 'auth_role';

const isWeb = Platform.OS === 'web';

export async function saveAuthToken(token: string, role?: string) {
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
        ls.removeItem(ROLE_KEY);
        ls.removeItem('access_token');
      }
    } catch {
      // Игнорируем ошибки
    }
  } else {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(ROLE_KEY);
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


