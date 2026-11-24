/** Only local routes may be used as a destination after authentication. */
export function safeAuthRedirect(value?: string): string | undefined {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return undefined;
  return value;
}

export function creatorEntryPath(kind: 'event' | 'article', isAuthedTutor: boolean): string {
  const destination = `/profile?open=${kind}`;
  return isAuthedTutor ? destination : `/login?role=tutor&showLogin=1&redirect=${encodeURIComponent(destination)}`;
}

export function withAuthRedirect(path: string, redirect?: string): string {
  const destination = safeAuthRedirect(redirect);
  return destination ? `${path}${path.includes('?') ? '&' : '?'}redirect=${encodeURIComponent(destination)}` : path;
}
