// Canonical public pages shared by runtime metadata and the static SEO build.
const PUBLIC_PAGES = [
  { path: '/', template: 'index.html', title: 'p(34) — наставники, лекции и культурные события', heading: 'p(34) — новые увлечения и встречи', description: 'Находите наставников, культурные события, лекции и творческие занятия. Читайте журнал и открывайте новые увлечения вместе с p(34).' },
  { path: '/events', template: 'events/index.html', title: 'События, лекции и творческие встречи — p(34)', heading: 'Ближайшие события', description: 'Лекции, мастер-классы, трансляции и встречи с наставниками. Выберите интересную тему и запишитесь на событие на p(34).' },
  { path: '/explore', template: 'explore/index.html', title: 'Наставники и индивидуальные занятия — p(34)', heading: 'Наставники', description: 'Познакомьтесь с наставниками p(34), их опытом и интересами. Найдите автора для индивидуальной встречи или творческого занятия.' },
  { path: '/journal', template: 'journal/index.html', title: 'Журнал об искусстве, культуре и увлечениях — p(34)', heading: 'Журнал', description: 'Статьи об искусстве, культуре, городе и новых увлечениях. Авторские материалы и истории наставников платформы p(34).' },
  { path: '/about-us', template: 'about-us.html', title: 'О нас — платформа p(34)', heading: 'О нас', description: 'p(34) объединяет наставников, учеников и культурные площадки. Узнайте о платформе для обмена знаниями и новых знакомств.' },
  { path: '/about', template: 'about.html', title: 'О сервисе p(34): как работают встречи и занятия', heading: 'О сервисе', description: 'Как устроена платформа p(34): лекции, творческие занятия, встречи с наставниками, бронирование и участие в событиях.' },
  { path: '/contacts', template: 'contacts.html', title: 'Контакты и реквизиты — p(34)', heading: 'Контакты', description: 'Контакты для связи с командой p(34), реквизиты сервиса и информация для сотрудничества.' },
  { path: '/privacy', template: 'privacy.html', title: 'Политика конфиденциальности — p(34)', heading: 'Политика конфиденциальности', description: 'Политика конфиденциальности p(34): обработка и защита персональных данных пользователей платформы.' },
  { path: '/offer', template: 'offer.html', title: 'Публичная оферта для участников — p(34)', heading: 'Публичная оферта', description: 'Условия использования платформы p(34), бронирования и участия в занятиях и событиях.' },
  { path: '/tutor-offer', template: 'tutor-offer.html', title: 'Оферта для наставников — p(34)', heading: 'Оферта для наставников', description: 'Условия сотрудничества наставников с платформой p(34), публикации событий и проведения занятий.' },
  { path: '/user-agreement', template: 'user-agreement.html', title: 'Пользовательское соглашение — p(34)', heading: 'Пользовательское соглашение', description: 'Правила использования сервиса p(34) и условия взаимодействия пользователей платформы.' },
];
function publicPage(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return PUBLIC_PAGES.find(page => page.path === clean);
}
function isPrivatePath(pathname) {
  return /^\/(?:admin|profile|myevents|login|register-student|register-tutor(?:-step2)?|registration-complete|tutor-application-sent|forgot-password|reset-password|check-email|conference|payment-methods|modal|delete-account|_sitemap)(?:\/|$)/.test(pathname) || /[\[\]()]/.test(pathname);
}
module.exports = { PUBLIC_PAGES, publicPage, isPrivatePath };
