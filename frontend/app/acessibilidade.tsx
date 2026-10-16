import React from 'react';
import { useRouter } from 'expo-router';
import {
  LegalPage, Section, P, Bullet, B, Link, MailLink, ExternalLink, LegalEntityDetails, Disclaimer,
} from '../src/components/legal/LegalPage';
import { LEGAL_ENTITY } from '../src/config/legalEntity';

/**
 * Declaração de Acessibilidade — estrutura do modelo português
 * (acessibilidade.gov.pt). Os números e limitações vêm da avaliação técnica
 * de 16/10/2026 descrita na secção 5; ao corrigir uma limitação, retirá-la
 * daqui e atualizar a data.
 */
const LAST_UPDATED = '16 de outubro de 2026';
const ASSESSMENT_DATE = '16 de outubro de 2026';

export default function AccessibilityStatementScreen() {
  const router = useRouter();
  const { emails } = LEGAL_ENTITY;

  return (
    <LegalPage
      title="Declaração de Acessibilidade"
      headTitle="Declaração de Acessibilidade — Portugal Vivo"
      description="Estado de acessibilidade da aplicação Portugal Vivo face às WCAG 2.1, limitações conhecidas e como nos contactar."
      lastUpdated={LAST_UPDATED}
      lead={
        <>
          Queremos que o Portugal Vivo possa ser usado por todas as pessoas, incluindo
          quem usa leitores de ecrã, ampliação de texto ou outras tecnologias de apoio.
          Esta declaração diz, com franqueza, onde estamos.
        </>
      }
    >
      <Section title="1. Compromisso">
        <P>
          O responsável pelo Portugal Vivo compromete-se a tornar a aplicação (iOS,
          Android e web) acessível, tendo como referência as Diretrizes de Acessibilidade
          para Conteúdo Web <B>WCAG 2.1, nível AA</B>, do W3C.
        </P>
        <LegalEntityDetails />
        <P>
          Esta declaração é publicada voluntariamente e segue a estrutura do modelo de
          declaração de acessibilidade adotado em Portugal.
        </P>
      </Section>

      <Section title="2. Estado de conformidade">
        <P>
          A aplicação está <B>parcialmente conforme</B> com as WCAG 2.1 nível AA: parte
          dos requisitos é cumprida e há as limitações conhecidas descritas na secção 3.
        </P>
      </Section>

      <Section title="3. Conteúdo não acessível">
        <P>Limitações identificadas na avaliação de {ASSESSMENT_DATE}:</P>
        <Bullet>
          <B>Contraste no tema claro</B> (critério 1.4.3). O texto secundário tem um
          contraste de cerca de 2,8:1 e o texto na cor de destaque cerca de 2,5:1, abaixo
          dos 4,5:1 exigidos. <B>Alternativa:</B> o tema escuro cumpre o contraste mínimo
          em todos os textos; pode ativá-lo em Definições → Aparência.
        </Bullet>
        <Bullet>
          <B>Botões só com ícone sem nome acessível</B> (critérios 1.1.1 e 4.1.2). Cerca
          de 90 botões nos ecrãs públicos (por exemplo, partilhar, favoritos, fechar ou
          controlos do mapa) e cerca de 30 nas áreas de gestão para municípios e
          parceiros são anunciados apenas como &quot;botão&quot; pelos leitores de ecrã.
        </Bullet>
        <Bullet>
          <B>Imagens sem texto alternativo</B> (critério 1.1.1). A maioria das imagens não
          tem descrição nem está marcada como decorativa. A informação essencial de cada
          local está também no texto da página.
        </Bullet>
        <Bullet>
          <B>Campos de formulário sem etiqueta</B> (critérios 1.3.1, 3.3.2 e 4.1.2). Na
          maioria dos campos, a indicação do que preencher está só no texto de exemplo,
          que desaparece ao escrever e nem sempre é lido pelos leitores de ecrã.
        </Bullet>
        <Bullet>
          <B>Mapa interativo</B> (critérios 1.1.1 e 2.1.1). O mapa não pode ser
          explorado com leitor de ecrã nem só com teclado. <B>Alternativa:</B> os mesmos
          locais estão disponíveis em lista em{' '}
          <Link onPress={() => router.push('/nearby')}>Perto de mim</Link>, em Descobrir e
          na pesquisa.
        </Bullet>
        <Bullet>
          <B>Vídeos sem legendas</B> (critério 1.2.2). Os vídeos de pontos de interesse
          não têm legendas. As câmaras de praia em direto são transmitidas sem som.
        </Bullet>
        <Bullet>
          <B>Animações</B>. As animações da interface não respeitam ainda a preferência
          &quot;Reduzir movimento&quot; do sistema (boa prática; critério 2.3.3, nível
          AAA).
        </Bullet>
      </Section>

      <Section title="4. O que já está assegurado">
        <Bullet>
          <B>Texto ampliável</B> (critério 1.4.4): a aplicação respeita o tamanho de letra
          definido no sistema e nunca o limita.
        </Bullet>
        <Bullet>
          <B>Tema escuro</B> com contraste mínimo de 4,5:1 em todo o texto.
        </Bullet>
        <Bullet>
          <B>Idioma da página</B> (critério 3.1.1): a versão web declara a língua da
          interface — português, inglês, espanhol ou francês — para que os leitores de
          ecrã usem a pronúncia certa.
        </Bullet>
        <Bullet>
          <B>Páginas legais</B> (esta declaração, a Política de Privacidade e os Termos de
          Utilização): contraste conforme, títulos marcados como cabeçalhos e ligações
          identificadas.
        </Bullet>
      </Section>

      <Section title="5. Elaboração desta declaração">
        <Bullet>
          <B>Data da avaliação:</B> {ASSESSMENT_DATE}.
        </Bullet>
        <Bullet>
          <B>Método:</B> autoavaliação técnica — análise automática do código de todos os
          ecrãs da aplicação (nomes acessíveis de botões, imagens e campos; bloqueio de
          ampliação de texto; preferência de movimento) e medição do contraste das cores
          de texto de cada tema, segundo a fórmula das WCAG.
        </Bullet>
        <Bullet>
          <B>Limites do método:</B> não houve auditoria externa nem testes com
          utilizadores de tecnologias de apoio. Podem existir problemas que esta
          avaliação não detetou.
        </Bullet>
        <Bullet>
          <B>Revisão:</B> esta declaração é revista sempre que uma das limitações acima
          for corrigida e, no mínimo, uma vez por ano.
        </Bullet>
      </Section>

      <Section title="6. Contacto e pedidos">
        <P>
          Se encontrar uma barreira que não está descrita aqui, ou precisar de um conteúdo
          num formato acessível, escreva-nos para{' '}
          <MailLink email={emails.accessibility} subject="Acessibilidade" />. Indique o
          ecrã ou o endereço, o que tentou fazer e a tecnologia de apoio que usa.
        </P>
        <P>
          Pode também apresentar uma reclamação no Livro de Reclamações Eletrónico, em{' '}
          <ExternalLink url="https://www.livroreclamacoes.pt">www.livroreclamacoes.pt</ExternalLink>.
        </P>
      </Section>

      <Disclaimer>
        Documento informativo. A versão definitiva está sujeita a revisão jurídica
        antes do lançamento público.
      </Disclaimer>
    </LegalPage>
  );
}
