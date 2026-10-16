import type { PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

/**
 * Documento HTML da versão web (output estático).
 *
 * Igual ao modelo predefinido do expo-router, exceto o idioma: o predefinido
 * declara `lang="en"`, o que faz os leitores de ecrã lerem o conteúdo em
 * português com pronúncia inglesa (WCAG 2.1, critério 3.1.1). Quando o
 * utilizador muda de língua, src/i18n atualiza este atributo.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-PT">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
