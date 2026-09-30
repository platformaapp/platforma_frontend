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
            /*
              Hover-затемнение для ЛЮБОГО кликабельного блока (Pressable)
              сайта разом, без правки каждого использования по отдельности.
              r-cursor-1loqt21 — не смысловой класс, а атомарный CSS-класс,
              который react-native-web детерминированно генерирует для
              cursor:'pointer' (см. styles.active в
              node_modules/react-native-web/.../Pressable/index.js) — этот
              стиль применяется КО ВСЕМ не-disabled Pressable, поэтому класс
              общий для них всех. Если версия react-native-web изменится и
              хеш класса станет другим — проверить этот селектор заново.
              @media(hover:hover) — чтобы не залипало на touch-устройствах.
            */
            @media (hover: hover) and (pointer: fine) {
              .r-cursor-1loqt21 { transition: opacity 0.18s ease; }
              .r-cursor-1loqt21:hover { opacity: 0.5; }
              /*
                Внутри попапов (react-native-web ставит aria-modal="true" на
                корневой div любого <Modal>, независимо от конкретного попапа)
                затемнение при наведении не нужно — селектор с более высокой
                специфичностью (attribute+class+pseudo) всегда перебивает
                правило выше без !important.
              */
              [aria-modal="true"] .r-cursor-1loqt21:hover { opacity: 1; }

              /*
                Красные текстовые кнопки/ссылки — подчёркивание только при
                наведении. r-color-1l3ds1r — детерминированный атомарный
                класс react-native-web для color:'#E02D2D' (тот же приём,
                что и .r-cursor-1loqt21 выше: см. compiler.atomic в
                node_modules/react-native-web/.../StyleSheet/compiler).
                Подчёркивается сам текст (когда цвет — прямо на Pressable)
                и текст-потомок (обычный случай: Pressable > Text).
              */
              .r-cursor-1loqt21:hover.r-color-1l3ds1r,
              .r-cursor-1loqt21:hover .r-color-1l3ds1r {
                text-decoration: underline;
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
