/**
 * SmartImage — Reliable image rendering for POIs and events.
 *
 * Strategy:
 *  1) Try provided `uri` (POI image_url)
 *  2) On error, try category-based curated fallback (Unsplash featured image)
 *  3) On final failure, render gradient + MaterialIcons icon (always shows something)
 *
 * Built on expo-image for caching, blurhash placeholder, and smooth transitions.
 */
import React, { useState, useMemo } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Image, ImageContentFit } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

const DEFAULT_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

/**
 * Category → curated Unsplash featured fallback URL + icon + gradient.
 * The Unsplash `source.unsplash.com/featured` endpoint is free, requires no key,
 * and returns a relevant image for the keyword. Cached by URL on disk.
 */
type CategoryFallback = {
  url: string;
  icon: string;
  gradient: [string, string];
};

const CATEGORY_FALLBACKS: Record<string, CategoryFallback> = {
  // Heritage / culture
  castelos: { url: 'https://source.unsplash.com/featured/800x600?castle,portugal,medieval', icon: 'castle', gradient: ['#7C5832', '#3E2818'] },
  museus: { url: 'https://source.unsplash.com/featured/800x600?museum,portugal,art', icon: 'museum', gradient: ['#5B7BA8', '#2A3E5C'] },
  palacios_solares: { url: 'https://source.unsplash.com/featured/800x600?palace,portugal,baroque', icon: 'account-balance', gradient: ['#B08556', '#6E4F2A'] },
  igrejas: { url: 'https://source.unsplash.com/featured/800x600?church,portugal,baroque', icon: 'church', gradient: ['#8B6F4D', '#4E3E2A'] },
  religioso: { url: 'https://source.unsplash.com/featured/800x600?church,portugal', icon: 'church', gradient: ['#8B6F4D', '#4E3E2A'] },
  arte_urbana: { url: 'https://source.unsplash.com/featured/800x600?street-art,portugal,mural', icon: 'palette', gradient: ['#C44536', '#7A2A1F'] },
  oficios_artesanato: { url: 'https://source.unsplash.com/featured/800x600?craft,pottery,portugal', icon: 'handyman', gradient: ['#A26830', '#5C3A18'] },
  patrimonio_ferroviario: { url: 'https://source.unsplash.com/featured/800x600?train-station,portugal,railway', icon: 'train', gradient: ['#4A6E5C', '#23362C'] },

  // Nature / landscape
  miradouros: { url: 'https://source.unsplash.com/featured/800x600?viewpoint,portugal,landscape', icon: 'landscape', gradient: ['#3FA66B', '#1F5236'] },
  cascatas_pocos: { url: 'https://source.unsplash.com/featured/800x600?waterfall,portugal,nature', icon: 'water', gradient: ['#3D8FB8', '#1B4459'] },
  praias_fluviais: { url: 'https://source.unsplash.com/featured/800x600?river-beach,portugal', icon: 'pool', gradient: ['#5BA8C4', '#2A5468'] },
  praias_bandeira_azul: { url: 'https://source.unsplash.com/featured/800x600?beach,portugal,atlantic', icon: 'beach-access', gradient: ['#2A6F97', '#143A50'] },
  surf: { url: 'https://source.unsplash.com/featured/800x600?surfing,portugal,waves', icon: 'surfing', gradient: ['#1B6FA8', '#0C3656'] },
  termas_banhos: { url: 'https://source.unsplash.com/featured/800x600?thermal-spa,portugal', icon: 'spa', gradient: ['#5B9C8E', '#2C4D45'] },
  ecovias_passadicos: { url: 'https://source.unsplash.com/featured/800x600?boardwalk,portugal,trail', icon: 'directions-walk', gradient: ['#4F8C5C', '#23402B'] },
  percursos_pedestres: { url: 'https://source.unsplash.com/featured/800x600?hiking-trail,portugal,mountain', icon: 'hiking', gradient: ['#6B8E5A', '#33472B'] },
  natureza_especializada: { url: 'https://source.unsplash.com/featured/800x600?nature-park,portugal', icon: 'park', gradient: ['#3FA66B', '#1F5236'] },
  natureza: { url: 'https://source.unsplash.com/featured/800x600?nature,portugal,forest', icon: 'park', gradient: ['#3FA66B', '#1F5236'] },
  fauna_autoctone: { url: 'https://source.unsplash.com/featured/800x600?wildlife,iberian,bird', icon: 'pets', gradient: ['#8C6E3F', '#4A3818'] },
  flora_autoctone: { url: 'https://source.unsplash.com/featured/800x600?forest,portugal,trees', icon: 'forest', gradient: ['#3FA66B', '#1F5236'] },
  flora_botanica: { url: 'https://source.unsplash.com/featured/800x600?botanical-garden,portugal', icon: 'local-florist', gradient: ['#7AB85A', '#3A5A2C'] },
  barragens_albufeiras: { url: 'https://source.unsplash.com/featured/800x600?lake,portugal,reservoir', icon: 'water', gradient: ['#3D8FB8', '#1B4459'] },
  arqueologia_geologia: { url: 'https://source.unsplash.com/featured/800x600?archaeology,portugal,ruins', icon: 'terrain', gradient: ['#8C6E3F', '#4A3818'] },
  rotas_tematicas: { url: 'https://source.unsplash.com/featured/800x600?historic-village,portugal', icon: 'route', gradient: ['#A26830', '#5C3A18'] },
  moinhos_azenhas: { url: 'https://source.unsplash.com/featured/800x600?windmill,portugal', icon: 'air', gradient: ['#8B7E5A', '#4A4230'] },
  aventura_natureza: { url: 'https://source.unsplash.com/featured/800x600?adventure,portugal,outdoor', icon: 'terrain', gradient: ['#3FA66B', '#1F5236'] },

  // Gastronomy
  gastronomia: { url: 'https://source.unsplash.com/featured/800x600?portuguese-food,cuisine', icon: 'restaurant', gradient: ['#C44536', '#7A2A1F'] },
  restaurantes_gastronomia: { url: 'https://source.unsplash.com/featured/800x600?portuguese-food,bacalhau', icon: 'restaurant', gradient: ['#C44536', '#7A2A1F'] },
  tabernas_historicas: { url: 'https://source.unsplash.com/featured/800x600?tavern,portugal,wine', icon: 'local-bar', gradient: ['#8B3F2C', '#4A2218'] },
  produtores_dop: { url: 'https://source.unsplash.com/featured/800x600?cheese,wine,portugal', icon: 'agriculture', gradient: ['#A26830', '#5C3A18'] },
  agroturismo_enoturismo: { url: 'https://source.unsplash.com/featured/800x600?winery,portugal,vineyard', icon: 'wine-bar', gradient: ['#7C2A2A', '#3F1414'] },
  mercados_feiras: { url: 'https://source.unsplash.com/featured/800x600?market,portugal,farmers', icon: 'storefront', gradient: ['#A26830', '#5C3A18'] },

  // Events / culture
  festas: { url: 'https://source.unsplash.com/featured/800x600?festival,portugal,celebration', icon: 'celebration', gradient: ['#C44536', '#7A2A1F'] },
  festas_romarias: { url: 'https://source.unsplash.com/featured/800x600?procession,portugal,romaria', icon: 'celebration', gradient: ['#C44536', '#7A2A1F'] },
  cultural: { url: 'https://source.unsplash.com/featured/800x600?theatre,culture,portugal', icon: 'theater-comedy', gradient: ['#5B7BA8', '#2A3E5C'] },
  tradicional: { url: 'https://source.unsplash.com/featured/800x600?tradition,portugal,folk', icon: 'groups', gradient: ['#A26830', '#5C3A18'] },
  musica_tradicional: { url: 'https://source.unsplash.com/featured/800x600?fado,portugal,music', icon: 'music-note', gradient: ['#7C2A4A', '#3F1424'] },
  festivais_musica: { url: 'https://source.unsplash.com/featured/800x600?music-festival,portugal', icon: 'music-note', gradient: ['#7C2A4A', '#3F1424'] },

  // Lodging
  alojamentos_rurais: { url: 'https://source.unsplash.com/featured/800x600?countryside-house,portugal', icon: 'cottage', gradient: ['#8B6F4D', '#4E3E2A'] },
  parques_campismo: { url: 'https://source.unsplash.com/featured/800x600?camping,portugal,nature', icon: 'forest', gradient: ['#4F8C5C', '#23402B'] },
};

