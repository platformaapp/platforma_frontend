const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { PUBLIC_PAGES } = require('../lib/seo-routes');
const fallbackFile = path.join(__dirname, '../public/sitemap.xml');
function verify(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['scripts/verify-sitemap.py', ...args]);
    let output = '';
    child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
    child.on('error', reject); child.on('exit', code => resolve({ code, output }));
  });
}
test('ordinary Expo public assets contain a valid sitemap covering every permanent public page', async () => {
  const xml = fs.readFileSync(fallbackFile, 'utf8');
  for (const page of PUBLIC_PAGES) assert.ok(xml.includes(`<loc>https://platformaapp.ru${page.path}</loc>`));
  assert.equal((xml.match(/<loc>/g) || []).length, PUBLIC_PAGES.length);
  const result = await verify([fallbackFile]); assert.equal(result.code, 0, result.output);
  const redirects = fs.readFileSync(path.join(__dirname, '../public/_redirects'), 'utf8');
  assert.ok(redirects.indexOf('/sitemap.xml') < redirects.indexOf('/*'));
});
test('deployment verification detects SPA HTML and an outdated sitemap at the public URL', async () => {
  const xml = fs.readFileSync(fallbackFile);
  let mode = 'valid';
  const server = http.createServer((_req, res) => {
    res.setHeader('Content-Type', mode === 'html' ? 'text/html' : 'application/xml');
    res.end(mode === 'html' ? '<html><body>Unmatched Route</body></html>' : mode === 'partial' ? '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://platformaapp.ru/</loc></url></urlset>' : mode === 'extra' ? xml.toString().replace('</urlset>', '<url><loc>https://platformaapp.ru/new-public-page</loc></url></urlset>') : xml);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/sitemap.xml`;
    const good = await verify([url, '--expect-file', fallbackFile]); assert.equal(good.code, 0, good.output);
    mode = 'extra'; const extra = await verify([url, '--expect-file', fallbackFile, '--allow-additional']); assert.equal(extra.code, 0, extra.output);
    mode = 'html'; const html = await verify([url]); assert.notEqual(html.code, 0); assert.match(html.output, /HTML instead of sitemap XML/);
    mode = 'partial'; const partial = await verify([url, '--expect-file', fallbackFile]); assert.notEqual(partial.code, 0); assert.match(partial.output, /does not match/);
  } finally { server.close(); }
});
test('a local HTML document is rejected even when named sitemap.xml', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'platforma-sitemap-'));
  try {
    const file = path.join(dir, 'sitemap.xml'); fs.writeFileSync(file, '<html><body>Unmatched Route</body></html>');
    const result = await verify([file]); assert.notEqual(result.code, 0); assert.match(result.output, /Expected sitemap/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
