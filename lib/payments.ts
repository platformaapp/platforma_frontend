import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const CARD_LINKED_KEY = 'payment_card_linked';
const CARD_MASKED_KEY = 'payment_card_masked';
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

export async function setCardLinked(isLinked: boolean, cardMasked?: string): Promise<void> {
  const value = isLinked ? 'true' : 'false';
  if (isWeb) {
    try {
      const ls = (globalThis as any)?.localStorage;
      if (ls && typeof ls.setItem === 'function') {
        ls.setItem(CARD_LINKED_KEY, value);
        if (isLinked && cardMasked) ls.setItem(CARD_MASKED_KEY, cardMasked);
        else ls.removeItem(CARD_MASKED_KEY);
      }
    } catch {
      // ignore
    }
    return;
  }

  try {
    await SecureStore.setItemAsync(CARD_LINKED_KEY, value);
    if (isLinked && cardMasked) await SecureStore.setItemAsync(CARD_MASKED_KEY, cardMasked);
    else await SecureStore.deleteItemAsync(CARD_MASKED_KEY);
  } catch {
    // ignore
  }
}

export async function getCardMasked(): Promise<string | null> {
  if (isWeb) {
    try {
      const ls = (globalThis as any)?.localStorage;
      if (ls && typeof ls.getItem === 'function') {
        return ls.getItem(CARD_MASKED_KEY);
      }
    } catch {
      return null;
    }
    return null;
  }
  try {
    return await SecureStore.getItemAsync(CARD_MASKED_KEY);
  } catch {
    return null;
  }
}
