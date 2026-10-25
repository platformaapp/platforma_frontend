import React from 'react';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        {/*
          html/body не могут быть the scrolling element здесь: expo-router
          оборачивает каждый экран Stack'а в свой контейнер с overflow:hidden
          (нужен для анимации перехода между экранами), который стоит ВЫШЕ
          контента страницы в DOM — что бы мы ни делали с html/body/#root,
          всё, что не влезает в этот контейнер, просто обрезается и никаким
          скроллом не достаётся. Поэтому скроллит именно scrollArea из
          SiteShell (components/web/site-shell.tsx) — она включает и шапку,
          и контент страницы, поэтому шапка прокручивается вместе со
          страницей, а не остаётся зафиксированной сверху — просто прячем
          скроллбар визуально (scrollbar-width/::-webkit-scrollbar), сам
          скролл при этом остаётся полностью рабочим (колесо, клавиши, тач,
          драг).
        */}
        <style dangerouslySetInnerHTML={{
          __html: `
            html, body, #root { height: 100%; background-color: #ffffff; margin: 0; padding: 0; overflow: hidden; }
            #root { display: flex; }
            [data-site-content="true"] { scrollbar-width: none; -ms-overflow-style: none; }
            [data-site-content="true"]::-webkit-scrollbar { display: none; width: 0; height: 0; }
            [data-mentor-avatar="true"] { filter: grayscale(100%); transition: filter 0.2s ease; }
            [data-mentor-avatar="true"]:hover { filter: none; }
            /* Текстовые ссылки (имя автора статьи, теги, инлайн-ссылки в
               тексте статьи — см. dataSet в journal/[slug].web.tsx,
               tag-list.tsx, lib/markdown-inline.tsx) — только подчёркивание
               при наведении, без затемнения (opacity), в отличие от общего
               правила hover-dim в app/_layout.tsx. !important обязателен:
               этот <style> в <head> идёт РАНЬШЕ #hover-dim-style (тот
               добавляется в рантайме после монтирования), без !important
               более поздняя по DOM-порядку .cursorClass:hover{opacity:.5}
               выигрывала бы при равной специфичности. Не переиспользуем
               общий механизм детекции "красного" цвета из _layout.tsx — он
               ищет CSS-класс с нужным цветом через :has(), а
               react-native-web для ВЛОЖЕННОГО Text (Text внутри другого
               Text, ровно наш случай — ссылка внутри абзаца) применяет
               color/textDecoration инлайн-стилем, а не классом, так что
               :has(.класс) там в принципе никогда не совпадёт. */
            @media (hover: hover) and (pointer: fine) {
              [data-text-link="true"]:hover {
                opacity: 1 !important;
                text-decoration: underline !important;
                text-underline-offset: 3px;
              }
            }
          `
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