const DEFAULT_FALLBACK: CategoryFallback = {
  url: 'https://source.unsplash.com/featured/800x600?portugal,landscape',
  icon: 'image',
  gradient: ['#C49A6C', '#7A5E3F'],
};

interface SmartImageProps {
  /** Primary image URL (e.g., POI image_url). May be null/undefined. */
  uri?: string | null;
  /** Category or subcategory ID used to pick fallback (e.g., 'castelos'). */
  category?: string;
  /** POI / event name — used for accessibility label. */
  name?: string;
  style?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  /** Optional blurhash placeholder. */
  blurhash?: string;
  /** Render the icon overlay even when image loads (for branding). */
  alwaysShowIcon?: boolean;
}

export default function SmartImage({
  uri,
  category,
  name,
  style,
  contentFit = 'cover',
  blurhash = DEFAULT_BLURHASH,
  alwaysShowIcon = false,
}: SmartImageProps) {
  // Track which source we're on: 0 = primary uri, 1 = unsplash fallback, 2 = gradient
  const [stage, setStage] = useState<0 | 1 | 2>(uri ? 0 : 1);

  const fallback = useMemo(
    () => (category && CATEGORY_FALLBACKS[category]) || DEFAULT_FALLBACK,
    [category]
  );

  const currentUri = stage === 0 ? uri : stage === 1 ? fallback.url : null;

  if (stage === 2 || !currentUri) {
    // Gradient + icon — always renders something
    return (
      <View style={[styles.fallbackContainer, style]}>
        <LinearGradient
          colors={fallback.gradient}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <MaterialIcons
          name={fallback.icon as any}
          size={48}
          color="rgba(255,255,255,0.75)"
        />
      </View>
    );
  }

  return (
    <View style={[styles.imageContainer, style]}>
      <Image
        source={{ uri: currentUri }}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        placeholder={{ blurhash }}
        transition={200}
        cachePolicy="memory-disk"
        recyclingKey={currentUri}
        accessibilityLabel={name || 'Imagem'}
        onError={() => setStage((s) => (s === 0 ? 1 : 2))}
      />
      {alwaysShowIcon && (
        <View style={styles.iconOverlay}>
          <MaterialIcons
            name={fallback.icon as any}
            size={20}
            color="rgba(255,255,255,0.9)"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    overflow: 'hidden',
    backgroundColor: '#1F2937',
  },
  fallbackContainer: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1F2937',
  },
  iconOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
