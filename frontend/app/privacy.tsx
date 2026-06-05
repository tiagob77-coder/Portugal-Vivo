import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Head from 'expo-router/head';

// Date of last revision shown to the user. Update whenever the substantive
// content of this page changes — auditors and DPAs rely on this date as the
// effective version of the policy that the user agreed to.
const LAST_UPDATED = '14 de maio de 2026';

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const mailto = (subject: string) =>
    Linking.openURL(`mailto:privacidade@portugalvivo.pt?subject=${encodeURIComponent(subject)}`);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Head>
        <title>Política de Privacidade — Portugal Vivo</title>
        <meta
          name="description"
          content="Como o Portugal Vivo recolhe, usa e protege os seus dados pessoais."
        />
      </Head>

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#FAF8F3" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Política de Privacidade</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 48 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.meta}>Última atualização: {LAST_UPDATED}</Text>
        <Text style={styles.lead}>
          Este documento descreve como o Portugal Vivo trata os dados pessoais dos seus
          utilizadores, em cumprimento do Regulamento (UE) 2016/679 (RGPD) e da Lei n.º
          58/2019 (Lei de Execução do RGPD em Portugal).
        </Text>

        <Section title="1. Responsável pelo tratamento">
          <P>
            O responsável pelo tratamento dos dados pessoais recolhidos através desta
            plataforma é o Portugal Vivo, com sede em Portugal. Para qualquer questão
            relacionada com este documento ou com o tratamento dos seus dados, pode
            contactar-nos em{' '}
            <Link onPress={() => mailto('Privacidade')}>privacidade@portugalvivo.pt</Link>.
          </P>
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
        </Section>

        <Section title="3. Finalidades e bases legais">
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
            individual).
          </Bullet>
        </Section>

        <Section title="4. Com quem partilhamos">
          <Bullet>
            <B>Subcontratantes</B> sujeitos a contratos de tratamento conformes ao art.º
            28.º RGPD: MongoDB Atlas (alojamento de BD), Cloudinary (alojamento de
            imagens), Stripe (pagamentos premium), Sentry (monitorização de erros) e o
            fornecedor de modelo de linguagem usado para gerar narrativas.
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

        <Section title="5. Quanto tempo guardamos">
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
        </Section>

        <Section title="6. Os seus direitos">
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

        <Section title="7. Segurança">
          <Bullet>
            Palavras-passe armazenadas com bcrypt; comunicação cifrada com TLS 1.2 ou
            superior; tokens de sessão HTTP-only e secure; rate-limiting e proteção CSRF.
          </Bullet>
          <Bullet>
            Notificaremos a CNPD em 72 horas no caso de violação de dados que possa
            implicar risco para os utilizadores afetados, conforme art.º 33.º RGPD.
          </Bullet>
        </Section>

        <Section title="8. Menores">
          <P>
            A plataforma não se dirige a menores de 14 anos. Se tomarmos conhecimento de
            que uma conta foi criada por um menor sem consentimento parental, eliminá-la-emos.
          </P>
        </Section>

        <Section title="9. Alterações a esta política">
          <P>
            Eventuais alterações são anunciadas com 30 dias de antecedência por e-mail e
            dentro da aplicação. A versão em vigor é sempre a publicada nesta página com a
            data de última atualização visível no topo.
          </P>
        </Section>

        <View style={styles.disclaimer}>
          <MaterialIcons name="info-outline" size={20} color="#94A3B8" />
          <Text style={styles.disclaimerText}>
            Documento informativo. A versão definitiva está sujeita a revisão jurídica
            antes do lançamento público.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <Text style={styles.bold}>{children}</Text>;
}

function Link({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  return (
    <Text style={styles.link} onPress={onPress}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2E5E4E' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { color: '#FAF8F3', fontSize: 16, fontWeight: '600' },
  placeholder: { width: 40 },
  content: { flex: 1, paddingHorizontal: 20 },
  meta: { color: '#A8C9B7', fontSize: 12, marginTop: 16, marginBottom: 4 },
  lead: { color: '#FAF8F3', fontSize: 15, lineHeight: 22, marginBottom: 12 },
  section: { marginTop: 18 },
  sectionTitle: {
    color: '#FAF8F3', fontSize: 17, fontWeight: '700', marginBottom: 8,
  },
  paragraph: { color: '#E2E8F0', fontSize: 14, lineHeight: 21 },
  bulletRow: { flexDirection: 'row', marginBottom: 6 },
  bulletDot: { color: '#C49A6C', fontSize: 16, lineHeight: 21, width: 16 },
  bulletText: { color: '#E2E8F0', fontSize: 14, lineHeight: 21, flex: 1 },
  bold: { fontWeight: '700', color: '#FAF8F3' },
  link: { color: '#C49A6C', textDecorationLine: 'underline' },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  disclaimerText: { color: '#94A3B8', fontSize: 12, flex: 1, lineHeight: 18 },
});
