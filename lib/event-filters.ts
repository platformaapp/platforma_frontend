export const EVENT_FORMATS = [
  { slug: 'broadcast', label: 'Трансляция' },
  { slug: 'lecture', label: 'Лекция' },
  { slug: 'mediation', label: 'Медиация' },
  { slug: 'practices', label: 'Практика' },
  { slug: 'meeting', label: 'Встреча' },
  { slug: 'discussion', label: 'Обсуждение' },
];

export function eventFormatSlug(value?: string | null): string | undefined {
  return EVENT_FORMATS.find(f => f.slug === value || f.label === value)?.slug;
}
export function eventFormatLabel(value?: string | null): string | undefined {
  return EVENT_FORMATS.find(f => f.slug === value || f.label === value)?.label;
}
export function eventFilterPath(kind: 'tag' | 'format', value: string): string {
  return `/events?${kind}=${encodeURIComponent(kind === 'format' ? eventFormatSlug(value) || value : value)}`;
}
export function parseTags(value: string): string[] {
  return [...new Set(value.split(/[,;\n]/).map(t => t.trim().replace(/^#+/, '').trim()).filter(Boolean))];
}
