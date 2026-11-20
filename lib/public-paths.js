// Shared by web navigation and the static SEO page generator.
const alphabet = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
function slugify(value) {
  return String(value || '').toLowerCase().split('').map(c => alphabet[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120).replace(/-+$/, '');
}
function publicId(value) {
  const raw = String(value || '');
  return raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)?.[0] || raw;
}
function eventPath(event) {
  const slug = slugify(event.title);
  return `/events/${slug ? slug + '-' : ''}${event.id}`;
}
function mentorPath(mentor) {
  const slug = slugify(mentor.fullName || mentor.full_name || mentor.name);
  return `/explore/${slug ? slug + '-' : ''}${mentor.id}`;
}
module.exports = { eventPath, mentorPath, publicId };
