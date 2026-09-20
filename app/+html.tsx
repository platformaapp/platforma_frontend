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
          Не используем expo-router's ScrollViewStyleReset как есть: она ставит
          body{overflow:hidden}, из-за чего скроллит не документ, а внутренний
          ScrollView страницы (свой скроллбар внутри вьюпорта). html/body/#root
          по-прежнему height:100% (это нужно самому RN-флекс-дереву — без
          конкретной высоты оно схлопывается), просто не обрезаем их overflow,
          а у самих корневых ScrollView'ов страниц выключаем overflow-y (см.
          site-shell.tsx) — тогда их контент выходит за пределы вьюпорта и
          скроллит его сам html.
        */}
        <style dangerouslySetInnerHTML={{
          __html: `
            html, body, #root { height: 100%; background-color: #ffffff; margin: 0; padding: 0; }
            #root { display: flex; }
            [data-site-content="true"] > div { overflow: visible !important; }
          `
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
