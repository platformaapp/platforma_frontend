import { router } from 'expo-router';

import { API_BASE } from '@/constants/env';
import { getAuthRole, getAuthToken, getRefreshToken, saveAuthToken } from './auth';

// Single in-flight refresh — all concurrent 401s share the same promise
let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  const newAccess =
    data?.access_token ?? data?.accessToken ?? data?.token ??
    data?.data?.access_token ?? data?.data?.accessToken;
  const newRefresh =
    data?.refresh_token ?? data?.refreshToken ?? refreshToken;

  if (!newAccess) return null;

  const role = await getAuthRole();
  await saveAuthToken(newAccess, role ?? undefined, newRefresh);
  return newAccess;
}

function tryRefresh(): Promise<string | null> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => { refreshing = null; });
  }
  return refreshing;
}

/**
 * Drop-in replacement for fetch() for authenticated requests.
 * On 401: silently refreshes the access token and retries once.
 * Only redirects to /login if refresh also fails.
 */
export async function authedFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAuthToken();
  const withAuth = (t: string): RequestInit => ({
    ...init,
    headers: { ...(init.headers as Record<string, string> ?? {}), Authorization: `Bearer ${t}` },
  });

  const res = await fetch(url, token ? withAuth(token) : init);
  if (res.status !== 401) return res;

  const newToken = await tryRefresh();
  if (!newToken) {
    router.replace('/login' as any);
    return res;
  }

  return fetch(url, withAuth(newToken));
}
