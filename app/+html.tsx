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
          скроллом не достаётся. Поэтому скроллит именно ScrollView страницы
          (как и задумано RN), а не документ — просто прячем его скроллбар
          визуально (scrollbar-width/::-webkit-scrollbar), сам скролл при
          этом остаётся полностью рабочим (колесо, клавиши, тач, драг).
        */}
        <style dangerouslySetInnerHTML={{
          __html: `
            html, body, #root { height: 100%; background-color: #ffffff; margin: 0; padding: 0; overflow: hidden; }
            #root { display: flex; }
            [data-site-content="true"] > div { scrollbar-width: none; -ms-overflow-style: none; }
            [data-site-content="true"] > div::-webkit-scrollbar { display: none; width: 0; height: 0; }
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
            }
          `
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
