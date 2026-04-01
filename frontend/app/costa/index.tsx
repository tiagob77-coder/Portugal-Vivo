/**
 * Linha de Costa - Portugal's coastal zones explorer (Minho → Algarve)
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CoastalDataCard from '../../src/components/CoastalDataCard';
import { getModuleTheme } from '../../src/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MT = getModuleTheme('costa');
const C = {
  bg: MT.bg,
  card: MT.card,
  ocean: MT.accent,
  oceanLight: '#0891B2',
  sand: '#D97706',
  sandLight: '#FEF3C7',
  foam: '#E0F2FE',
  mint: '#D1FAE5',
  textDark: MT.textPrimary,
  textMed: MT.textSecondary,
  textLight: MT.textMuted,
  border: '#E2E8F0',
  accent: '#F97316',
  danger: '#DC2626',
  safe: '#16A34A',
};

// ─── Data ────────────────────────────────────────────────────────────────────

interface ProfileScores {
  surfista: number;
  familia: number;
  fotografo: number;
  natureza: number;
}

interface CoastalZone {
  id: string;
  order: number;
  nome: string;
  regiao: string;
  descricao: string;
  perfis: ProfileScores;
  praias: string[];
  lenda: string;
  biodiversidade: string[];
  condicoes: {
    ondas_media_m: number;
    vento_predominante: string;
    melhor_epoca: string;
    seguranca: string;
  };
}

const COASTAL_ZONES: CoastalZone[] = [
  {
    id: 'minho',
    order: 1,
    nome: 'Costa do Minho',
    regiao: 'Norte',
    descricao: 'Costa rochosa e agreste a norte do rio Minho, com praias selvagens e dunas intactas. O verde galego funde-se com o azul atlântico numa paisagem única.',
    perfis: { surfista: 3, familia: 3, fotografo: 5, natureza: 5 },
    praias: ['Moledo', 'Âncora', 'Afife'],
    lenda: 'Diz a lenda que as Mouras Encantadas habitam as grutas costeiras do Minho, e que nas noites de lua cheia se ouve o seu canto a guiar os pescadores perdidos em segurança até à costa.',
    biodiversidade: ['Lontra-europeia (Lutra lutra)', 'Cegonha-branca (Ciconia ciconia)', 'Garça-real (Ardea cinerea)'],
    condicoes: {
      ondas_media_m: 1.8,
      vento_predominante: 'NO',
      melhor_epoca: 'Verão',
      seguranca: 'media',
    },
  },
  {
    id: 'viana',
    order: 2,
    nome: 'Costa de Viana',
    regiao: 'Norte',
    descricao: 'Entre o Lima e o Neiva, praias extensas de areia fina alternam com estuários ricos em aves. Viana do Castelo domina a paisagem com a sua basílica no alto do monte.',
    perfis: { surfista: 4, familia: 4, fotografo: 4, natureza: 4 },
    praias: ['Cabedelo', 'Carreço', 'Gelfa'],
    lenda: 'A lenda de Viana conta que uma sereia chamada Viana se apaixonou por um pescador local e, ao não poder viver em terra, transformou-se no próprio rio Lima para o acompanhar eternamente.',
    biodiversidade: ['Corvina (Argyrosomus regius)', 'Maçarico-real (Numenius arquata)', 'Linguado (Solea solea)'],
    condicoes: {
      ondas_media_m: 2.1,
      vento_predominante: 'N',
      melhor_epoca: 'Verão',
      seguranca: 'media',
    },
  },
  {
    id: 'esposende',
    order: 3,
    nome: 'Costa de Esposende',
    regiao: 'Norte',
    descricao: 'O Parque Natural do Litoral Norte protege dunas e lagoas costeiras únicas. Praias desertas e o estuário do Cávado criam habitats de exceção para aves migratórias.',
    perfis: { surfista: 3, familia: 4, fotografo: 5, natureza: 5 },
    praias: ['Apúlia', 'Ofir', 'Fão'],
    lenda: 'Os pescadores de Esposende guardam a memória do Homem do Nevoeiro, um espírito que surge nas manhãs de bruma para guiar as embarcações através das barras traiçoeiras do Cávado.',
    biodiversidade: ['Perna-longa (Himantopus himantopus)', 'Saraiva-comum (Gallinago gallinago)', 'Borboleta-monarca (Danaus plexippus)'],
    condicoes: {
      ondas_media_m: 1.9,
      vento_predominante: 'NO',
      melhor_epoca: 'Primavera / Outono',
      seguranca: 'alta',
    },
  },
  {
    id: 'porto',
    order: 4,
    nome: 'Costa do Porto',
    regiao: 'Norte',
    descricao: 'Das praias urbanas de Matosinhos às ondas míticas de Matosinhos e Foz do Douro, esta é a costa mais dinâmica do norte. Cultura, gastronomia e surf em perfeita simbiose.',
    perfis: { surfista: 5, familia: 3, fotografo: 4, natureza: 2 },
    praias: ['Matosinhos', 'Leça da Palmeira', 'Miramar'],
    lenda: 'A Coca de Matosinhos é um dragão marinho da mitologia local que, segundo a tradição, surge nos mares tempestuosos de inverno e só é domado pela intercessão de São Mateus, padroeiro dos pescadores.',
    biodiversidade: ['Gaivota-argêntea (Larus argentatus)', 'Corvo-marinho (Phalacrocorax carbo)', 'Robalo (Dicentrarchus labrax)'],
    condicoes: {
      ondas_media_m: 2.4,
      vento_predominante: 'N',
      melhor_epoca: 'Outono / Inverno',
      seguranca: 'media',
    },
  },
  {
    id: 'aveiro',
    order: 5,
    nome: 'Costa de Aveiro',
    regiao: 'Centro',
    descricao: 'A Ria de Aveiro cria uma paisagem única de lagunas, salinas e canais. A costa atlântica exposta às suas costas esconde praias absolutamente selvagens acessíveis apenas a pé.',
    perfis: { surfista: 4, familia: 5, fotografo: 5, natureza: 5 },
    praias: ['Costa Nova', 'Barra', 'São Jacinto'],
    lenda: 'Conta-se que a Ria de Aveiro foi criada pelas lágrimas da Infanta Santa Joana ao contemplar, do alto do seu mosteiro, a beleza incomensurável do pôr do sol sobre as lagoas e salinas douradas.',
    biodiversidade: ['Flamingo-rosa (Phoenicopterus roseus)', 'Lontra-europeia (Lutra lutra)', 'Enguia-europeia (Anguilla anguilla)'],
    condicoes: {
      ondas_media_m: 2.2,
      vento_predominante: 'NO',
      melhor_epoca: 'Verão',
      seguranca: 'alta',
    },
  },
  {
    id: 'coimbra',
    order: 6,
    nome: 'Costa da Figueira',
    regiao: 'Centro',
    descricao: 'A Figueira da Foz marca a foz do Mondego num litoral de praias enormes e ondas consistentes. Boa onda para surfistas e amplas extensões para famílias em dias calmos.',
    perfis: { surfista: 5, familia: 4, fotografo: 3, natureza: 3 },
    praias: ['Buarcos', 'Quiaios', 'Mira'],
    lenda: 'A lenda do Peixe Rei da Figueira narra que um peixe gigante e luminoso habita as profundezas da barra do Mondego e que, quando o avistam, é sinal de tempestade iminente.',
    biodiversidade: ['Toirão (Mustela putorius)', 'Rola-turca (Streptopelia decaocto)', 'Robalo (Dicentrarchus labrax)'],
    condicoes: {
      ondas_media_m: 2.5,
      vento_predominante: 'N',
      melhor_epoca: 'Outono / Inverno',
      seguranca: 'media',
    },
  },
  {
    id: 'peniche',
    order: 7,
    nome: 'Costa de Peniche',
    regiao: 'Centro',
    descricao: 'Peniche é capital do surf português. Supertubos é uma das ondas mais perfeitas do mundo. A Berlenga, ilha-reserva natural, emerge no oceano como um mundo à parte.',
    perfis: { surfista: 5, familia: 3, fotografo: 5, natureza: 4 },
    praias: ['Supertubos', 'Consolação', 'Baleal'],
    lenda: 'A Ilha da Berlenga guarda o lendário Castelo dos Cavaleiros de Malta, onde se diz que os templários esconderam um tesouro incalculável em cavernas submarinas acessíveis apenas durante os equinócios.',
    biodiversidade: ['Airo-comum (Uria aalge)', 'Alcatraz (Morus bassanus)', 'Lagosta-europeia (Homarus gammarus)'],
    condicoes: {
      ondas_media_m: 2.8,
      vento_predominante: 'NW',
      melhor_epoca: 'Outono / Inverno',
      seguranca: 'baixa',
    },
  },
  {
    id: 'sintra',
    order: 8,
    nome: 'Costa de Sintra',
    regiao: 'Lisboa',
    descricao: 'O Cabo da Roca marca o ponto mais ocidental da Europa continental. Praias dramáticas entre falésias de granito e vegetação de neblina criam uma atmosfera verdadeiramente mágica.',
    perfis: { surfista: 4, familia: 2, fotografo: 5, natureza: 5 },
    praias: ['Praia Grande', 'Azenhas do Mar', 'Guincho'],
    lenda: 'No Cabo da Roca, Camões escreveu "Aqui... onde a terra se acaba e o mar começa." A lenda local afirma que nas noites sem lua os espíritos dos navegadores perdidos se reúnem na ponta extrema da rocha para contemplar a eternidade do Atlântico.',
    biodiversidade: ['Falcão-peregrino (Falco peregrinus)', 'Golfinho-comum (Delphinus delphis)', 'Narciso-de-Sintra (Narcissus calcicola)'],
    condicoes: {
      ondas_media_m: 2.6,
      vento_predominante: 'N',
      melhor_epoca: 'Verão',
      seguranca: 'baixa',
    },
  },
  {
    id: 'setubal',
    order: 9,
    nome: 'Costa de Setúbal',
    regiao: 'Lisboa',
    descricao: 'A Arrábida esconde praias de água turquesa e calcário branco que parecem pertencer ao Mediterrâneo. O Parque Natural protege um dos últimos ecossistemas marinhos virgens de Portugal.',
    perfis: { surfista: 2, familia: 5, fotografo: 5, natureza: 5 },
    praias: ['Portinho da Arrábida', 'Galapinhos', 'Sesimbra'],
    lenda: 'Os monges franciscanos que fundaram o convento da Arrábida no século XVI acreditavam que o local era habitado por espíritos da floresta que protegiam os mergulhadores das tempestades e dos afogamentos.',
    biodiversidade: ['Golfinho-roaz (Tursiops truncatus)', 'Camaleão (Chamaeleo chamaeleon)', 'Lince-ibérico (Lynx pardinus)'],
    condicoes: {
      ondas_media_m: 1.2,
      vento_predominante: 'W',
      melhor_epoca: 'Verão',
      seguranca: 'muito_alta',
    },
  },
  {
    id: 'algarve',
    order: 10,
    nome: 'Costa do Algarve',
    regiao: 'Algarve',
    descricao: 'As falésias douradas de calcário e grés, a água cristalina e as grutas naturais tornam o Algarve num dos litorais mais fotogénicos do mundo. Praias de todos os perfis, do surf ao lazer familiar.',
    perfis: { surfista: 4, familia: 5, fotografo: 5, natureza: 4 },
    praias: ['Benagil', 'Meia Praia', 'Sagres'],
    lenda: 'A Gruta de Benagil, com o seu oculus natural aberto ao céu, é chamada pelos pescadores locais de "Olho de Deus". Diz a lenda que no verão, ao meio-dia, a luz que entra pela abertura ilumina por breves instantes o rosto dos que a merecem.',
    biodiversidade: ['Tartaruga-careta (Caretta caretta)', 'Atum-rabilho (Thunnus thynnus)', 'Polvo-comum (Octopus vulgaris)'],
    condicoes: {
      ondas_media_m: 1.5,
      vento_predominante: 'W',
      melhor_epoca: 'Primavera / Verão',
      seguranca: 'alta',
    },
  },
];

// ─── Profile Filter Config ────────────────────────────────────────────────────

type ProfileKey = 'surfista' | 'familia' | 'fotografo' | 'natureza';

const PROFILES: { key: ProfileKey; label: string; emoji: string }[] = [
  { key: 'surfista', label: 'Surfista', emoji: '🤙' },
  { key: 'familia', label: 'Família', emoji: '👨‍👩‍👧' },
  { key: 'fotografo', label: 'Fotógrafo', emoji: '📸' },
  { key: 'natureza', label: 'Natureza', emoji: '🌿' },
];

// ─── Zone Card ────────────────────────────────────────────────────────────────

interface ZoneCardProps {
  zone: CoastalZone;
  activeProfile: ProfileKey | null;
  onPress: () => void;
  isExpanded: boolean;
}

function ProfileDots({ score }: { score: number }) {
  return (
    <View style={cardStyles.dotsRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={[
            cardStyles.dot,
            i <= score ? cardStyles.dotFilled : cardStyles.dotEmpty,
          ]}
        />
      ))}
    </View>
  );
}

function ZoneCard({ zone, activeProfile, onPress, isExpanded }: ZoneCardProps) {
  const expandAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();

  React.useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [isExpanded, expandAnim]);

  const profileScore = activeProfile ? zone.perfis[activeProfile] : null;

  const regionColor = {
    'Norte': '#2563EB',
    'Centro': '#059669',
    'Lisboa': '#DC2626',
    'Algarve': '#C49A6C',
  }[zone.regiao] || C.ocean;

  return (
    <View style={cardStyles.card}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={cardStyles.cardTouchable}
      >
        {/* Zone header row */}
        <View style={cardStyles.headerRow}>
          <View style={cardStyles.orderBadge}>
            <Text style={cardStyles.orderText}>{zone.order}</Text>
          </View>
          <View style={cardStyles.titleBlock}>
            <Text style={cardStyles.zoneName}>{zone.nome}</Text>
            <View style={[cardStyles.regiaoChip, { backgroundColor: regionColor + '18' }]}>
              <Text style={[cardStyles.regiaoText, { color: regionColor }]}>{zone.regiao}</Text>
            </View>
          </View>
          <MaterialIcons
            name={isExpanded ? 'expand-less' : 'expand-more'}
            size={22}
            color={C.textLight}
          />
        </View>

        {/* Description */}
        <Text style={cardStyles.descricao} numberOfLines={isExpanded ? undefined : 2}>
          {zone.descricao}
        </Text>

        {/* Profile score */}
        {activeProfile && (
          <View style={cardStyles.profileScoreRow}>
            <Text style={cardStyles.profileScoreLabel}>
              {PROFILES.find((p) => p.key === activeProfile)?.emoji}{' '}
              {PROFILES.find((p) => p.key === activeProfile)?.label}
            </Text>
            <ProfileDots score={profileScore ?? 0} />
          </View>
        )}

        {/* Beaches */}
        <View style={cardStyles.beachesRow}>
          {zone.praias.map((praia) => (
            <View key={praia} style={cardStyles.beachChip}>
              <MaterialIcons name="beach-access" size={11} color={C.ocean} />
              <Text style={cardStyles.beachChipText}>{praia}</Text>
            </View>
          ))}
        </View>

        {/* Ver detalhes button */}
        <TouchableOpacity
          style={cardStyles.detailsBtn}
          onPress={() => router.push(`/costa/${zone.id}` as any)}
          activeOpacity={0.8}
        >
          <Text style={cardStyles.detailsBtnText}>Ver detalhes</Text>
          <MaterialIcons name="arrow-forward" size={14} color={C.ocean} />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Expanded content */}
      {isExpanded && (
        <View style={cardStyles.expandedSection}>
          {/* Lenda */}
          <View style={cardStyles.lendaBlock}>
            <View style={cardStyles.lendaHeader}>
              <MaterialIcons name="auto-stories" size={16} color={C.sand} />
              <Text style={cardStyles.lendaTitle}>Lenda Local</Text>
            </View>
            <Text style={cardStyles.lendaText}>{zone.lenda}</Text>
          </View>

          {/* Biodiversidade */}
          <View style={cardStyles.bioBlock}>
            <View style={cardStyles.bioHeader}>
              <MaterialIcons name="eco" size={16} color={C.safe} />
              <Text style={cardStyles.bioTitle}>Biodiversidade</Text>
            </View>
            {zone.biodiversidade.map((especie) => (
              <View key={especie} style={cardStyles.bioItem}>
                <View style={cardStyles.bioDot} />
                <Text style={cardStyles.bioText}>{especie}</Text>
              </View>
            ))}
          </View>

          {/* Coastal Data Card */}
          <CoastalDataCard zone={zone} />
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CostaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeProfile, setActiveProfile] = useState<ProfileKey | null>(null);
  const [expandedZone, setExpandedZone] = useState<string | null>(null);

  const filteredZones = activeProfile
    ? COASTAL_ZONES.filter((z) => z.perfis[activeProfile] >= 4)
    : COASTAL_ZONES;

  const handleZonePress = (zoneId: string) => {
    setExpandedZone(expandedZone === zoneId ? null : zoneId);
  };

  const activeZoneIndex = expandedZone
    ? COASTAL_ZONES.findIndex((z) => z.id === expandedZone)
    : -1;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            data-testid="costa-back-btn"
          >
            <MaterialIcons name="arrow-back" size={22} color={C.ocean} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Linha de Costa</Text>
            <Text style={styles.headerSubtitle}>Minho → Algarve</Text>
          </View>
          <View style={styles.waveIcon}>
            <MaterialIcons name="waves" size={20} color={C.ocean} />
          </View>
        </View>

        {/* Progress Bar — north to south scroll indicator */}
        <View style={styles.progressSection}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>Norte</Text>
            <Text style={styles.progressLabel}>Sul</Text>
          </View>
          <View style={styles.progressTrack}>
            {COASTAL_ZONES.map((zone, idx) => {
              const isActive = zone.id === expandedZone;
              const isPast =
                activeZoneIndex >= 0 && idx < activeZoneIndex;
              return (
                <TouchableOpacity
                  key={zone.id}
                  style={[
                    styles.progressDot,
                    isPast && styles.progressDotPast,
                    isActive && styles.progressDotActive,
                  ]}
                  onPress={() => handleZonePress(zone.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  {isActive && <View style={styles.progressDotInner} />}
                </TouchableOpacity>
              );
            })}
            <View style={styles.progressLine} />
          </View>
          <Text style={styles.progressHint}>
            {filteredZones.length} zona{filteredZones.length !== 1 ? 's' : ''} a explorar
          </Text>
        </View>

        {/* Profile Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersContent}
        >
          {PROFILES.map((profile) => {
            const isActive = activeProfile === profile.key;
            return (
              <TouchableOpacity
                key={profile.key}
                style={[styles.profileChip, isActive && styles.profileChipActive]}
                onPress={() =>
                  setActiveProfile(isActive ? null : profile.key)
                }
                data-testid={`costa-filter-${profile.key}`}
              >
                <Text style={styles.profileChipEmoji}>{profile.emoji}</Text>
                <Text
                  style={[
                    styles.profileChipLabel,
                    isActive && styles.profileChipLabelActive,
                  ]}
                >
                  {profile.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {activeProfile && filteredZones.length === 0 && (
          <View style={styles.emptyFilter}>
            <MaterialIcons name="search-off" size={32} color={C.textLight} />
            <Text style={styles.emptyFilterText}>
              Nenhuma zona com pontuação ≥ 4 para este perfil.
            </Text>
          </View>
        )}

        {/* Zone Cards */}
        <View style={styles.zoneList}>
          {filteredZones.map((zone) => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              activeProfile={activeProfile}
              isExpanded={expandedZone === zone.id}
              onPress={() => handleZonePress(zone.id)}
            />
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ─── Card Styles ──────────────────────────────────────────────────────────────

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    shadowColor: '#0E7490',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTouchable: {
    padding: 16,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  orderBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.foam,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.ocean + '30',
  },
  orderText: {
    fontSize: 13,
    fontWeight: '800',
    color: C.ocean,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  zoneName: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textDark,
  },
  regiaoChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  regiaoText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  descricao: {
    fontSize: 13,
    color: C.textMed,
    lineHeight: 19,
  },
  profileScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.foam,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  profileScoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textMed,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotFilled: {
    backgroundColor: C.ocean,
  },
  dotEmpty: {
    backgroundColor: C.border,
  },
  beachesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  beachChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.foam,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.ocean + '25',
  },
  beachChipText: {
    fontSize: 11,
    color: C.ocean,
    fontWeight: '600',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  detailsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.ocean,
  },
  expandedSection: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    padding: 16,
    gap: 14,
    backgroundColor: '#FAFCFE',
  },
  lendaBlock: {
    gap: 8,
  },
  lendaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lendaTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.sand,
  },
  lendaText: {
    fontSize: 13,
    color: C.textMed,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  bioBlock: {
    gap: 6,
  },
  bioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bioTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.safe,
  },
  bioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bioDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.safe,
  },
  bioText: {
    fontSize: 12,
    color: C.textMed,
    fontStyle: 'italic',
  },
});

