const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const api = {};
new Function('exports', ts.transpile(fs.readFileSync(require('node:path').join(__dirname, '../lib/creator-entry.ts'), 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }))(api);
test('guests can log in as mentors and resume the intended creation action', () => {
  for (const kind of ['event', 'article']) {
    const url = new URL(api.creatorEntryPath(kind, false), 'https://platformaapp.ru');
    assert.equal(url.pathname, '/login');
    assert.equal(url.searchParams.get('showLogin'), '1');
    assert.equal(url.searchParams.get('role'), 'tutor');
    assert.equal(url.searchParams.get('redirect'), `/profile?open=${kind}`);
    assert.equal(api.creatorEntryPath(kind, true), `/profile?open=${kind}`);
    const registration = new URL(api.withAuthRedirect('/register-tutor', url.searchParams.get('redirect')), url);
    assert.equal(registration.searchParams.get('redirect'), `/profile?open=${kind}`);
  }
});
test('authentication redirects remain on the application origin', () => {
  for (const value of ['https://evil.test', '//evil.test', '/\\evil.test', 'javascript:alert(1)', '/\nevil']) assert.equal(api.safeAuthRedirect(value), undefined);
  assert.equal(api.safeAuthRedirect('/events/kino?tag=city'), '/events/kino?tag=city');
});
