const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
let response, failure, request;
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const requireMock = name => {
    if (name === '@/lib/api/profile-response') return load('lib/api/profile-response.ts');
    if (name === '@/constants/env') return { endpoints: { tutorProfile: '/api/tutor/profile', studentProfile: '/api/student/profile' } };
    if (name === '@/lib/auth') return { getAuthToken: async () => 'fixture-token' };
    if (name === '@/lib/api/auth-error') return { handle401: async () => { throw new Error('Unauthorized'); } };
    if (name === '@/lib/authed-fetch') return { authedFetch: async (url, init) => { request = { url, init }; if (failure) throw failure; return response; } };
    throw new Error('Unexpected dependency: ' + name);
  };
  new Function('require', 'exports', code)(requireMock, exports);
  cache.set(file, exports);
  return exports;
}
const tutor = load('lib/api/tutor.ts');
const student = load('lib/api/student.ts');
const reply = (data, status = 200, type = 'application/json') => ({ status, ok: status >= 200 && status < 300, headers: { get: () => type }, json: async () => { if (typeof data === 'string') throw new Error('Not JSON'); return data; }, text: async () => String(data) });

test('HTML with HTTP 200 cannot be accepted as a saved tutor or student profile', async () => {
  response = reply('<html>Unmatched Route</html>', 200, 'text/html'); failure = null;
  await assert.rejects(tutor.updateTutorProfile({ bio: 'New bio' }), /не подтвердил/);
  await assert.rejects(student.updateStudentProfile({ fullName: 'New name' }), /не подтвердил/);
});
test('student validation and network errors propagate instead of creating a local-only success', async () => {
  response = reply({ message: 'Invalid photo URL' }, 400); failure = null;
  await assert.rejects(student.updateStudentProfile({ avatarUrl: 'invalid' }), /Invalid photo URL/);
  failure = new Error('Network unavailable');
  await assert.rejects(student.updateStudentProfile({ fullName: 'New name' }), /Network unavailable/);
  failure = null;
});
test('profile reads bypass stale caches and writes return the server-confirmed fields', async () => {
  response = reply({ id: 'user-id', bio: 'Saved bio', avatarUrl: 'https://example.test/new.jpg' });
  const saved = await tutor.updateTutorProfile({ bio: 'Saved bio' });
  assert.equal(saved.bio, 'Saved bio');
  assert.equal((await tutor.getTutorProfile()).avatarUrl, 'https://example.test/new.jpg');
  assert.equal(request.init.cache, 'no-store');
  response = reply({ data: { id: 'student-id', fullName: 'Saved name' } });
  assert.equal((await student.getStudentProfile()).fullName, 'Saved name');
  assert.equal(request.init.cache, 'no-store');
});

test('a successful response containing unchanged old values is rejected', async () => {
  response = reply({ id: 'user-id', bio: 'Old bio', avatarUrl: 'https://example.test/old.jpg' }); failure = null;
  await assert.rejects(tutor.updateTutorProfile({ bio: 'New bio' }), /не подтвердил изменения/);
  await assert.rejects(student.updateStudentProfile({ avatarUrl: 'https://example.test/new.jpg' }), /не подтвердил изменения/);
});
