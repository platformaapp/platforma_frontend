import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';
const ROLE_KEY = 'auth_role';

export async function saveAuthToken(token: string, role?: string) {
  if (token) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
  if (role) {
    await SecureStore.setItemAsync(ROLE_KEY, role);
  }
}

export async function getAuthToken() {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getAuthRole() {
  return await SecureStore.getItemAsync(ROLE_KEY);
}

export async function clearAuth() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(ROLE_KEY);
}

export function extractTokenFromResponse(data: any): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  return (
    data.token ||
    data.accessToken ||
    data.jwt ||
    data?.data?.token ||
    data?.data?.accessToken
  );
}


