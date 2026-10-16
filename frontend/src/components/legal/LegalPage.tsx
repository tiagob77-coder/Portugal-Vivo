/**
 * Estrutura comum das páginas legais: cabeçalho com "voltar", data de
 * atualização, secções, listas, links e o bloco de identificação da entidade.
 *
 * As cores foram escolhidas para cumprir WCAG 2.1 AA (≥ 4,5:1) sobre o fundo
 * da página — ver LEGAL_PAGE_COLORS e o teste correspondente. Estas são as
 * páginas onde a Declaração de Acessibilidade é publicada; têm de cumprir o
 * que ela promete.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Head from 'expo-router/head';
import { LEGAL_ENTITY } from '../../config/legalEntity';

export const LEGAL_PAGE_COLORS = {
  background: '#2E5E4E',
  heading: '#FAF8F3',
  text: '#E2E8F0',
  meta: '#B7D3C4',
  link: '#EFD3AE',
  disclaimer: '#CBD5E1',
  /** Só decorativo (marcador de lista, ícones): sem requisito de contraste de texto. */
  ornament: '#C49A6C',
} as const;

const C = LEGAL_PAGE_COLORS;

interface LegalPageProps {
  title: string;
  /** <title> do documento web. */
  headTitle: string;
  description: string;
  lastUpdated: string;
  lead?: React.ReactNode;
  children: React.ReactNode;
}

export function LegalPage({ title, headTitle, description, lastUpdated, lead, children }: LegalPageProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Head>
        <title>{headTitle}</title>
        <meta name="description" content={description} />
      </Head>

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <MaterialIcons name="arrow-back" size={24} color={C.heading} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">{title}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 48 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.meta}>Última atualização: {lastUpdated}</Text>
        {lead ? <Text style={styles.lead}>{lead}</Text> : null}
        {children}
      </ScrollView>
    </View>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
      {children}
    </View>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

export function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot} importantForAccessibility="no" accessibilityElementsHidden>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

export function B({ children }: { children: React.ReactNode }) {
  return <Text style={styles.bold}>{children}</Text>;
}

export function Link({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  return (
    <Text style={styles.link} onPress={onPress} accessibilityRole="link">
      {children}
    </Text>
  );
}

/** Link `mailto:` com assunto pré-preenchido. */
export function MailLink({ email, subject }: { email: string; subject: string }) {
  return (
    <Link onPress={() => Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}`)}>
      {email}
    </Link>
  );
}

export function ExternalLink({ url, children }: { url: string; children: React.ReactNode }) {
  return <Link onPress={() => Linking.openURL(url)}>{children}</Link>;
}

/** Identificação do prestador (DL 7/2004, art. 10.º; RGPD, art. 13.º). */
export function LegalEntityDetails() {
  const e = LEGAL_ENTITY;
  return (
    <View style={styles.entity} accessibilityLabel="Identificação do responsável">
      <Text style={styles.entityLine}><B>{e.holderName}</B></Text>
      <Text style={styles.entityLine}>{e.legalForm}, titular da marca {e.brand}</Text>
      <Text style={styles.entityLine}>NIF {e.nif}</Text>
      <Text style={styles.entityLine}>{e.address}, {e.country}</Text>
    </View>
  );
}

export function Disclaimer({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.disclaimer}>
      <MaterialIcons name="info-outline" size={20} color={C.disclaimer} />
      <Text style={styles.disclaimerText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  backButton: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { color: C.heading, fontSize: 16, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  placeholder: { width: 44 },
  content: { flex: 1, paddingHorizontal: 20 },
  meta: { color: C.meta, fontSize: 12, marginTop: 16, marginBottom: 4 },
  lead: { color: C.heading, fontSize: 15, lineHeight: 22, marginBottom: 12 },
  section: { marginTop: 18 },
  sectionTitle: { color: C.heading, fontSize: 17, fontWeight: '700', marginBottom: 8 },
  paragraph: { color: C.text, fontSize: 14, lineHeight: 21 },
  bulletRow: { flexDirection: 'row', marginBottom: 6 },
  bulletDot: { color: C.ornament, fontSize: 16, lineHeight: 21, width: 16 },
  bulletText: { color: C.text, fontSize: 14, lineHeight: 21, flex: 1 },
  bold: { fontWeight: '700', color: C.heading },
  link: { color: C.link, textDecorationLine: 'underline' },
  entity: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    borderLeftColor: C.ornament,
  },
  entityLine: { color: C.text, fontSize: 14, lineHeight: 21 },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  disclaimerText: { color: C.disclaimer, fontSize: 12, flex: 1, lineHeight: 18 },
});
