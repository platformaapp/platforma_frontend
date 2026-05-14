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
    credentials: 'include',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  const newAccess =
    data?.access_token ?? data?.accessToken ?? data?.token ??
    data?.data?.access_token ?? data?.data?.accessToken ??
    res.headers.get('New-Access-Token') ?? null;
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

/** If the response contains a New-Access-Token header, persist it immediately. */
async function applyNewAccessToken(res: Response): Promise<void> {
  const newToken = res.headers.get('New-Access-Token');
  if (!newToken) return;
  const role = await getAuthRole();
  await saveAuthToken(newToken, role ?? undefined);
}

/**
 * Drop-in replacement for fetch() for authenticated requests.
 * - Adds Authorization header with current access token.
 * - Sends cookies (credentials: 'include') on every request.
 * - Reads New-Access-Token response header and persists new token if present.
 * - On 401: silently refreshes the access token and retries once.
 * - Only redirects to /login if refresh also fails.
 */
export async function authedFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAuthToken();
  const withAuth = (t: string): RequestInit => ({
    ...init,
    credentials: 'include',
    headers: { ...(init.headers as Record<string, string> ?? {}), Authorization: `Bearer ${t}` },
  });
  const withoutAuth: RequestInit = { ...init, credentials: 'include' };

  const res = await fetch(url, token ? withAuth(token) : withoutAuth);

  // Persist rotated access token sent by the server
  await applyNewAccessToken(res);

  if (res.status !== 401) return res;

  const newToken = await tryRefresh();
  if (!newToken) {
    router.replace('/login' as any);
    return res;
  }

  const retryRes = await fetch(url, withAuth(newToken));
  await applyNewAccessToken(retryRes);
  return retryRes;
}
