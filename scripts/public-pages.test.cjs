const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { eventPath, mentorPath, publicId } = require('../lib/public-paths');
const event = { id:'11111111-1111-4111-8111-111111111111', title:'Разговор об искусстве', description:'Описание <script>alert(1)</script>', datetimeStart:'2026-12-01T12:00:00Z', mentor:{id:'22222222-2222-4222-8222-222222222222',name:'Анна Иванова'} };

test('readable public paths retain UUID identity and support old URLs', () => {
 assert.match(eventPath(event), /^\/events\/razgovor-ob-iskusstve-/);
 assert.equal(publicId(eventPath(event).split('/').pop()),event.id);
 assert.equal(publicId(event.id),event.id);
 assert.match(mentorPath(event.mentor),/^\/explore\/anna-ivanova-/);
});

test('generated HTML exposes canonical metadata, content and crawlable relationships without JavaScript', async () => {
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'platforma-seo-'));
 const template='<html><head><title>Generic</title><meta name="description" content="Generic"></head><body><div id="root"></div></body></html>';
 for(const kind of ['events','explore']){fs.mkdirSync(path.join(tmp,kind));fs.writeFileSync(path.join(tmp,kind,'[id].html'),template);}
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url.startsWith('/api/events')?{items:[event],pagination:{hasNext:false}}:[{...event.mentor,bio:'Биография наставника'}]));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {
  const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/generate-public-pages.js',tmp],{env:{...process.env,EXPO_PUBLIC_API_BASE:`http://127.0.0.1:${server.address().port}`,SITE_BASE_URL:'https://example.test'},stdio:'pipe'});child.on('error',reject);child.on('exit',resolve);});
  assert.equal(code,0);
  const html=fs.readFileSync(path.join(tmp,eventPath(event),'index.html'),'utf8');
  assert.match(html,/<title>Разговор об искусстве<\/title>/);
  assert.ok(html.includes(`rel="canonical" href="https://example.test${eventPath(event)}"`));
  assert.match(html,/application\/ld\+json/);assert.match(html,/"@type":"Event"/);
  assert.ok(html.includes(`href="${mentorPath(event.mentor)}"`));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  const mentor=fs.readFileSync(path.join(tmp,mentorPath(event.mentor),'index.html'),'utf8');
  assert.ok(mentor.includes('Биография наставника'));assert.ok(mentor.includes(`href="${eventPath(event)}"`));
  assert.match(fs.readFileSync(path.join(tmp,'_redirects'),'utf8'),/ 301/);
 } finally {server.close();fs.rmSync(tmp,{recursive:true,force:true});}
});
