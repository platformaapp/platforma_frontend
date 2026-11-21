#!/usr/bin/env node
/** Build crawlable HTML and a manifest for every canonical public page. */
const fs = require('node:fs');
const path = require('node:path');
const { eventPath, mentorPath } = require('../lib/public-paths');
const { PUBLIC_PAGES, isPrivatePath } = require('../lib/seo-routes');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plain = value => String(value || '').replace(/<[^>]*>/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[#*_]/g, '').trim();
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
const MANIFEST = '_seo-manifest.json';

async function collection(api, endpoint) {
  const found = new Map();
  for (let page = 1; page <= 1000; page++) {
    const response = await fetch(`${api}${endpoint}?page=${page}&per_page=100&limit=100&include_past=true`, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`);
    const payload = await response.json();
    const items = Array.isArray(payload) ? payload : payload.items ?? payload.data;
    if (!Array.isArray(items)) throw new Error(`${endpoint}: invalid list response`);
    let added = 0;
    for (const item of items) {
      if (!item.id) throw new Error(`${endpoint}: item without an ID`);
      if (!found.has(item.id)) { found.set(item.id, item); added++; }
    }
    const pagination = payload.pagination ?? payload.meta;
    const total = pagination?.total;
    if (Array.isArray(payload) || pagination?.hasNext === false || (typeof total === 'number' && found.size >= total)) return [...found.values()];
    if (!items.length || !added) {
      if (pagination?.hasNext === true || (typeof total === 'number' && found.size < total)) throw new Error(`${endpoint}: pagination stopped before all items were fetched`);
      return [...found.values()];
    }
    if (pagination?.hasNext !== true && typeof total !== 'number' && items.length < 100) return [...found.values()];
  }
  throw new Error(`${endpoint}: exceeded 1000 pages; refusing to publish an incomplete index`);
}

function metadata(html, { title, description, canonical, image, schema, noindex, nofollow }) {
  html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*(?:name=["'](?:description|robots|twitter:[^"']*)["']|property=["']og:[^"']*["'])[^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '');
  const robots = `${noindex ? 'noindex' : 'index'},${nofollow ? 'nofollow' : 'follow'}`;
  const head = `<title>${esc(title)}</title><meta name="description" content="${esc(description.slice(0, 160))}"><link rel="canonical" href="${esc(canonical)}"><meta name="robots" content="${robots}"><meta property="og:site_name" content="p(34)"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description.slice(0, 160))}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="${schema?.['@type'] === 'Article' ? 'article' : schema?.['@type'] === 'Person' ? 'profile' : 'website'}"><meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">${image ? `<meta property="og:image" content="${esc(image)}">` : ''}${schema ? `<script type="application/ld+json">${json({ '@context': 'https://schema.org', ...schema, url: canonical })}</script>` : ''}`;
  return html.replace('</head>', head.replace(/<(title|meta|link|script)\b/g, '<$1 data-rh="true"') + '</head>');
}

function fallback(html, { heading, description, image, body, route }) {
  html = html.replace(/<main id="seo-content"[^>]*>[\s\S]*?<\/main>/g, '').replace(/<script id="seo-fallback-cleanup"[^>]*>[\s\S]*?<\/script>/g, '');
  const content = `<main id="seo-content" style="position:fixed;inset:0;overflow:auto;background:white;z-index:1;padding:32px;font:18px/1.5 sans-serif"><h1>${esc(heading)}</h1>${image ? `<img src="${esc(image)}" alt="${esc(heading)}" style="max-width:339px;width:100%">` : ''}<p>${esc(description).replace(/\n/g, '<br>')}</p>${body}</main>`;
  const script = `<script id="seo-fallback-cleanup">(function(){function ready(){var root=document.getElementById('root'),fallback=document.getElementById('seo-content');if(root&&fallback){var text=root.textContent.replace(/\\s+/g,' ').trim();var heading=${json(heading)}.replace(/\\s+/g,' ').trim();if(location.pathname.replace(/\\/$/,'')!==${json(route === '/' ? '' : route)}||(text.includes(heading)&&!/Failed to fetch|Не удалось|Ошибка загрузки/i.test(text)&&!root.querySelector('[role="progressbar"]'))){fallback.remove();observer.disconnect();}}}var observer=new MutationObserver(ready);observer.observe(document.documentElement,{childList:true,subtree:true});ready();})();</script>`;
  return html.replace(/(<body[^>]*>)/, '$1' + content).replace('</body>', script + '</body>');
}
function pageLinks(items, route, title) {
  return `<ul>${items.map(item => `<li><a href="${esc(route(item))}">${esc(title(item))}</a></li>`).join('')}</ul>`;
}

async function generatePublicPages(out = 'dist') {
  const api = (process.env.EXPO_PUBLIC_API_BASE || 'https://platformaapp.ru').replace(/\/+$/, '');
  const site = (process.env.SITE_BASE_URL || 'https://platformaapp.ru').replace(/\/+$/, '');
  const [articles, events, mentors] = await Promise.all([
    collection(api, '/api/articles'), collection(api, '/api/events/feed'), collection(api, '/api/users/tutors'),
  ]);
  for (const article of articles) {
    if (!article.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) throw new Error(`Article ${article.id}: missing or invalid slug`);
  }
  const articlePath = article => `/journal/${article.slug}`;
  const name = mentor => mentor.fullName || mentor.full_name || mentor.name || 'Наставник';
  const navigation = `<nav aria-label="Разделы сайта">${PUBLIC_PAGES.map(page => `<a href="${page.path}">${esc(page.heading)}</a>`).join(' · ')}</nav>`;
  const manifest = [];
  const redirects = [];
  const apacheRedirects = [];
  const templates = new Map();
  function template(file) {
    if (!templates.has(file)) templates.set(file, fs.readFileSync(path.join(out, file), 'utf8'));
    return templates.get(file);
  }
  // Capture templates before root/list pages are overwritten.
  for (const page of PUBLIC_PAGES) template(page.template);
  for (const file of ['events/[id].html', 'explore/[id].html', 'journal/[slug].html']) template(file);

  function write(route, file, options) {
    const canonical = options.canonical || site + route;
    const image = options.image ? new URL(options.image, site).href : undefined;
    let html = metadata(template(file), { ...options, canonical, image });
    if (options.body !== undefined) html = fallback(html, { ...options, image, route, body: navigation + options.body });
    const outputFile = route === '/' ? 'index.html' : route.slice(1) + '/index.html';
    const target = path.join(out, outputFile);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, html);
    if (route !== '/') fs.writeFileSync(path.join(out, route.slice(1) + '.html'), html);
    manifest.push({ path: route, canonical, noindex: !!options.noindex, lastmod: options.lastmod, file: outputFile });
    redirects.push(`${route} ${route === '/' ? '/index.html' : route + '/index.html'} 200`);
  }
  function alias(from, to) {
    redirects.unshift(`${from} ${to} 301`);
    apacheRedirects.push(`RewriteRule ^${from.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$ ${to} [R=301,L]`);
  }
  for (const page of PUBLIC_PAGES) {
    let body;
    if (page.path === '/events') body = pageLinks(events, eventPath, e => e.title);
    if (page.path === '/explore') body = pageLinks(mentors, mentorPath, name);
    if (page.path === '/journal') body = pageLinks(articles.filter(a => !a.noindex), articlePath, a => a.title);
    if (page.path === '/') body = '<h2>События</h2>' + pageLinks(events, eventPath, e => e.title) + '<h2>Наставники</h2>' + pageLinks(mentors, mentorPath, name) + '<h2>Журнал</h2>' + pageLinks(articles.filter(a => !a.noindex), articlePath, a => a.title);
    write(page.path, page.template, { ...page, body });
  }
  for (const a of articles) {
    const author = a.author;
    write(articlePath(a), 'journal/[slug].html', {
      title: a.seo_title || a.title, heading: a.h1 || a.title, description: plain(a.meta_description || a.excerpt || a.content) || a.title, image: a.cover_url,
      canonical: a.canonical_url || undefined, noindex: a.noindex, nofollow: a.nofollow, lastmod: a.updated_at,
      body: `<article>${author ? `<p>Автор: <a href="${esc(mentorPath(author))}">${esc(name(author))}</a></p>` : ''}<p>${esc(plain(a.content)).replace(/\n/g, '<br>')}</p></article>`,
      schema: { '@type': 'Article', headline: a.h1 || a.title, description: plain(a.excerpt || a.content).slice(0, 300), ...(a.published_at ? { datePublished: a.published_at } : {}), ...(a.updated_at ? { dateModified: a.updated_at } : {}), ...(author ? { author: { '@type': 'Person', name: name(author), url: site + mentorPath(author) } } : {}) },
    });
  }
  for (const e of events) {
    const route = eventPath(e), date = e.datetimeStart || e.datetime_start, mentor = e.mentor;
    write(route, 'events/[id].html', {
      title: e.title, heading: e.title, description: plain(e.description) || e.title, image: e.coverUrl || e.cover_url, lastmod: e.updated_at,
      body: `${date ? `<p><time datetime="${esc(date)}">${esc(date)}</time></p>` : ''}${mentor ? `<a href="${esc(mentorPath(mentor))}">${esc(name(mentor))}</a>` : ''}`,
      schema: { '@type': 'Event', name: e.title, description: plain(e.description), ...(date ? { startDate: date } : {}), eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode', location: { '@type': 'VirtualLocation', url: site + route }, ...(mentor ? { organizer: { '@type': 'Person', name: name(mentor), url: site + mentorPath(mentor) } } : {}) },
    });
    alias(`/events/${e.id}`, route);
  }
  for (const m of mentors) {
    const route = mentorPath(m), related = events.filter(e => e.mentor?.id === m.id);
    write(route, 'explore/[id].html', { title: name(m), heading: name(m), description: plain(m.bio || m.shortBio || m.short_bio || m.specialization) || name(m), image: m.avatarUrl || m.avatar_url,
      schema: { '@type': 'Person', name: name(m), description: plain(m.bio || m.shortBio || m.specialization) },
      body: related.length ? '<h2>События наставника</h2>' + pageLinks(related, eventPath, e => e.title) : '',
    });
    alias(`/explore/${m.id}`, route);
  }
  // Private screens and unresolved route templates must never become search results.
  function protect(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (!['_expo', 'assets'].includes(entry.name)) protect(file); continue; }
      if (!entry.name.endsWith('.html')) continue;
      const route = '/' + path.relative(out, file).replace(/\\/g, '/').replace(/(?:\/index)?\.html$/, '');
      if (isPrivatePath(route) || entry.name === '+not-found.html') {
        const html = fs.readFileSync(file, 'utf8').replace(/<meta\b[^>]*name=["']robots["'][^>]*>/gi, '');
        fs.writeFileSync(file, html.replace('</head>', '<meta data-rh="true" name="robots" content="noindex,nofollow"></head>'));
      }
    }
  }
  protect(out);
  fs.writeFileSync(path.join(out, '_redirects'), redirects.join('\n') + '\n/* /index.html 200\n');
  const htaccess = path.join(out, '.htaccess');
  if (fs.existsSync(htaccess)) {
    const rules = fs.readFileSync(htaccess, 'utf8').replace(/\n# BEGIN SEO REDIRECTS[\s\S]*?# END SEO REDIRECTS\n?/g, '');
    fs.writeFileSync(htaccess, rules.replace('RewriteEngine On', 'RewriteEngine On\n# BEGIN SEO REDIRECTS\n' + apacheRedirects.join('\n') + '\n# END SEO REDIRECTS\n'));
  }
  fs.writeFileSync(path.join(out, MANIFEST), JSON.stringify({ site, pages: manifest }, null, 2));
  console.log(`Generated SEO HTML: ${PUBLIC_PAGES.length} public pages, ${articles.length} articles, ${events.length} events, ${mentors.length} mentors`);
  return { site, pages: manifest };
}
if (require.main === module) generatePublicPages(process.argv[2] || 'dist').catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { generatePublicPages, collection, MANIFEST };
