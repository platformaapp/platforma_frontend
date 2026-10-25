/**
 * Минимальный инлайн-форматтер для текста статьи — не полноценный markdown,
 * а фиксированный набор пар-разделителей, которые вставляет тулбар в
 * admin/journal-detail.tsx (см. TOOLBAR_ACTIONS там). Рекурсивно: каждый
 * раз ищем САМОЕ РАННЕЕ по тексту совпадение среди всех правил (а не
 * применяем их по очереди ко всей строке) — это то, что корректно отличает
 * **жирный** от *курсива* (у жирного совпадение начинается раньше: индекс 0
 * против индекса 1 для `**bold**`), без отдельной приоритетной логики.
 */
import React from 'react';
import { Linking, Text, type TextStyle } from 'react-native';

type InlineRule = {
  re: RegExp;
  isLink?: boolean;
  style?: TextStyle;
};

const RULES: InlineRule[] = [
  { re: /\[([^\]]+)\]\(([^)\s]+)\)/, isLink: true },
  { re: /\*\*([^*]+?)\*\*/, style: { fontWeight: 'bold' } },
  { re: /__([^_]+?)__/, style: { textDecorationLine: 'underline' } },
  { re: /~~([^~]+?)~~/, style: { textDecorationLine: 'line-through' } },
  { re: /==([^=]+?)==/, style: { backgroundColor: '#FDE1E1', color: '#000' } },
  { re: /\{\+([^+]+?)\+\}/, style: { fontSize: 22 } },
  { re: /\{-([^-]+?)-\}/, style: { fontSize: 14 } },
  { re: /\*([^*]+?)\*/, style: { fontStyle: 'italic' } },
];

const linkStyle: TextStyle = { color: '#E02D2D', textDecorationLine: 'underline' };

export function parseInlineMarkdown(text: string, keyPrefix = 'n'): React.ReactNode[] {
  if (!text) return [];

  let earliestIndex = -1;
  let earliestMatch: RegExpMatchArray | null = null;
  let earliestRule: InlineRule | null = null;
  for (const rule of RULES) {
    const m = text.match(rule.re);
    if (m && m.index != null && (earliestIndex === -1 || m.index < earliestIndex)) {
      earliestIndex = m.index;
      earliestMatch = m;
      earliestRule = rule;
    }
  }

  if (!earliestMatch || earliestRule == null) return [text];

  const before = text.slice(0, earliestIndex);
  const after = text.slice(earliestIndex + earliestMatch[0].length);
  const nodes: React.ReactNode[] = [];
  if (before) nodes.push(...parseInlineMarkdown(before, `${keyPrefix}b`));

  if (earliestRule.isLink) {
    const label = earliestMatch[1];
    const url = earliestMatch[2];
    nodes.push(
      <Text
        key={`${keyPrefix}m`}
        style={linkStyle}
        onPress={() => Linking.openURL(url)}
        {...({ dataSet: { textLink: 'true' } } as any)}
      >
        {parseInlineMarkdown(label, `${keyPrefix}mi`)}
      </Text>
    );
  } else {
    nodes.push(
      <Text key={`${keyPrefix}m`} style={earliestRule.style}>
        {parseInlineMarkdown(earliestMatch[1], `${keyPrefix}mi`)}
      </Text>
    );
  }

  if (after) nodes.push(...parseInlineMarkdown(after, `${keyPrefix}a`));
  return nodes;
}
