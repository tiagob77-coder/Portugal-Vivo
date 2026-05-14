import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Head from 'expo-router/head';

const LAST_UPDATED = '14 de maio de 2026';

export default function TermsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const mailto = (subject: string) =>
    Linking.openURL(`mailto:legal@portugalvivo.pt?subject=${encodeURIComponent(subject)}`);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Head>
        <title>Termos de Utilização — Portugal Vivo</title>
        <meta
          name="description"
          content="Regras de utilização da plataforma Portugal Vivo."
        />
      </Head>

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#FAF8F3" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Termos de Utilização</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 48 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.meta}>Última atualização: {LAST_UPDATED}</Text>
        <Text style={styles.lead}>
          Ao criar uma conta ou usar a aplicação Portugal Vivo, aceita os termos
          descritos abaixo. Leia atentamente antes de continuar.
        </Text>

        <Section title="1. Objeto e enquadramento">
          <P>
            Estes termos regulam a relação entre o Portugal Vivo (a &quot;Plataforma&quot;)
            e o utilizador, ao abrigo do Decreto-Lei n.º 7/2004 (comércio eletrónico) e da
            restante legislação portuguesa e europeia aplicável.
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
            <Link onPress={() => router.push('/privacy' as any)}>Política de Privacidade</Link>,
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
            Em alternativa, à plataforma europeia de resolução de litígios em linha (RLL)
            em{' '}
            <Link onPress={() => Linking.openURL('https://ec.europa.eu/consumers/odr')}>
              ec.europa.eu/consumers/odr
            </Link>.
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
            <Link onPress={() => mailto('Termos')}>legal@portugalvivo.pt</Link>.
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
  sectionTitle: { color: '#FAF8F3', fontSize: 17, fontWeight: '700', marginBottom: 8 },
  paragraph: { color: '#E2E8F0', fontSize: 14, lineHeight: 21 },
  bulletRow: { flexDirection: 'row', marginBottom: 6 },
  bulletDot: { color: '#C49A6C', fontSize: 16, lineHeight: 21, width: 16 },
  bulletText: { color: '#E2E8F0', fontSize: 14, lineHeight: 21, flex: 1 },
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
