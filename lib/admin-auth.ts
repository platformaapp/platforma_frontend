import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'admin_token';
const isWeb = Platform.OS === 'web';

export async function getAdminToken(): Promise<string | null> {
  if (isWeb) {
    try { return (globalThis as any)?.localStorage?.getItem(KEY) ?? null; } catch { return null; }
  }
  try { return await SecureStore.getItemAsync(KEY); } catch { return null; }
}

export async function saveAdminToken(token: string): Promise<void> {
  if (isWeb) {
    try { (globalThis as any)?.localStorage?.setItem(KEY, token); } catch {}
  } else {
    try { await SecureStore.setItemAsync(KEY, token); } catch {}
  }
}

export async function clearAdminToken(): Promise<void> {
  if (isWeb) {
    try { (globalThis as any)?.localStorage?.removeItem(KEY); } catch {}
  } else {
    try { await SecureStore.deleteItemAsync(KEY); } catch {}
  }
}
