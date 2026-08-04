/**
 * Turismo Inclusivo — Portugal para todos
 *
 * Acessibilidade tratada como informação verificável: praias com apoio balnear,
 * percursos em plataforma contínua, alojamento pet-friendly e rotas familiares,
 * com leitura própria por região.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getModuleTheme, withOpacity, onColor } from '../../src/theme/colors';
import ModuleHighlights from '../../src/components/module/ModuleHighlights';
import ModuleGuideCta from '../../src/components/module/ModuleGuideCta';
import ModuleHistory from '../../src/components/module/ModuleHistory';
import ModuleLinks from '../../src/components/module/ModuleLinks';

const MT = getModuleTheme('inclusivo');
const C = {
  bg: MT.bg,
  card: MT.card,
  accent: MT.accent,
  accentMuted: MT.accentMuted,
  textDark: MT.textPrimary,
  textMed: MT.textSecondary,
  textLight: MT.textMuted,
  border: withOpacity(MT.textPrimary, 0.12),
  onAccent: onColor(MT.accent),
};

interface RegionalRead {
  title: string;
  desc: string;
}

const REGIONS: { id: string; label: string }[] = [
  { id: 'norte', label: 'Norte' },
  { id: 'centro', label: 'Centro' },
  { id: 'lisboa', label: 'Lisboa e Vale do Tejo' },
  { id: 'alentejo', label: 'Alentejo' },
  { id: 'algarve', label: 'Algarve' },
  { id: 'acores', label: 'Açores' },
  { id: 'madeira', label: 'Madeira' },
];

/** Leituras de acessibilidade por região — 3 por região. */
const REGIONAL_READS: Record<string, RegionalRead[]> = {
  norte: [
    { title: 'Praias acessíveis de Matosinhos a Vila do Conde', desc: 'Passadeira até à água, cadeira anfíbia e apoio de nadador-salvador na época balnear — confirme no posto de praia.' },
    { title: 'Metro do Porto e frente ribeirinha', desc: 'Toda a rede tem elevador e piso tátil; a marginal do Douro dá um percurso plano até à Foz.' },
    { title: 'Ecopistas do Tâmega e do Corgo', desc: 'Antigas linhas férreas em plataforma contínua, sem degraus e com desnível mínimo.' },
  ],
  centro: [
    { title: 'Museus e centros de ciência acessíveis', desc: 'Museu Vista Alegre, Ciência Viva de Aveiro e Museu do Papel têm circuito completo sem degraus.' },
    { title: 'Passadiços do Mondego em troço plano', desc: 'O troço junto à Ponte da Mucela é o mais regular; os acessos de Góis têm estacionamento adaptado.' },
    { title: 'Aldeias históricas — planear a visita', desc: 'Piódão e Monsanto têm calçada irregular e declives: escolha os miradouros com estacionamento próximo e apoio.' },
  ],
  lisboa: [
    { title: 'Praias com cadeira anfíbia na Caparica e Cascais', desc: 'Várias praias têm passadeira, cadeira anfíbia e apoio de banho assistido entre junho e setembro.' },
    { title: 'Metro, elevadores e Belém', desc: 'Quase todas as estações têm elevador; a frente ribeirinha de Belém a Algés é plana e contínua.' },
    { title: 'Museus com apoio adaptado', desc: 'Gulbenkian, MAAT e Oceanário têm percursos acessíveis, visitas em LGP e material tátil por marcação.' },
  ],
  alentejo: [
    { title: 'Évora acessível no centro histórico', desc: 'O circuito Templo–Sé–Praça do Giraldo tem calçada regularizada; peça o mapa acessível no posto de turismo.' },
    { title: 'Alqueva e barcos com acesso', desc: 'Os cais de Amieira têm rampas e há embarcações com embarque adaptado por marcação.' },
    { title: 'Observação de céu escuro sem trilho', desc: 'As sessões Dark Sky fazem-se em plataformas com acesso de carro — não exigem caminhada.' },
  ],
  algarve: [
    { title: 'Rede de praias acessíveis do sotavento', desc: 'A maior concentração do país: passadeira, cadeira anfíbia e apoio balnear em praias de Faro a Monte Gordo.' },
    { title: 'Passadiços da Ria Formosa em Marim', desc: 'Plataforma contínua com painéis e miradouros, adequada a cadeira de rodas com acompanhante.' },
    { title: 'Ecovia do Litoral em troços planos', desc: 'Os segmentos de Tavira a Cabanas e da Praia de Faro são planos e pavimentados.' },
  ],
  acores: [
    { title: 'Frentes de mar acessíveis', desc: 'Ponta Delgada, Angra e Horta têm marginais planas, com miradouros e piscinas com rampa.' },
    { title: 'Furnas e caldeiras com acesso de carro', desc: 'O percurso das caldeiras e o Terra Nostra permitem ver a atividade geotérmica sem trilho.' },
    { title: 'Observação de cetáceos com embarque assistido', desc: 'Alguns operadores têm barco com acesso facilitado — confirme sempre por telefone na véspera.' },
  ],
  madeira: [
    { title: 'Funchal e teleféricos', desc: 'A baixa, a marginal e o teleférico do Monte formam um circuito acessível com vista de encosta.' },
    { title: 'Miradouros com acesso adaptado', desc: 'Cabo Girão tem skywalk com piso regular e estacionamento adaptado, sem necessidade de caminhada.' },
    { title: 'Piscinas naturais com estrutura', desc: 'Porto Moniz tem acesso adaptado ao complexo principal, com vestiários e rampa.' },
  ],
};

