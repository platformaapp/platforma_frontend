/** Profile writes must never accept a successful SPA/HTML fallback as saved data. */
export function requireProfile<T extends { id?: string }>(value: unknown): T {
  const raw = value as { data?: unknown; user?: unknown } | null;
  const profile = raw && typeof raw === 'object' ? raw.data ?? raw.user ?? raw : null;
  if (!profile || typeof profile !== 'object' || typeof (profile as { id?: unknown }).id !== 'string' || !(profile as { id: string }).id) {
    throw new Error('Сервер не подтвердил сохранение профиля. Проверьте подключение к API и повторите попытку.');
  }
  return profile as T;
}

/** A 200 response containing the old record is not a confirmation of new edits. */
export function confirmProfileChanges(profile: object, changes: object): void {
  const saved = profile as Record<string, unknown>;
  const requested = changes as Record<string, unknown>;
  const fields = [
    ['fullName', 'full_name'], ['avatarUrl', 'avatar_url'], ['bio'], ['shortBio', 'short_bio'],
    ['telegram'], ['email'], ['phone'], ['specialization'], ['groupMeetings', 'group_meetings'],
  ];
  for (const aliases of fields) {
    const key = aliases.find(name => requested[name] !== undefined);
    if (!key) continue;
    const actualKey = aliases.find(name => saved[name] !== undefined);
    if (String(actualKey ? saved[actualKey] ?? '' : '') !== String(requested[key] ?? '')) {
      throw new Error('Сервер не подтвердил изменения профиля. Повторите попытку.');
    }
  }
}
