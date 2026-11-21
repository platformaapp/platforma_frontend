# Индексация публичных страниц

Сборка веб-версии:

```sh
npx expo export --platform web
EXPO_PUBLIC_API_BASE=https://platformaapp.ru node scripts/generate-public-pages.js dist
node scripts/generate-sitemap.js dist
```

Генератор создаёт HTML для каталогов, опубликованных статей, событий и
наставников. Информационные и правовые страницы получают отдельные title,
description и canonical. В каталогах есть обычные ссылки на все материалы;
контент доступен поисковому роботу без JavaScript.

`lib/seo-routes.js` содержит постоянные публичные маршруты. Новую публичную
информационную страницу следует добавить туда с метаданными и шаблоном.
Sitemap строится из `_seo-manifest.json`, созданного той же сборкой. Материалы
с `noindex` и статьи с canonical на другой URL в sitemap не включаются.
При сбое API сборка останавливается: неполная карта сайта не публикуется.

Админка, личные кабинеты, страницы авторизации и служебные маршруты не входят
в sitemap и получают `noindex`. `robots.txt` ограничивает обход этих маршрутов.

Автоматическая публикация настроена на `main`, а не на рабочую ветку.
Workflow также можно запустить вручную; ежедневный запуск в 03:00 UTC
обновляет HTML и sitemap для новых публикаций без изменения кода.
При копировании необходимо сохранять скрытые файлы (`dist/.`), включая
`.htaccess`. Сервер должен отдавать `/route/index.html` или `/route.html`
до SPA fallback на `/index.html`; правила для Apache и `_redirects`
формируются вместе со сборкой. Для nginx эквивалентно:

```nginx
location / {
    try_files $uri.html $uri $uri/ /index.html;
}
```

После публикации проверить на реальном домене:

- `robots.txt` и `sitemap.xml` возвращают HTTP 200 и соответствующий контент;
- URL из sitemap возвращает собственный HTML, title и canonical;
- HTML статьи содержит текст, а HTML каталога — ссылки на материалы без JS;
- страницы авторизации не включены в sitemap и имеют `noindex`.

В Google Search Console и Яндекс Вебмастере отправить
`https://platformaapp.ru/sitemap.xml` и запросить переобход важных страниц.
Точную причину исключения URL показывает проверка URL в кабинете поисковика;
наличие URL в sitemap и техническая доступность не гарантируют включение в индекс.

## Если `/sitemap.xml` показывает Unmatched Route

Это означает, что запрос получил HTML приложения вместо XML. Проверить, что
веб-сервер обслуживает `dist`, куда скопирован файл, и обрабатывает XML до
перенаправления в Expo/SPA. Наличие файла в GitHub само по себе не меняет
корневую директорию уже запущенного сервера.

`public/sitemap.xml` — резервная карта постоянных публичных маршрутов,
доступная также при обычном Expo export/start. Генератор заменяет её в `dist`
полной картой статей, событий и наставников. Она не заменяет обязательный шаг
генерации полной карты перед production-деплоем.

Проверки:

```sh
python3 scripts/verify-sitemap.py dist/sitemap.xml
python3 scripts/verify-sitemap.py https://platformaapp.ru/sitemap.xml --expect-file dist/sitemap.xml
```

Для nginx ресурс должен обслуживаться явно из того же каталога сборки:

```nginx
location = /sitemap.xml {
    root /dist;
    default_type application/xml;
    try_files /sitemap.xml =404;
}
```

Этот блок размещается перед общим SPA/proxy location. При другом пути
размещения сборки заменить `/dist` реальным корневым каталогом.
