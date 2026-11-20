#!/usr/bin/env node
/** Generate indexable HTML for public events and mentors after Expo export. */
const fs = require('node:fs');
const path = require('node:path');
const { eventPath, mentorPath } = require('../lib/public-paths');
const api = (process.env.EXPO_PUBLIC_API_BASE || 'https://platformaapp.ru').replace(/\/$/, '');
const site = (process.env.SITE_BASE_URL || 'https://platformaapp.ru').replace(/\/$/, '');
const out = process.argv[2] || 'dist';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text = s => String(s || '').replace(/<[^>]*>/g, '').replace(/[#*_]/g, '').trim();
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
async function all(endpoint) {
  const result = new Map();
  for (let page=1;page<=100;page++) {
    const res=await fetch(`${api}${endpoint}?page=${page}&per_page=100&limit=100&include_past=true`);
    if(!res.ok) throw Error(`${endpoint}: HTTP ${res.status}`);
    const body=await res.json();const items=Array.isArray(body)?body:body.items || body.data || [];
    let added=0;for(const item of items) if(item.id&&!result.has(item.id)){result.set(item.id,item);added++;}
    if(!added || Array.isArray(body) || body.pagination?.hasNext===false || items.length<100) break;
  }
  return [...result.values()];
}
function writePage(route, template, { title, description, image, schema, body }) {
  let html=fs.readFileSync(path.join(out,template),'utf8');
  html=html.replace(/<title[^>]*>[\s\S]*?<\/title>/gi,'').replace(/<meta\b[^>]*(?:name=["'](?:description|twitter:[^"']*)["']|property=["']og:[^"']*["'])[^>]*>/gi,'').replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi,'');
  const url=site+route;
  const head=`<title>${esc(title)}</title><meta name="description" content="${esc(description.slice(0,160))}"><link rel="canonical" href="${esc(url)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description.slice(0,160))}"><meta property="og:url" content="${esc(url)}"><meta property="og:type" content="${schema['@type']==='Person'?'profile':'website'}"><meta name="twitter:card" content="${image?'summary_large_image':'summary'}">${image?`<meta property="og:image" content="${esc(new URL(image,site).href)}">`:''}<script type="application/ld+json">${json({'@context':'https://schema.org',...schema,url})}</script>`;
  html=html.replace('</head>',head+'</head>');
  // Visible fallback is readable without JS. Remove it once the hydrated screen is ready.
  const fallback=`<main id="seo-content" style="padding:32px;max-width:1100px;margin:auto;font:18px/1.5 sans-serif"><h1>${esc(title)}</h1>${image?`<img src="${esc(new URL(image,site).href)}" alt="${esc(title)}" style="max-width:339px;width:100%">`:''}<p>${esc(description).replace(/\n/g,'<br>')}</p>${body}</main>`;
  const script=`<script>(function(){function ready(){var root=document.getElementById('root'),fallback=document.getElementById('seo-content');if(root&&fallback&&root.textContent.includes(${json(title)})){fallback.remove();observer.disconnect();}}var observer=new MutationObserver(ready);observer.observe(document.documentElement,{childList:true,subtree:true});ready();})();</script>`;
  html=html.replace(/(<body[^>]*>)/, '$1'+fallback).replace('</body>',script+'</body>');
  const dir=path.join(out,route);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'index.html'),html);
  // Also support hosts configured with try_files $uri.html before SPA fallback.
  fs.writeFileSync(path.join(out,route+'.html'),html);
}
async function main(){
 const [events,mentors]=await Promise.all([all('/api/events/feed'),all('/api/users/tutors')]);
 const redirects=[];
 for(const e of events){
  const route=eventPath(e);const date=e.datetimeStart||e.datetime_start;const mentor=e.mentor;
  const schema={'@type':'Event',name:e.title,description:text(e.description),...(date?{startDate:date}:{}),eventStatus:'https://schema.org/EventScheduled',eventAttendanceMode:'https://schema.org/OnlineEventAttendanceMode',location:{'@type':'VirtualLocation',url:site+route},...(e.coverUrl?{image:new URL(e.coverUrl,site).href}:{}),...(mentor?{organizer:{'@type':'Person',name:mentor.name,url:site+mentorPath(mentor)}}:{})};
  writePage(route,'events/[id].html',{title:e.title,description:text(e.description),image:e.coverUrl,schema,body:`${date?`<p><time datetime="${esc(date)}">${esc(date)}</time></p>`:''}${mentor?`<a href="${esc(mentorPath(mentor))}">${esc(mentor.name)}</a>`:''}`});
  redirects.push(`/events/${e.id} ${route} 301`,`${route} ${route}/index.html 200`);
 }
 for(const m of mentors){const route=mentorPath(m),name=m.fullName||m.full_name||m.name||'Наставник';const related=events.filter(e=>e.mentor?.id===m.id);writePage(route,'explore/[id].html',{title:name,description:text(m.bio||m.shortBio||m.short_bio||m.specialization),image:m.avatarUrl||m.avatar_url,schema:{'@type':'Person',name,description:text(m.bio||m.shortBio||m.specialization)},body:related.length?`<h2>События наставника</h2><ul>${related.map(e=>`<li><a href="${esc(eventPath(e))}">${esc(e.title)}</a></li>`).join('')}</ul>`:''});redirects.push(`/explore/${m.id} ${route} 301`,`${route} ${route}/index.html 200`);}
 const redirectFile=path.join(out,'_redirects');const existing=fs.existsSync(redirectFile)?fs.readFileSync(redirectFile,'utf8'):'/* /index.html 200\n';fs.writeFileSync(redirectFile,redirects.join('\n')+'\n'+existing);
 console.log(`Generated SEO HTML: ${events.length} events, ${mentors.length} mentors`);
}
main().catch(e=>{console.error(e);process.exitCode=1});
