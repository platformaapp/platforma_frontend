#!/usr/bin/env node
/** Publish only canonical, indexable pages with successfully generated HTML. */
const fs = require('node:fs');
const path = require('node:path');
const { generatePublicPages, MANIFEST } = require('./generate-public-pages');
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
async function main() {
  const out = process.argv[2] || 'dist';
  const file = path.join(out, MANIFEST);
  const manifest = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : await generatePublicPages(out);
  const urls = new Map();
  for (const page of manifest.pages) {
    if (page.noindex || page.canonical !== manifest.site + page.path) continue;
    if (!fs.existsSync(path.join(out, page.file))) throw new Error(`Missing HTML for ${page.path}`);
    const date = page.lastmod ? new Date(page.lastmod) : null;
    const lastmod = date && !Number.isNaN(date.getTime()) ? `<lastmod>${date.toISOString()}</lastmod>` : '';
    urls.set(page.canonical, `<url><loc>${esc(page.canonical)}</loc>${lastmod}</url>`);
  }
  fs.writeFileSync(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...urls.values()].join('\n')}\n</urlset>\n`);
  console.log(`[sitemap] ${urls.size} canonical URLs with generated HTML`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
