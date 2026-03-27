import React from 'react';
import { View, Text, StyleSheet, Dimensions, Image, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { HeritageItem, Category } from '../types';
import PressableScale from './PressableScale';
import { useTheme, typography, spacing, borders, getCategoryColor, getCategoryBg } from '../theme';
import { useFavorites } from '../context/FavoritesContext';

const { width: _width } = Dimensions.get('window');

interface HeritageCardProps {
  item: HeritageItem;
  categories: Category[];
  onPress: () => void;
  variant?: 'default' | 'compact' | 'featured';
}

const REGION_NAMES: Record<string, string> = {
  norte: 'Norte',
  centro: 'Centro',
  lisboa: 'Lisboa',
  alentejo: 'Alentejo',
  algarve: 'Algarve',
  acores: 'Açores',
  madeira: 'Madeira',
};

// Default category images from Unsplash — all 39+ new subcategories + legacy
const CATEGORY_IMAGES: Record<string, string> = {
  // ── Natureza ──────────────────────────────────────────────
  percursos_pedestres: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80',
  aventura_natureza: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&q=80',
  natureza_especializada: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&q=80',
  fauna_autoctone: 'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=400&q=80',
  flora_autoctone: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&q=80',
  flora_botanica: 'https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=400&q=80',
  biodiversidade_avistamentos: 'https://images.unsplash.com/photo-1504545102780-26774c1bb073?w=400&q=80',
  miradouros: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80',
  barragens_albufeiras: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=400&q=80',
  cascatas_pocos: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=400&q=80',
  praias_fluviais: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80',
  arqueologia_geologia: 'https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=400&q=80',
  moinhos_azenhas: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=400&q=80',
  ecovias_passadicos: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80',
  // ── História & Património ─────────────────────────────────
  castelos: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
  palacios_solares: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&q=80',
  museus: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&q=80',
  oficios_artesanato: 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=400&q=80',
  termas_banhos: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&q=80',
  patrimonio_ferroviario: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=400&q=80',
  arte_urbana: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&q=80',
  // ── Gastronomia ───────────────────────────────────────────
  restaurantes_gastronomia: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80',
  tabernas_historicas: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&q=80',
  mercados_feiras: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=400&q=80',
  produtores_dop: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80',
  agroturismo_enoturismo: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=400&q=80',
  pratos_tipicos: 'https://images.unsplash.com/photo-1591107576521-87091dc07797?w=400&q=80',
  docaria_regional: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80',
  sopas_tipicas: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80',
  // ── Cultura ───────────────────────────────────────────────
  musica_tradicional: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&q=80',
  festivais_musica: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&q=80',
  festas_romarias: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&q=80',
  // ── Mar & Praias ──────────────────────────────────────────
  surf: 'https://images.unsplash.com/photo-1502680390548-bdbac40b3e1a?w=400&q=80',
  praias_bandeira_azul: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80',
  // ── Experiências ──────────────────────────────────────────
  rotas_tematicas: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80',
  grande_expedicao: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80',
  perolas_portugal: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&q=80',
  alojamentos_rurais: 'https://images.unsplash.com/photo-1600786705579-08b369d25d7d?w=400&q=80',
  parques_campismo: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&q=80',
  pousadas_juventude: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400&q=80',
  farois: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
  entidades_operadores: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80',
  agentes_turisticos: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80',
  // ── Legacy ────────────────────────────────────────────────
  lendas: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80',
  festas: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&q=80',
  saberes: 'https://images.unsplash.com/photo-1568288796888-a0fa7b6ebd17?w=400&q=80',
  gastronomia: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80',
  termas: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&q=80',
  aldeias: 'https://images.unsplash.com/photo-1600786705579-08b369d25d7d?w=400&q=80',
};

export default function HeritageCard({ item, categories, onPress, variant = 'default' }: HeritageCardProps) {
  const { colors } = useTheme();
  const { isFavorite, toggleFavorite } = useFavorites();
  const category = categories.find(c => c.id === item.category);
  const imageUrl = item.image_url || CATEGORY_IMAGES[item.category] || CATEGORY_IMAGES.lendas;
  const catColor = getCategoryColor(category?.color ? item.category : item.category);
  const actualColor = category?.color || catColor;
  const faved = isFavorite(item.id);

  // Compact variant
  if (variant === 'compact') {
    return (
      <PressableScale
        onPress={onPress}
        style={[styles.compactCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
        accessibilityLabel={`${item.name}, ${REGION_NAMES[item.region] || item.region}`}
        accessibilityRole="button"
        accessibilityHint="Toque para ver detalhes"
      >
        <Image source={{ uri: imageUrl }} style={[styles.compactImage, { backgroundColor: colors.border }]} />
        <View style={styles.compactContent}>
          <View style={[styles.smallBadge, { backgroundColor: getCategoryBg(item.category) }]}>
            <MaterialIcons
              name={(category?.icon || 'place') as any}
              size={12}
              color={actualColor}
            />
          </View>
          <Text style={[styles.compactName, { color: colors.textOnPrimary }]} numberOfLines={2}>{item.name}</Text>
          <Text style={[styles.compactRegion, { color: colors.textMuted }]}>{REGION_NAMES[item.region] || item.region}</Text>
        </View>
      </PressableScale>
    );
  }

  // Default variant with small image thumbnail
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
      accessibilityLabel={`${item.name}. ${category?.name || item.category}. ${REGION_NAMES[item.region] || item.region}`}
      accessibilityRole="button"
      accessibilityHint="Toque para ver detalhes"
    >
      <View style={styles.cardContent}>
        <Image source={{ uri: imageUrl }} style={[styles.thumbnail, { backgroundColor: colors.border }]} />
        <View style={styles.cardText}>
          <View style={styles.header}>
            <View style={[styles.categoryBadge, { backgroundColor: getCategoryBg(item.category) }]}>
              <MaterialIcons
                name={(category?.icon || 'place') as any}
                size={14}
                color={actualColor}
              />
              <Text style={[styles.categoryText, { color: actualColor }]}>
                {category?.name || item.category}
              </Text>
            </View>
            {item.location && (
              <MaterialIcons name="location-on" size={14} color={colors.success} />
            )}
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
              style={{ padding: 4, marginLeft: 4 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons
                name={faved ? 'favorite' : 'favorite-border'}
                size={18}
                color={faved ? '#EF4444' : colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          <Text style={[styles.name, { color: colors.textOnPrimary }]} numberOfLines={2}>{item.name}</Text>
          <Text style={[styles.description, { color: colors.textMuted }]} numberOfLines={2}>{item.description}</Text>

          <View style={styles.footer}>
            <View style={[styles.regionBadge, { backgroundColor: colors.border }]}>
              <Text style={[styles.regionText, { color: colors.textSecondary }]}>{REGION_NAMES[item.region] || item.region}</Text>
            </View>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // Default card styles
  card: {
    borderRadius: borders.radius.xl,
    marginBottom: spacing[3],
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
  },
  thumbnail: {
    width: 100,
    height: 120,
  },
  cardText: {
    flex: 1,
    padding: spacing[3],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: borders.radius.md,
    gap: 4,
  },
  categoryText: {
    fontSize: typography.fontSize.xs + 1,
    fontWeight: typography.fontWeight.semibold,
  },
  name: {
    fontSize: typography.fontSize.base + 1,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 4,
    lineHeight: 20,
  },
  description: {
    fontSize: typography.fontSize.sm,
    lineHeight: 16,
    marginBottom: spacing[2],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: borders.radius.md,
    gap: 4,
  },
  regionText: {
    fontSize: typography.fontSize.xs + 1,
    fontWeight: typography.fontWeight.medium,
  },

  // Compact card styles
  compactCard: {
    width: 140,
    borderRadius: borders.radius.lg,
    marginRight: spacing[3],
    overflow: 'hidden',
    borderWidth: 1,
  },
  compactImage: {
    width: '100%',
    height: 90,
  },
  compactContent: {
    padding: spacing[3] - 2,
  },
  smallBadge: {
    width: 24,
    height: 24,
    borderRadius: borders.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  compactName: {
    fontSize: typography.fontSize.sm + 1,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 4,
    lineHeight: 16,
  },
  compactRegion: {
    fontSize: typography.fontSize.xs + 1,
  },
});
