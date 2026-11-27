const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { eventPath, mentorPath, publicId } = require('../lib/public-paths');
const { PUBLIC_PAGES } = require('../lib/seo-routes');
const { collection } = require('./generate-public-pages');
const mentor = { id: '22222222-2222-4222-8222-222222222222', name: 'Анна Иванова', bio: 'Биография наставника' };
const event = { id: '11111111-1111-4111-8111-111111111111', title: 'Разговор об искусстве', description: 'Описание <script>alert(1)</script>', datetimeStart: '2026-12-01T12:00:00Z', mentor };
const articles = [
  { id: 'article-1', slug: 'iskusstvo', title: 'Искусство и город', content: 'Полный текст статьи о городе', author: mentor, seo_title: 'Искусство — авторская статья', og_title: 'Превью конкретной статьи', og_description: 'Описание для мессенджера', cover_url: '/api/uploads/article-cover.jpg', updated_at: '2026-11-01T12:00:00Z' },
  { id: 'article-2', slug: 'hidden', title: 'Не индексировать', content: 'Текст', noindex: true },
  { id: 'article-3', slug: 'duplicate', title: 'Копия', content: 'Текст', canonical_url: 'https://other.example/original' },
];
const template = '<html><head><title>Generic</title><meta name="description" content="Generic"><meta name="google-site-verification" content="keep-me"></head><body><div id="root"></div></body></html>';
function fixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'platforma-seo-'));
  for (const file of [...PUBLIC_PAGES.map(page => page.template), 'events/[id].html', 'explore/[id].html', 'journal/[slug].html', 'login.html', 'profile/index.html']) {
    fs.mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true });
    fs.writeFileSync(path.join(tmp, file), template);
  }
  fs.writeFileSync(path.join(tmp, '.htaccess'), 'RewriteEngine On\n');
  return tmp;
}
async function run(script, out, api) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, out, ...(script.endsWith('verify-public-pages.js') ? [api] : [])], { env: { ...process.env, EXPO_PUBLIC_API_BASE: api, SITE_BASE_URL: 'https://example.test' }, stdio: 'pipe' });
    let output = '';
    child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
    child.on('error', reject); child.on('exit', code => resolve({ code, output }));
  });
}
async function serve(handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

test('readable public paths retain UUID identity and support old URLs', () => {
  assert.match(eventPath(event), /^\/events\/razgovor-ob-iskusstve-/);
  assert.equal(publicId(eventPath(event).split('/').pop()), event.id);
  assert.equal(publicId(event.id), event.id);
  assert.match(mentorPath(mentor), /^\/explore\/anna-ivanova-/);
});

test('public catalogs, articles, events and mentors have HTML and a complete canonical sitemap without JavaScript', async () => {
  const tmp = fixture();
  const { server, url } = await serve((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(req.url.startsWith('/api/articles') ? { data: articles, pagination: { total: articles.length } } : req.url.startsWith('/api/events') ? { items: [event], pagination: { hasNext: false } } : [mentor]));
  });
  try {
    const generated = await run('scripts/generate-public-pages.js', tmp, url);
    assert.equal(generated.code, 0, generated.output);
    const sitemap = await run('scripts/generate-sitemap.js', tmp, url);
    assert.equal(sitemap.code, 0, sitemap.output);
    const xml = fs.readFileSync(path.join(tmp, 'sitemap.xml'), 'utf8');
    for (const page of PUBLIC_PAGES) {
      assert.ok(xml.includes(`<loc>https://example.test${page.path}</loc>`), page.path);
      assert.ok(fs.readFileSync(path.join(tmp, page.template), 'utf8').includes(`<title data-rh="true">${page.title}</title>`));
    }
    const html = fs.readFileSync(path.join(tmp, eventPath(event), 'index.html'), 'utf8');
    assert.match(html, /<h1>Разговор об искусстве<\/h1>/);
    assert.ok(html.includes(`rel="canonical" href="https://example.test${eventPath(event)}"`));
    assert.match(html, /"@type":"Event"/);
    assert.ok(html.includes(`href="${mentorPath(mentor)}"`));
    assert.ok(!html.includes('<script>alert(1)</script>'));
    const article = fs.readFileSync(path.join(tmp, 'journal/iskusstvo/index.html'), 'utf8');
    assert.match(article, /property="og:title" content="Превью конкретной статьи"/);
    assert.match(article, /property="og:description" content="Описание для мессенджера"/);
    assert.match(article, /property="og:image" content="https:\/\/example.test\/api\/uploads\/article-cover.jpg"/);
    assert.equal((article.match(/property="og:title"/g) || []).length, 1);
    assert.match(article, /Полный текст статьи о городе/); assert.match(article, /"@type":"Article"/);
    assert.match(article, /<title[^>]*>Искусство — авторская статья<\/title>/);
    // Production routing must return generated metadata, without running JS.
    const { server: published, url: publishedUrl } = await serve((req, res) => {
      const file = path.join(tmp, req.url.replace(/^\//, '') + '.html');
      res.setHeader('Content-Type', 'text/html');
      res.end(fs.readFileSync(file, 'utf8'));
    });
    try {
      const verified = await run('scripts/verify-public-pages.js', tmp, publishedUrl);
      // A local delivery host must still serve the production canonical metadata.
      assert.equal(verified.code, 0, verified.output);
      assert.match(verified.output, /public HTML/);
    } finally { published.close(); }
    const catalog = fs.readFileSync(path.join(tmp, 'journal/index.html'), 'utf8');
    assert.match(catalog, /href="\/journal\/iskusstvo"/);
    assert.ok(xml.includes('/journal/iskusstvo</loc>'));
    assert.ok(!xml.includes('/journal/hidden')); assert.ok(!xml.includes('/journal/duplicate'));
    assert.match(fs.readFileSync(path.join(tmp, 'journal/hidden/index.html'), 'utf8'), /content="noindex,follow"/);
    assert.match(fs.readFileSync(path.join(tmp, 'login.html'), 'utf8'), /content="noindex,nofollow"/);
    assert.match(fs.readFileSync(path.join(tmp, 'profile/index.html'), 'utf8'), /content="noindex,nofollow"/);
    assert.match(fs.readFileSync(path.join(tmp, 'events/[id].html'), 'utf8'), /content="noindex,nofollow"/);
    assert.match(fs.readFileSync(path.join(tmp, 'index.html'), 'utf8'), /google-site-verification/);
    assert.match(fs.readFileSync(path.join(tmp, '_redirects'), 'utf8'), / 301/);
    assert.match(fs.readFileSync(path.join(tmp, '.htaccess'), 'utf8'), /R=301/);
    assert.equal((xml.match(/<loc>/g) || []).length, PUBLIC_PAGES.length + 3);
  } finally { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('a failing API cannot silently replace a complete sitemap with a partial one', async () => {
  const tmp = fixture(); fs.writeFileSync(path.join(tmp, 'sitemap.xml'), 'existing sitemap');
  const { server, url } = await serve((_req, res) => { res.statusCode = 503; res.end('Unavailable'); });
  try {
    const result = await run('scripts/generate-sitemap.js', tmp, url);
    assert.notEqual(result.code, 0);
    assert.equal(fs.readFileSync(path.join(tmp, 'sitemap.xml'), 'utf8'), 'existing sitemap');
  } finally { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('pagination follows the reported total even if the API caps page size below 100', async () => {
  const { server, url } = await serve((req, res) => {
    const page = Number(new URL(req.url, 'http://local').searchParams.get('page'));
    const items = Array.from({ length: page < 3 ? 30 : 1 }, (_, i) => ({ id: String((page - 1) * 30 + i) }));
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ items, pagination: { total: 61 } }));
  });
  try { assert.equal((await collection(url, '/api/items')).length, 61); } finally { server.close(); }
});

test('event SEO overrides survive static export, old URLs redirect and index flags govern sitemap', async () => {
  const tmp = fixture();
  const custom = { ...event, slug: 'kino-i-gorod', slug_aliases: ['old-kino'], meta_title: 'Название для поиска', meta_description: 'Описание для поиска', og_title: 'Для Telegram', og_description: 'Описание для Telegram', og_image: 'https://example.test/og.png', coverUrl: 'https://example.test/cover.png', cover_alt: 'Наставник у окна', published_at: '2026-11-21T10:00:00Z', updated_at: '2026-11-21T11:00:00Z', nofollow: true, mentor: { ...mentor, bio: 'Мини-био наставника' }, tags: ['кино'] };
  const excluded = [{ ...custom, id: 'hidden-event', slug: 'hidden-event', noindex: true, slug_aliases: [] }, { ...custom, id: 'duplicate-event', slug: 'duplicate-event', canonical_url: 'https://example.test/events/kino-i-gorod', slug_aliases: [] }];
  const { server, url } = await serve((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(req.url.startsWith('/api/events') ? { items: [custom, ...excluded], pagination: { hasNext: false } } : []));
  });
  try {
    assert.equal(eventPath(custom), '/events/kino-i-gorod');
    let result = await run('scripts/generate-public-pages.js', tmp, url); assert.equal(result.code, 0, result.output);
    result = await run('scripts/generate-sitemap.js', tmp, url); assert.equal(result.code, 0, result.output);
    const html = fs.readFileSync(path.join(tmp, 'events/kino-i-gorod/index.html'), 'utf8');
    for (const part of ['Название для поиска', '<h1>Разговор об искусстве</h1>', 'name="description" content="Описание для поиска"', 'property="og:title" content="Для Telegram"', 'property="og:description" content="Описание для Telegram"', 'property="og:image" content="https://example.test/og.png"', 'alt="Наставник у окна"', 'Мини-био наставника', 'content="index,nofollow"', '"datePublished":"2026-11-21T10:00:00Z"', '"dateModified":"2026-11-21T11:00:00Z"', '/events?tag=', '#кино']) assert.ok(html.includes(part), part);
    const redirects = fs.readFileSync(path.join(tmp, '_redirects'), 'utf8');
    for (const old of [`/events/${event.id}`, eventPath(event), '/events/old-kino']) assert.ok(redirects.includes(`${old} /events/kino-i-gorod 301`));
    const xml = fs.readFileSync(path.join(tmp, 'sitemap.xml'), 'utf8');
    assert.ok(xml.includes('/events/kino-i-gorod</loc>')); assert.ok(!xml.includes('/events/hidden-event</loc>')); assert.ok(!xml.includes('/events/duplicate-event</loc>'));
  } finally { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('mentor pages expose biography links, events and authored articles without JavaScript', async () => {
  const tmp = fixture();
  const tutor = { ...mentor, bio: 'Читайте [мой сайт](https://example.test/mentor) и https://example.test/portfolio. [опасно](javascript:alert)', tags: ['кино'] };
  const { server, url } = await serve((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(req.url.startsWith('/api/articles') ? { data: articles, pagination: { total: articles.length } } : req.url.startsWith('/api/events') ? { items: [event], pagination: { hasNext: false } } : [tutor]));
  });
  try {
    const result = await run('scripts/generate-public-pages.js', tmp, url);
    assert.equal(result.code, 0, result.output);
    const html = fs.readFileSync(path.join(tmp, mentorPath(tutor), 'index.html'), 'utf8');
    for (const expected of ['href="https://example.test/mentor"', 'href="https://example.test/portfolio"', `href="${eventPath(event)}"`, 'href="/journal/iskusstvo"', 'О чём пишет', '"@type":"Person"', '/explore?tag=', 'content="index,follow"']) assert.ok(html.includes(expected), expected);
    assert.ok(!html.includes('href="javascript:'));
    assert.ok(html.includes(`rel="canonical" href="https://example.test${mentorPath(tutor)}"`));
  } finally { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
});
