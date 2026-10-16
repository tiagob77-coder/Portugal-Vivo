import React from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import {
  LegalPage, Section, P, Bullet, B, Link, MailLink, LegalEntityDetails, Disclaimer,
} from '../src/components/legal/LegalPage';
import { LEGAL_ENTITY } from '../src/config/legalEntity';

// Date of last revision shown to the user. Update whenever the substantive
// content of this page changes — auditors and DPAs rely on this date as the
// effective version of the policy that the user agreed to.
const LAST_UPDATED = '16 de outubro de 2026';

export default function PrivacyScreen() {
  const router = useRouter();
  const { emails, dpo } = LEGAL_ENTITY;

  return (
    <LegalPage
      title="Política de Privacidade"
      headTitle="Política de Privacidade — Portugal Vivo"
      description="Como o Portugal Vivo recolhe, usa e protege os seus dados pessoais."
      lastUpdated={LAST_UPDATED}
      lead={
        <>
          Este documento descreve como o Portugal Vivo trata os dados pessoais dos seus
          utilizadores, em cumprimento do Regulamento (UE) 2016/679 (RGPD) e da Lei n.º
          58/2019 (Lei de Execução do RGPD em Portugal).
        </>
      }
    >
      <Section title="1. Responsável pelo tratamento">
        <P>
          O responsável pelo tratamento dos dados pessoais recolhidos através desta
          plataforma é:
        </P>
        <LegalEntityDetails />
        <P>
          Para qualquer questão relacionada com este documento ou com o tratamento dos
          seus dados, incluindo o exercício dos direitos descritos na secção 7, pode
          contactar-nos em <MailLink email={emails.privacy} subject="Privacidade" />.
        </P>
        {dpo ? (
          <P>
            <B>Encarregado de Proteção de Dados:</B> {dpo.name} —{' '}
            <MailLink email={dpo.email} subject="Encarregado de Proteção de Dados" />.
          </P>
        ) : (
          <P>
            Não foi designado um Encarregado de Proteção de Dados. Os pedidos relativos a
            dados pessoais são tratados diretamente pelo responsável, através do contacto
            acima.
          </P>
        )}
      </Section>

      <Section title="2. Que dados recolhemos">
        <Bullet>
          <B>Dados de conta:</B> nome, endereço de e-mail e hash da palavra-passe.
          Quando o login é feito por Google, recolhemos também o ID Google e a imagem
          de perfil (se disponível).
        </Bullet>
        <Bullet>
          <B>Localização:</B> apenas quando autorizada explicitamente para mostrar POIs
          próximos. Não guardamos histórico de localização — só é usada em tempo real
          para responder a pedidos de proximidade.
        </Bullet>
        <Bullet>
          <B>Favoritos, visitas, badges e avaliações:</B> ações voluntárias do utilizador
          ficam associadas à conta para suportar a gamificação e o histórico pessoal.
        </Bullet>
        <Bullet>
          <B>Sessão:</B> guardamos um identificador opaco da sessão num cookie HTTP-only
          estritamente necessário ao funcionamento da aplicação.
        </Bullet>
        <Bullet>
          <B>Telemetria de erros:</B> através do Sentry, sem dados pessoais associados
          (PII desativada — apenas tipo de erro, rota e versão).
        </Bullet>
        <Bullet>
          <B>Estatísticas anónimas de utilização:</B> eventos sem identificação pessoal,
          descritos na secção 3.
        </Bullet>
      </Section>

      <Section title="3. Estatísticas anónimas de utilização">
        <P>
          Para ajudar os municípios parceiros a perceber que locais e rotas são visitados,
          a aplicação envia eventos anónimos de utilização para os servidores do Portugal
          Vivo. Não usamos serviços de análise de terceiros.
        </P>
        <Bullet>
          <B>O que é recolhido:</B> o tipo de evento (ver um local ou uma rota, ouvir o
          áudio-guia, pedir direções, partilhar, adicionar aos favoritos, ler um código
          QR), o identificador do local ou da rota, a plataforma (iOS, Android ou web), o
          idioma do dispositivo e, quando disponível, o país de origem indicado pela rede
          de distribuição que recebe o pedido.
        </Bullet>
        <Bullet>
          <B>Finalidade:</B> produzir estatísticas agregadas de impacto (por exemplo,
          visitas mensais a um monumento) para os municípios parceiros. Os municípios só
          têm acesso a totais agregados, nunca a eventos individuais.
        </Bullet>
        <Bullet>
          <B>O que não é recolhido:</B> o identificador da sua conta, o endereço IP ou a
          sua localização precisa. Os eventos não ficam associados à sua conta, mesmo com
          sessão iniciada.
        </Bullet>
        <Bullet>
          <B>Identificador de visitante:</B> um valor aleatório, guardado apenas no seu
          dispositivo, que muda todos os meses. Serve só para contar visitantes únicos em
          cada mês e não permite ligar a atividade de meses diferentes. No servidor é
          ainda transformado (hash) antes de ser guardado.
        </Bullet>
        <Bullet>
          <B>Conservação:</B> os eventos são apagados automaticamente ao fim de 400 dias.
          Os relatórios entregues aos municípios contêm apenas valores agregados.
        </Bullet>
        <Bullet>
          <B>Como desativar:</B> em{' '}
          <Link onPress={() => router.push('/settings/privacidade')}>Definições → Privacidade</Link>,
          desligue &quot;Partilhar estatísticas anónimas&quot;. A partir desse momento não é
          enviado nenhum evento a partir deste dispositivo.
        </Bullet>
      </Section>

      <Section title="4. Finalidades e bases legais">
        <Bullet>
          <B>Execução do contrato</B> (art.º 6.º, n.º 1, b) RGPD): autenticação, gestão
          de conta, manutenção de favoritos e itinerários.
        </Bullet>
        <Bullet>
          <B>Consentimento</B> (art.º 6.º, n.º 1, a) RGPD): acesso à localização,
          notificações push, partilha pública de perfil. Pode revogar a qualquer
          momento nas definições da conta.
        </Bullet>
        <Bullet>
          <B>Interesse legítimo</B> (art.º 6.º, n.º 1, f) RGPD): segurança da plataforma,
          prevenção de fraude e análise agregada de utilização (sem identificação
          individual). Pode opor-se às estatísticas anónimas em Definições → Privacidade.
        </Bullet>
      </Section>

      <Section title="5. Com quem partilhamos">
        <Bullet>
          <B>Subcontratantes</B> sujeitos a contratos de tratamento conformes ao art.º
          28.º RGPD: MongoDB Atlas (alojamento de BD), Cloudinary (alojamento de
          imagens), Stripe (pagamentos premium), Sentry (monitorização de erros) e o
          fornecedor de modelo de linguagem usado para gerar narrativas.
        </Bullet>
        <Bullet>
          <B>Municípios parceiros:</B> recebem apenas estatísticas agregadas de
          utilização dos locais e rotas do seu território, nunca dados individuais.
        </Bullet>
        <Bullet>
          <B>Não vendemos</B> dados pessoais a terceiros nem fazemos profiling para
          efeitos de publicidade.
        </Bullet>
        <Bullet>
          Em caso de transferências para fora do Espaço Económico Europeu, são aplicadas
          as Cláusulas Contratuais-Tipo aprovadas pela Comissão Europeia.
        </Bullet>
      </Section>

      <Section title="6. Quanto tempo guardamos">
        <Bullet>
          <B>Conta ativa:</B> enquanto a conta existir.
        </Bullet>
        <Bullet>
          <B>Após eliminação da conta:</B> os dados são apagados em 30 dias, exceto
          quando a lei imponha conservação superior (por exemplo, faturação fiscal — 10
          anos).
        </Bullet>
        <Bullet>
          <B>Sessões:</B> expiram em 7 dias.
        </Bullet>
        <Bullet>
          <B>Logs operacionais:</B> 30 dias.
        </Bullet>
        <Bullet>
          <B>Estatísticas anónimas de utilização:</B> eventos apagados após 400 dias;
          relatórios apenas com valores agregados.
        </Bullet>
      </Section>

      <Section title="7. Os seus direitos">
        <P>
          Pode, a qualquer momento, exercer os direitos garantidos pelo RGPD:
        </P>
        <Bullet><B>Acesso:</B> consultar que dados temos sobre si.</Bullet>
        <Bullet><B>Retificação:</B> corrigir dados incorretos no seu perfil.</Bullet>
        <Bullet>
          <B>Apagamento (&quot;direito ao esquecimento&quot;):</B> eliminar a sua
          conta e todos os dados associados em <Link onPress={() => router.push('/profile')}>Perfil → Conta</Link>.
        </Bullet>
        <Bullet>
          <B>Portabilidade:</B> exportar uma cópia dos seus dados em formato JSON na
          mesma área.
        </Bullet>
        <Bullet><B>Oposição</B> e <B>limitação do tratamento</B>.</Bullet>
        <Bullet>
          <B>Reclamação:</B> junto da Comissão Nacional de Proteção de Dados (CNPD) —{' '}
          <Link onPress={() => Linking.openURL('https://www.cnpd.pt')}>www.cnpd.pt</Link>.
        </Bullet>
      </Section>

      <Section title="8. Segurança">
        <Bullet>
          Palavras-passe armazenadas com bcrypt; comunicação cifrada com TLS 1.2 ou
          superior; tokens de sessão HTTP-only e secure; rate-limiting e proteção CSRF.
        </Bullet>
        <Bullet>
          Notificaremos a CNPD em 72 horas no caso de violação de dados que possa
          implicar risco para os utilizadores afetados, conforme art.º 33.º RGPD.
        </Bullet>
      </Section>

      <Section title="9. Menores">
        <P>
          A plataforma não se dirige a menores de 14 anos. Se tomarmos conhecimento de
          que uma conta foi criada por um menor sem consentimento parental, eliminá-la-emos.
        </P>
      </Section>

      <Section title="10. Alterações a esta política">
        <P>
          Eventuais alterações são anunciadas com 30 dias de antecedência por e-mail e
          dentro da aplicação. A versão em vigor é sempre a publicada nesta página com a
          data de última atualização visível no topo.
        </P>
      </Section>

      <Disclaimer>
        Documento informativo. A versão definitiva está sujeita a revisão jurídica
        antes do lançamento público.
      </Disclaimer>
    </LegalPage>
  );
}
