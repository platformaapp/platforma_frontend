#!/usr/bin/env node
/** Check the HTML delivered over HTTP, without executing client JavaScript. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

function signals(html) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
  const result = { title: [...head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)].map(m => m[1]) };
  for (const tag of head.matchAll(/<(?:meta|link)\b[^>]*>/gi)) {
    const attrs = Object.fromEntries([...tag[0].matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(m => [m[1].toLowerCase(), m[2]]));
    const key = attrs.property || attrs.name || (attrs.rel === 'canonical' ? 'canonical' : '');
    if (['canonical', 'description', 'robots', 'og:title', 'og:description', 'og:image', 'og:url'].includes(key)) (result[key] ||= []).push(attrs.content ?? attrs.href);
  }
  return result;
}
async function verifyPage(base, route, expected) {
  const url = new URL(route, base).href;
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200, `${url}: expected HTTP 200 without redirects, got ${response.status}`);
  assert.match(response.headers.get('content-type') || '', /text\/html/i, `${url}: expected HTML`);
  const actual = signals(await response.text()), wanted = signals(expected);
  for (const key of ['title', 'canonical', 'og:title', 'og:description', 'og:url']) {
    assert.equal(wanted[key]?.length, 1, `${route}: generated HTML must have one ${key}`);
  }
  for (const [key, values] of Object.entries(wanted)) assert.deepEqual(actual[key], values, `${url}: wrong ${key}; check nginx routes and deployed directory`);
  return url;
}
async function main(out = 'dist', base = 'https://platformaapp.ru') {
  const { pages: manifest, site } = JSON.parse(fs.readFileSync(path.join(out, '_seo-manifest.json'), 'utf8'));
  assert.ok(Array.isArray(manifest), 'Invalid SEO manifest');
  const pages = [manifest.find(p => p.path === '/journal')];
  for (const prefix of ['/journal/', '/events/', '/explore/']) pages.push(manifest.find(p => p.path.startsWith(prefix) && !p.noindex && p.canonical === new URL(p.path, site).href));
  for (const page of pages.filter(Boolean)) {
    const url = await verifyPage(base, page.path, fs.readFileSync(path.join(out, page.file), 'utf8'));
    console.log(`[public HTML] OK ${url}`);
  }
}
if (require.main === module) main(process.argv[2], process.argv[3]).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { signals, verifyPage };
