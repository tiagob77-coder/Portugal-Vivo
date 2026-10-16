import React from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import {
  LegalPage, Section, P, Bullet, B, Link, MailLink, ExternalLink, LegalEntityDetails, Disclaimer,
} from '../src/components/legal/LegalPage';
import { LEGAL_ENTITY } from '../src/config/legalEntity';

const LAST_UPDATED = '16 de outubro de 2026';

export default function TermsScreen() {
  const router = useRouter();

  return (
    <LegalPage
      title="Termos de Utilização"
      headTitle="Termos de Utilização — Portugal Vivo"
      description="Regras de utilização da plataforma Portugal Vivo."
      lastUpdated={LAST_UPDATED}
      lead={
        <>
          Ao criar uma conta ou usar a aplicação Portugal Vivo, aceita os termos
          descritos abaixo. Leia atentamente antes de continuar.
        </>
      }
    >
      <Section title="1. Objeto e enquadramento">
        <P>
          Estes termos regulam a relação entre o Portugal Vivo (a &quot;Plataforma&quot;)
          e o utilizador, ao abrigo do Decreto-Lei n.º 7/2004 (comércio eletrónico) e da
          restante legislação portuguesa e europeia aplicável.
        </P>
        <P>A Plataforma é explorada por:</P>
        <LegalEntityDetails />
        <P>
          Contacto: <MailLink email={LEGAL_ENTITY.emails.legal} subject="Termos" />.
        </P>
      </Section>

      <Section title="2. Conta">
        <Bullet>
          Para criar conta, o utilizador deve ter pelo menos 14 anos e fornecer
          informação verdadeira e atualizada.
        </Bullet>
        <Bullet>
          O utilizador é responsável pela palavra-passe e por qualquer ação realizada
          na sua conta. Deve notificar-nos imediatamente em caso de uso não autorizado.
        </Bullet>
        <Bullet>
          Podemos suspender ou eliminar contas que violem estes termos ou a lei,
          mediante aviso prévio quando possível.
        </Bullet>
      </Section>

      <Section title="3. Conteúdo gerado pelo utilizador">
        <Bullet>
          O utilizador mantém os direitos sobre o conteúdo que publica (fotos, avaliações,
          contributos), concedendo ao Portugal Vivo uma licença não exclusiva, mundial e
          gratuita para o exibir na plataforma.
        </Bullet>
        <Bullet>
          É proibido publicar conteúdo ilegal, difamatório, discriminatório, sexualmente
          explícito, que viole direitos de autor ou que ponha em causa a segurança ou
          privacidade de terceiros.
        </Bullet>
        <Bullet>
          Reservamo-nos o direito de remover qualquer conteúdo que viole estes termos,
          sem aviso prévio.
        </Bullet>
      </Section>

      <Section title="4. Funcionalidade Premium">
        <Bullet>
          Algumas funcionalidades (audio guides, itinerários avançados, etc.) requerem
          subscrição paga. Os preços, métodos de pagamento (Visa/Mastercard, MB Way,
          Multibanco) e período de fidelização são apresentados no ato da subscrição.
        </Bullet>
        <Bullet>
          Tem direito ao período de livre resolução de 14 dias para serviços digitais,
          nos termos do art.º 17.º do Decreto-Lei n.º 24/2014, salvo se o serviço já
          tiver sido prestado com o seu consentimento expresso.
        </Bullet>
        <Bullet>
          A subscrição renova automaticamente; pode cancelar a qualquer momento nas
          definições da conta. O cancelamento produz efeitos no final do período pago.
        </Bullet>
      </Section>

      <Section title="5. Conteúdo da Plataforma">
        <Bullet>
          Os dados de POIs, narrativas, itinerários e mapas são apresentados em regime
          de melhor esforço. O Portugal Vivo não garante a exatidão, integralidade ou
          atualidade da informação, nem se responsabiliza por incidentes ou prejuízos
          decorrentes da deslocação a locais indicados.
        </Bullet>
        <Bullet>
          O utilizador é responsável pela sua segurança em deslocações — verifique
          condições do terreno, meteorologia e regulamentos locais antes de viajar.
        </Bullet>
      </Section>

      <Section title="6. Propriedade intelectual">
        <P>
          A marca &quot;Portugal Vivo&quot;, o logotipo, o software e a arquitetura da
          aplicação são propriedade dos seus titulares. É proibida a reprodução,
          engenharia inversa ou utilização comercial não autorizada.
        </P>
      </Section>

      <Section title="7. Limitação de responsabilidade">
        <Bullet>
          Na máxima medida permitida por lei, o Portugal Vivo não é responsável por
          danos indiretos, perda de lucros ou dados decorrentes do uso ou impossibilidade
          de uso da Plataforma.
        </Bullet>
        <Bullet>
          Não somos responsáveis por conteúdos, websites ou serviços de terceiros
          ligados a partir da Plataforma.
        </Bullet>
      </Section>

      <Section title="8. Privacidade">
        <P>
          O tratamento de dados pessoais é descrito na nossa{' '}
          <Link onPress={() => router.push('/privacy')}>Política de Privacidade</Link>,
          que faz parte integrante destes termos.
        </P>
      </Section>

      <Section title="9. Resolução de litígios">
        <Bullet>
          Aplica-se a lei portuguesa. Para resolução extrajudicial de conflitos de
          consumo, pode recorrer ao Centro Nacional de Informação e Arbitragem de
          Conflitos de Consumo (CNIACC) —{' '}
          <Link onPress={() => Linking.openURL('https://www.cniacc.pt')}>www.cniacc.pt</Link>.
        </Bullet>
        <Bullet>
          <B>Livro de Reclamações:</B> pode apresentar uma reclamação no Livro de
          Reclamações Eletrónico, em{' '}
          <ExternalLink url="https://www.livroreclamacoes.pt">www.livroreclamacoes.pt</ExternalLink>.
        </Bullet>
        <Bullet>
          Foro competente: tribunais portugueses, comarca de Lisboa, com renúncia a
          qualquer outro.
        </Bullet>
      </Section>

      <Section title="10. Alterações">
        <P>
          Podemos alterar estes termos para refletir mudanças legais ou da Plataforma.
          Alterações significativas são comunicadas com 30 dias de antecedência. O uso
          continuado após a entrada em vigor implica aceitação.
        </P>
      </Section>

      <Section title="11. Contacto">
        <P>
          Para questões legais:{' '}
          <MailLink email={LEGAL_ENTITY.emails.legal} subject="Termos" />.
        </P>
      </Section>

      <Disclaimer>
        Documento informativo. A versão definitiva está sujeita a revisão jurídica
        antes do lançamento público.
      </Disclaimer>
    </LegalPage>
  );
}