export default function InclusivoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeRegion, setActiveRegion] = useState(REGIONS[0].id);

  const reads = REGIONAL_READS[activeRegion] ?? [];
  const regionLabel = REGIONS.find((r) => r.id === activeRegion)?.label ?? '';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <MaterialIcons name="arrow-back" size={22} color={C.textDark} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Turismo Inclusivo</Text>
            <Text style={styles.headerSubtitle}>Portugal para todos</Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialIcons name="accessible" size={24} color={C.accent} />
          </View>
        </View>

        <Text style={styles.intro}>
          Praias, percursos e equipamentos acessíveis — informação verificada para
          mobilidade reduzida, famílias e animais.
        </Text>

        <ModuleHighlights module="inclusivo" />
        <ModuleGuideCta module="inclusivo" />


        {/* ── Leitura por região ─────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>REGIÃO</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {REGIONS.map((r) => {
            const on = r.id === activeRegion;
            return (
              <TouchableOpacity
                key={r.id}
                style={[styles.chip, on && styles.chipActive]}
                onPress={() => setActiveRegion(r.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.chipText, on && styles.chipTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.readsWrap}>
          <Text style={styles.readsTitle}>Acessibilidade no {regionLabel}</Text>
          {reads.map((r) => (
            <View key={r.title} style={styles.readCard}>
              <MaterialIcons name="check-circle" size={17} color={C.accent} style={styles.readIcon} />
              <View style={styles.readBody}>
                <Text style={styles.readTitle}>{r.title}</Text>
                <Text style={styles.readDesc}>{r.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── História e Ligações (módulo temático) ─────────────────────── */}
        <ModuleHistory module="inclusivo" />
        <ModuleLinks module="inclusivo" />

        {/* ── Info Footer ────────────────────────────────────────────────── */}
        <View style={styles.infoFooter}>
          <MaterialIcons name="info-outline" size={14} color={C.textLight} />
          <Text style={styles.infoFooterText}>
            Confirme sempre o apoio disponível junto do posto de praia ou do município.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.card,
  },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: C.textDark },
  headerSubtitle: { fontSize: 13, color: C.textMed, marginTop: 2 },
  headerIcon: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.accentMuted,
  },

  intro: {
    fontSize: 14, lineHeight: 21, color: C.textMed,
    paddingHorizontal: 20, marginBottom: 18,
  },


  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: C.textLight,
    paddingHorizontal: 20, marginBottom: 8,
  },
  chipsRow: { paddingHorizontal: 20, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { fontSize: 12.5, fontWeight: '600', color: C.textMed },
  chipTextActive: { color: C.onAccent },

  readsWrap: { paddingHorizontal: 20, marginTop: 18, marginBottom: 28 },
  readsTitle: { fontSize: 16, fontWeight: '700', color: C.textDark, marginBottom: 10 },
  readCard: {
    flexDirection: 'row', gap: 10,
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 13, marginBottom: 8,
  },
  readIcon: { marginTop: 1 },
  readBody: { flex: 1, minWidth: 0 },
  readTitle: { fontSize: 13.5, fontWeight: '700', color: C.textDark },
  readDesc: { fontSize: 12.5, lineHeight: 18, color: C.textMed, marginTop: 3 },

  infoFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 20, marginTop: 4,
  },
  infoFooterText: { flex: 1, fontSize: 11.5, lineHeight: 16, color: C.textLight },
});
