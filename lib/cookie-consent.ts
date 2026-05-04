import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'cookie_consent_accepted';
const isWeb = Platform.OS === 'web';

export async function isCookieConsentAccepted(): Promise<boolean> {
  if (isWeb) {
    try { return (globalThis as any)?.localStorage?.getItem(KEY) === '1'; } catch { return false; }
  }
  try { return (await SecureStore.getItemAsync(KEY)) === '1'; } catch { return false; }
}

export async function acceptCookieConsent(): Promise<void> {
  if (isWeb) {
    try { (globalThis as any)?.localStorage?.setItem(KEY, '1'); } catch {}
  } else {
    try { await SecureStore.setItemAsync(KEY, '1'); } catch {}
  }
}
