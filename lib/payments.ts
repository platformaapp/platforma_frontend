import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const CARD_LINKED_KEY = 'payment_card_linked';
const isWeb = Platform.OS === 'web';

export async function getCardLinked(): Promise<boolean> {
  if (isWeb) {
    try {
      const ls = (globalThis as any)?.localStorage;
      if (ls && typeof ls.getItem === 'function') {
        return ls.getItem(CARD_LINKED_KEY) === 'true';
      }
    } catch {
      return false;
    }
    return false;
  }

  try {
    const value = await SecureStore.getItemAsync(CARD_LINKED_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

export async function setCardLinked(isLinked: boolean): Promise<void> {
  const value = isLinked ? 'true' : 'false';
  if (isWeb) {
    try {
      const ls = (globalThis as any)?.localStorage;
      if (ls && typeof ls.setItem === 'function') {
        ls.setItem(CARD_LINKED_KEY, value);
      }
    } catch {
      // ignore
    }
    return;
  }

  try {
    await SecureStore.setItemAsync(CARD_LINKED_KEY, value);
  } catch {
    // ignore
  }
}
