import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { endpoints } from '@/constants/env';
import { getAdminToken } from '@/lib/admin-auth';

export type EventSeoSettings = {
  slug?: string;
  meta_title?: string | null;
  meta_description?: string | null;
  og_image?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  canonical_url?: string | null;
  noindex?: boolean;
  nofollow?: boolean;
  published_at?: string;
  updated_at?: string;
  excerpt?: string | null;
  cover_alt?: string | null;
};

const FIELDS = [
  [
    'slug',
    'Slug',
    'Латиница, цифры и дефисы. Адрес /events/slug; старые ссылки продолжат работать.',
    200,
  ],
  [
    'meta_title',
    'Meta title',
    'Заголовок для вкладки и поиска. Рекомендуется до 60 символов; H1 события не меняется.',
    255,
  ],
  [
    'meta_description',
    'Meta description',
    'Описание для поисковой выдачи. Рекомендуется 150–160 символов.',
    500,
  ],
  [
    'og_image',
    'OG image',
    'Полный HTTP(S) URL изображения для превью. Если пусто — обложка события.',
    2000,
  ],
  [
    'og_title',
    'OG title',
    'Заголовок превью в соцсетях. Если пусто — meta title или название.',
    255,
  ],
  [
    'og_description',
    'OG description',
    'Описание превью в соцсетях. Если пусто — meta description или описание.',
    500,
  ],
  [
    'canonical_url',
    'Canonical URL',
    'Полный URL оригинала. Используйте для дублей, а не просто похожих по теме событий.',
    2000,
  ],
  [
    'excerpt',
    'Краткое описание для карточки',
    'Отдельный текст для ленты; не заменяет meta description.',
    500,
  ],
  [
    'cover_alt',
    'Alt обложки',
    'Опишите, что изображено на обложке. Используется для доступности и поиска по картинкам.',
    1000,
  ],
  [
    'published_at',
    'Дата публикации',
    'Дата и время в ISO 8601, например 2026-11-21T10:00:00Z. Не меняет дату самого события.',
    40,
  ],
] as const;

export function EventSeoEditor({
  id,
  initial,
  onSaved,
}: {
  id: string;
  initial: EventSeoSettings;
  onSaved: (settings: EventSeoSettings) => void;
}) {
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function save() {
    setError('');
    setMessage('');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug?.trim() || '')) {
      setError('Укажите slug: латиница, цифры и дефисы');
      return;
    }
    for (const key of ['og_image', 'canonical_url'] as const) {
      if (!values[key]?.trim()) continue;
      try {
        const url = new URL(values[key]!.trim());
        if (!['https:', 'http:'].includes(url.protocol)) throw new Error();
      } catch {
        setError(`Укажите полный HTTP(S) URL в поле ${key}`);
        return;
      }
    }
    if (
      values.published_at &&
      !Number.isFinite(Date.parse(values.published_at))
    ) {
      setError('Проверьте дату публикации');
      return;
    }
    setSaving(true);
    try {
      const token = await getAdminToken();
      const body = Object.fromEntries(
        FIELDS.map(([key]) => [
          key,
          values[key]?.trim() || (key === 'published_at' ? undefined : null),
        ]),
      );
      const response = await fetch(`${endpoints.adminEventsAdmin}/${id}/seo`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...body,
          noindex: !!values.noindex,
          nofollow: !!values.nofollow,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join('\n')
            : data.message || 'Не удалось сохранить SEO',
        );
      setValues(data);
      onSaved(data);
      setMessage('SEO-настройки сохранены');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>SEO события</Text>
      {FIELDS.map(([key, label, hint, limit]) => (
        <View key={key} style={styles.field}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            accessibilityLabel={label}
            style={styles.input}
            value={values[key] ?? ''}
            onChangeText={(value) =>
              setValues((previous) => ({ ...previous, [key]: value }))
            }
            autoCapitalize="none"
            multiline={[
              'meta_description',
              'og_description',
              'excerpt',
              'cover_alt',
            ].includes(key)}
            maxLength={limit}
          />
          <Text style={styles.hint}>
            {hint}
            {['meta_title', 'meta_description'].includes(key)
              ? ` (${(values[key] || '').length} символов)`
              : ''}
          </Text>
        </View>
      ))}
      {values.og_image ? (
        <Image
          accessibilityLabel="Превью OG image"
          source={{ uri: values.og_image }}
          style={styles.preview}
          resizeMode="contain"
        />
      ) : null}
      {(['noindex', 'nofollow'] as const).map((key) => (
        <View key={key} style={styles.toggle}>
          <Text style={styles.label}>
            {key === 'noindex'
              ? 'Noindex — исключить событие из индекса'
              : 'Nofollow — не передавать вес ссылкам'}
          </Text>
          <Switch
            accessibilityLabel={key}
            value={!!values[key]}
            onValueChange={(value) =>
              setValues((previous) => ({ ...previous, [key]: value }))
            }
          />
        </View>
      ))}
      <Text style={styles.hint}>
        Теги редактируются в форме правок события. Автор и мини-био берутся из
        профиля наставника.
      </Text>
      {values.updated_at ? (
        <Text style={styles.hint}>
          Обновлено: {new Date(values.updated_at).toLocaleString('ru-RU')}
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}
      <Pressable style={styles.button} onPress={save} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Сохранить SEO</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { padding: 16, borderBottomWidth: 1, borderColor: '#E5E5E5' },
  heading: { fontFamily: 'Gramatika-Regular', fontSize: 18, marginBottom: 16 },
  field: { marginBottom: 16 },
  label: { fontStyle: 'normal',
    fontFamily: 'Gramatika-Regular',
    fontSize: 14,
    color: '#687076',
    flexShrink: 1,
  },
  input: {
    fontFamily: 'Gramatika-Regular',
    fontSize: 14,
    borderBottomWidth: 1,
    borderColor: '#E5E5E5',
    paddingVertical: 10,
    color: '#181818',
  },
  hint: {
    fontFamily: 'Gramatika-Regular',
    fontSize: 12,
    lineHeight: 17,
    color: '#687076',
    fontStyle: 'italic',
    marginTop: 6,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginVertical: 10,
  },
  preview: { width: '100%', height: 160 },
  error: { color: '#E02D2D', marginTop: 12 },
  success: { color: '#228B22', marginTop: 12 },
  button: {
    backgroundColor: '#181818',
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: { fontFamily: 'Gramatika-Regular', color: '#fff', fontSize: 14 },
});