// ─── Screen Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.foam,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.ocean + '30',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: C.textDark,
  },
  headerSubtitle: {
    fontSize: 13,
    color: C.textLight,
    marginTop: 2,
  },
  waveIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.foam,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Progress Bar
  progressSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 6,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 10,
    color: C.textLight,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  progressTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    height: 24,
  },
  progressLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 11,
    height: 2,
    backgroundColor: C.border,
    zIndex: 0,
  },
  progressDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.border,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotPast: {
    backgroundColor: C.oceanLight,
  },
  progressDotActive: {
    backgroundColor: C.ocean,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: C.foam,
    shadowColor: C.ocean,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  progressDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
  },
  progressHint: {
    fontSize: 11,
    color: C.textLight,
    textAlign: 'center',
  },

  // Profile Filters
  filtersScroll: {
    marginBottom: 16,
  },
  filtersContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  profileChipActive: {
    backgroundColor: C.ocean,
    borderColor: C.ocean,
  },
  profileChipEmoji: {
    fontSize: 15,
  },
  profileChipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textMed,
  },
  profileChipLabelActive: {
    color: '#FFF',
  },

  // Empty state
  emptyFilter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
    marginHorizontal: 20,
  },
  emptyFilterText: {
    fontSize: 14,
    color: C.textLight,
    textAlign: 'center',
  },

  // Zone List
  zoneList: {
    paddingHorizontal: 16,
    gap: 14,
  },
});
