#!/usr/bin/env node

/**
 * Генерирует sitemap.xml на этапе сборки (после `expo export --platform web`,
 * до загрузки dist/ на сервер — см. .github/workflows/deploy.yml).
 *
 * Сайт собирается как статический SPA-шелл (app.json: web.output = "static",
 * .htaccess/_redirects переписывают ЛЮБОЙ путь на /index.html) — у бэкенда
 * нет SSR, поэтому сам фронтенд не может отдать актуальный sitemap по
 * запросу. Вместо этого на каждой сборке мы один раз обходим публичное API
 * (статьи/события/наставники) и пишем готовый статический sitemap.xml рядом
 * с остальным dist/ — он остаётся верным до следующего деплоя.
 *
 * Запуск: node scripts/generate-sitemap.js [outDir] — по умолчанию outDir = dist.
 * SITE_BASE_URL — домен сайта в самом sitemap (по умолчанию EXPO_PUBLIC_API_BASE,
 * т.к. сайт и API на одном домене — см. constants/env.ts).
 */

const fs = require('fs');
const path = require('path');

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://platformaapp.ru';
const SITE_BASE_URL = (process.env.SITE_BASE_URL || API_BASE).replace(/\/+$/, '');
const outDir = process.argv[2] || 'dist';

// changefreq/priority — не влияют критично на индексацию (Google их давно
// игнорирует), но Яндекс и валидаторы всё ещё на них смотрят, оставляем
// разумные дефолты по типу страницы.
const STATIC_ROUTES = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/journal', changefreq: 'daily', priority: '0.8' },
  { loc: '/events', changefreq: 'daily', priority: '0.8' },
  { loc: '/explore', changefreq: 'weekly', priority: '0.8' },
  { loc: '/about-us', changefreq: 'monthly', priority: '0.5' },
  { loc: '/contacts', changefreq: 'monthly', priority: '0.4' },
];

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

// Бэкенд отдаёт списки то массивом, то {data:[...]}, то {items:[...]} —
// см. тот же разбор в lib/api/journal.ts/lib/api/tutor.ts.
function itemsOf(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function fetchAllPages(baseUrl, perPage) {
  const all = [];
  let page = 1;
  // Защита от бесконечного цикла, если бэкенд не поддерживает пагинацию —
  // максимум 50 страниц (с per_page=200 это 10000 материалов, с запасом).
  for (; page <= 50; page++) {
    const payload = await fetchJson(`${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${page}&per_page=${perPage}`);
    const items = itemsOf(payload);
    all.push(...items);
    const total = payload?.pagination?.total ?? payload?.meta?.total;
    if (items.length < perPage) break;
    if (typeof total === 'number' && all.length >= total) break;
  }
  return all;
}

function xmlEscape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

function urlEntry(loc, { changefreq, priority, lastmod } = {}) {
  const lines = [`    <loc>${xmlEscape(SITE_BASE_URL + loc)}</loc>`];
  if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) lines.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) lines.push(`    <priority>${priority}</priority>`);
  return `  <url>\n${lines.join('\n')}\n  </url>`;
}

function isoDate(raw) {
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

async function main() {
  const entries = STATIC_ROUTES.map((r) => urlEntry(r.loc, r));

  const sections = [
    { name: 'статьи журнала', listUrl: `${API_BASE}/api/articles`, perPage: 100, toEntry: (a) => urlEntry(`/journal/${a.id}`, { changefreq: 'monthly', priority: '0.6', lastmod: isoDate(a.updated_at) }) },
    { name: 'события', listUrl: `${API_BASE}/api/events/feed`, perPage: 100, toEntry: (e) => urlEntry(`/events/${e.id}`, { changefreq: 'weekly', priority: '0.6', lastmod: isoDate(e.updated_at) }) },
    { name: 'наставники', listUrl: `${API_BASE}/api/users/tutors`, perPage: 200, toEntry: (t) => urlEntry(`/explore/${t.id}`, { changefreq: 'monthly', priority: '0.5' }) },
  ];

  for (const section of sections) {
    try {
      const items = await fetchAllPages(section.listUrl, section.perPage);
      for (const item of items) {
        if (!item?.id) continue;
        entries.push(section.toEntry(item));
      }
      console.log(`[sitemap] ${section.name}: ${items.length}`);
    } catch (err) {
      // Не валим сборку из-за недоступности бэкенда в момент деплоя —
      // лучше sitemap без одного раздела, чем сорванный деплой сайта.
      console.warn(`[sitemap] не удалось получить "${section.name}" (${section.listUrl}): ${err.message}`);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'sitemap.xml');
  fs.writeFileSync(outPath, xml, 'utf8');
  console.log(`[sitemap] записано ${entries.length} адресов -> ${outPath}`);
}

main().catch((err) => {
  console.error('[sitemap] ошибка генерации:', err);
  process.exit(1);
});
