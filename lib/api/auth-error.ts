import { API_BASE } from '@/constants/env';
import { clearAuth, getAuthRole, getRefreshToken, saveAuthToken } from '@/lib/auth';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

async function attemptRefresh(): Promise<boolean> {
  try {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return false;
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    const newAccess =
      data?.access_token ?? data?.accessToken ?? data?.token ??
      data?.data?.access_token ?? data?.data?.accessToken;
    if (!newAccess) return false;
    const newRefresh = data?.refresh_token ?? data?.refreshToken ?? refreshToken;
    const role = await getAuthRole();
    await saveAuthToken(newAccess, role ?? undefined, newRefresh);
    return true;
  } catch {
    return false;
  }
}

/** Обработка 401: сначала пытается обновить токен, только при неудаче — разлогинивает */
export async function handle401(res: Response, payload?: unknown): Promise<never> {
  const refreshed = await attemptRefresh();
  if (!refreshed) {
    await clearAuth();
  }
  const msg =
    payload !== undefined
      ? (typeof payload === 'string' ? payload : (payload as any)?.message ?? (payload as any)?.error ?? 'Требуется авторизация')
      : 'Требуется авторизация';
  throw new AuthError(msg);
}
