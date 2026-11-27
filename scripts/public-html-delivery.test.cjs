const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { verifyPage } = require('./verify-public-pages');
const expected = '<html><head><title>Статья</title><meta name="description" content="Описание"><link rel="canonical" href="https://example.test/journal/article"><meta property="og:title" content="Превью статьи"><meta property="og:description" content="Описание статьи"><meta property="og:url" content="https://example.test/journal/article"><meta property="og:image" content="https://example.test/cover.jpg"></head><body>Текст статьи</body></html>';
test('HTTP verification rejects the generic SPA, duplicate tags and redirect responses', async () => {
  let mode = 'article';
  const server = http.createServer((_req, res) => {
    if (mode === 'redirect') { res.writeHead(301, { Location: '/journal/article/' }); res.end(); return; }
    res.setHeader('Content-Type', 'text/html');
    res.end(mode === 'generic' ? expected.replace('Превью статьи', 'Сервис') : mode === 'duplicate' ? expected.replace('</head>', '<meta property="og:title" content="Сервис"></head>') : expected);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await verifyPage(base, '/journal/article', expected);
    for (mode of ['generic', 'duplicate', 'redirect']) await assert.rejects(() => verifyPage(base, '/journal/article', expected));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
