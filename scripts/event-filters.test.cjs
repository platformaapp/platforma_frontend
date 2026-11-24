const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const exportsForTest = {};
const source = fs.readFileSync(require('node:path').join(__dirname, '../lib/event-filters.ts'), 'utf8');
new Function('exports', ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }))(exportsForTest);
const { parseTags, eventFormatSlug, eventFormatLabel, eventFilterPath } = exportsForTest;

test('free-form tags include the last uncommitted word, normalize hashes and preserve multiword tags', () => {
  assert.deepEqual(parseTags(' #кино, авторский тег; кино\n#город '), ['кино', 'авторский тег', 'город']);
  assert.deepEqual(parseTags(' , ## ;\n'), []);
});
test('links from both format labels and slugs use a supported API category', () => {
  assert.equal(eventFormatSlug('Лекция'), 'lecture');
  assert.equal(eventFormatLabel('lecture'), 'Лекция');
  assert.equal(eventFilterPath('format', 'Лекция'), '/events?format=lecture');
  assert.equal(eventFilterPath('tag', 'кино & город'), '/events?tag=' + encodeURIComponent('кино & город'));
  assert.equal(eventFormatSlug('unknown'), undefined);
  assert.equal(eventFormatSlug('Медиация'), undefined);
  assert.equal(eventFormatLabel('mediation'), undefined);
  assert.equal(eventFormatSlug('Обсуждение'), undefined);
  assert.equal(eventFormatLabel('discussion'), undefined);
});
