/**
 * SmartImage v2 — Reliable image rendering for POIs and events.
 *
 * Strategy (3 stages):
 *  1) Try provided `uri` (POI image_url, populated by backend enrich_images_batch.py)
 *  2) On error → curated Wikimedia Commons URL (stable CDN, no API key, no rate limit)
 *     Selected deterministically by hash(name) → same POI always shows same image
 *  3) On final error → branded gradient + MaterialIcons icon (offline-safe)
 *
 * Wikimedia Commons URLs are direct CDN thumbnails — they do not depend on any
 * deprecated service (unlike source.unsplash.com/featured) and are extremely stable.
 *
 * Built on expo-image with disk caching, blurhash placeholder, and 200ms transition.
 */
import React, { useState, useMemo } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Image, ImageContentFit } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

const DEFAULT_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

/**
 * Category → curated Wikimedia Commons CDN URLs (stable thumbnails, 800px wide).
 * URLs follow `https://upload.wikimedia.org/wikipedia/commons/thumb/...` pattern
 * which is the official CDN — they do not require auth, key, or referer.
 */
const WIKIMEDIA_BANK: Record<string, string[]> = {
  castelos: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Castelo_de_Guimar%C3%A3es_-_Portugal_%2848828800351%29.jpg/800px-Castelo_de_Guimar%C3%A3es_-_Portugal_%2848828800351%29.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Castle_of_the_Moors_in_Sintra_-_Aug_2014.jpg/800px-Castle_of_the_Moors_in_Sintra_-_Aug_2014.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Marvao_castle.jpg/800px-Marvao_castle.jpg',
  ],
  museus: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Museu_Nacional_do_Azulejo.jpg/800px-Museu_Nacional_do_Azulejo.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Museu_Calouste_Gulbenkian_2014.JPG/800px-Museu_Calouste_Gulbenkian_2014.JPG',
  ],
  palacios_solares: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Palacio_da_Pena_-_Sintra.jpg/800px-Palacio_da_Pena_-_Sintra.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Palacio_Nacional_da_Ajuda%2C_Lisboa.jpg/800px-Palacio_Nacional_da_Ajuda%2C_Lisboa.jpg',
  ],
  igrejas: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Mosteiro_dos_Jer%C3%B3nimos_April_2009-1a.jpg/800px-Mosteiro_dos_Jer%C3%B3nimos_April_2009-1a.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/S%C3%A9_de_Braga.JPG/800px-S%C3%A9_de_Braga.JPG',
  ],
  religioso: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Mosteiro_dos_Jer%C3%B3nimos_April_2009-1a.jpg/800px-Mosteiro_dos_Jer%C3%B3nimos_April_2009-1a.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Santu%C3%A1rio_de_F%C3%A1tima_at_night.jpg/800px-Santu%C3%A1rio_de_F%C3%A1tima_at_night.jpg',
  ],
  arte_urbana: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Azulejos_lisboa.jpg/800px-Azulejos_lisboa.jpg',
  ],
  oficios_artesanato: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Azulejos_lisboa.jpg/800px-Azulejos_lisboa.jpg',
  ],
  patrimonio_ferroviario: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Esta%C3%A7%C3%A3o_de_S%C3%A3o_Bento_2.jpg/800px-Esta%C3%A7%C3%A3o_de_S%C3%A3o_Bento_2.jpg',
  ],

  // Nature / landscape
  miradouros: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Madeira_-_2013-04-19_-_Miradouro_da_Portela_panorama.jpg/800px-Madeira_-_2013-04-19_-_Miradouro_da_Portela_panorama.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Sintra_panorama.jpg/800px-Sintra_panorama.jpg',
  ],
  cascatas_pocos: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Cascata_do_Arado_-_Geres.jpg/800px-Cascata_do_Arado_-_Geres.jpg',
  ],
  praias_fluviais: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Praia_fluvial_de_Loriga.jpg/800px-Praia_fluvial_de_Loriga.jpg',
  ],
  praias_bandeira_azul: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Praia_da_Marinha_aerial.jpg/800px-Praia_da_Marinha_aerial.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Praia_de_S%C3%A3o_Jacinto.jpg/800px-Praia_de_S%C3%A3o_Jacinto.jpg',
  ],
  surf: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Nazar%C3%A9_-_Big_Wave_Surfing.jpg/800px-Nazar%C3%A9_-_Big_Wave_Surfing.jpg',
  ],
  termas_banhos: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Termas_de_S%C3%A3o_Pedro_do_Sul_-_panoramio.jpg/800px-Termas_de_S%C3%A3o_Pedro_do_Sul_-_panoramio.jpg',
  ],
  ecovias_passadicos: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Passadi%C3%A7os_do_Paiva_-_Arouca.jpg/800px-Passadi%C3%A7os_do_Paiva_-_Arouca.jpg',
  ],
  percursos_pedestres: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Passadi%C3%A7os_do_Paiva_-_Arouca.jpg/800px-Passadi%C3%A7os_do_Paiva_-_Arouca.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Madeira_-_2013-04-19_-_Miradouro_da_Portela_panorama.jpg/800px-Madeira_-_2013-04-19_-_Miradouro_da_Portela_panorama.jpg',
  ],
  natureza_especializada: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Cascata_do_Arado_-_Geres.jpg/800px-Cascata_do_Arado_-_Geres.jpg',
  ],
  natureza: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Cascata_do_Arado_-_Geres.jpg/800px-Cascata_do_Arado_-_Geres.jpg',
  ],
  fauna_autoctone: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Iberian_lynx_%28Lynx_pardinus%29.jpg/800px-Iberian_lynx_%28Lynx_pardinus%29.jpg',
  ],
  flora_autoctone: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Quercus_suber_-_Cork_Oak_-_Sobreiro.jpg/800px-Quercus_suber_-_Cork_Oak_-_Sobreiro.jpg',
  ],
  flora_botanica: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Jardim_Bot%C3%A2nico_de_Lisboa.jpg/800px-Jardim_Bot%C3%A2nico_de_Lisboa.jpg',
  ],
  barragens_albufeiras: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Barragem_do_Alqueva.jpg/800px-Barragem_do_Alqueva.jpg',
  ],
  arqueologia_geologia: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Citania_de_Briteiros.JPG/800px-Citania_de_Briteiros.JPG',
  ],
  rotas_tematicas: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Monsanto_Portugal.jpg/800px-Monsanto_Portugal.jpg',
  ],
  moinhos_azenhas: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Moinhos_de_vento_-_Pico_-_A%C3%A7ores.jpg/800px-Moinhos_de_vento_-_Pico_-_A%C3%A7ores.jpg',
  ],
  aventura_natureza: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Passadi%C3%A7os_do_Paiva_-_Arouca.jpg/800px-Passadi%C3%A7os_do_Paiva_-_Arouca.jpg',
  ],

  // Gastronomy
  gastronomia: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Pastel_de_nata_-_Confeitaria_Nacional.jpg/800px-Pastel_de_nata_-_Confeitaria_Nacional.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Bacalhau_%C3%A0_Br%C3%A1s.jpg/800px-Bacalhau_%C3%A0_Br%C3%A1s.jpg',
  ],
  restaurantes_gastronomia: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Bacalhau_%C3%A0_Br%C3%A1s.jpg/800px-Bacalhau_%C3%A0_Br%C3%A1s.jpg',
  ],
  tabernas_historicas: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Bacalhau_%C3%A0_Br%C3%A1s.jpg/800px-Bacalhau_%C3%A0_Br%C3%A1s.jpg',
  ],
  produtores_dop: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Vinhos_do_Porto.jpg/800px-Vinhos_do_Porto.jpg',
  ],
  agroturismo_enoturismo: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Vinhos_do_Porto.jpg/800px-Vinhos_do_Porto.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Douro_Valley_terraced_vineyards.jpg/800px-Douro_Valley_terraced_vineyards.jpg',
  ],
  mercados_feiras: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Mercado_do_Bolh%C3%A3o_-_Porto.jpg/800px-Mercado_do_Bolh%C3%A3o_-_Porto.jpg',
  ],

  // Events / culture
  festas: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Marchas_populares_de_Lisboa.jpg/800px-Marchas_populares_de_Lisboa.jpg',
  ],
  festas_romarias: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Marchas_populares_de_Lisboa.jpg/800px-Marchas_populares_de_Lisboa.jpg',
  ],
  cultural: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Museu_Nacional_do_Azulejo.jpg/800px-Museu_Nacional_do_Azulejo.jpg',
  ],
  tradicional: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Marchas_populares_de_Lisboa.jpg/800px-Marchas_populares_de_Lisboa.jpg',
  ],
  musica_tradicional: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Fado_no_Clube_de_Fado.jpg/800px-Fado_no_Clube_de_Fado.jpg',
  ],
  festivais_musica: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Fado_no_Clube_de_Fado.jpg/800px-Fado_no_Clube_de_Fado.jpg',
  ],

  // Lodging
  alojamentos_rurais: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Monsanto_Portugal.jpg/800px-Monsanto_Portugal.jpg',
  ],
  parques_campismo: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Passadi%C3%A7os_do_Paiva_-_Arouca.jpg/800px-Passadi%C3%A7os_do_Paiva_-_Arouca.jpg',
  ],
};

const DEFAULT_WIKIMEDIA = [
  'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Sintra_panorama.jpg/800px-Sintra_panorama.jpg',
];

/** Category → branded gradient + icon for final fallback. */
type CategoryFallback = {
  icon: string;
  gradient: [string, string];
};

const CATEGORY_FALLBACKS: Record<string, CategoryFallback> = {
  castelos: { icon: 'castle', gradient: ['#7C5832', '#3E2818'] },
  museus: { icon: 'museum', gradient: ['#5B7BA8', '#2A3E5C'] },
  palacios_solares: { icon: 'account-balance', gradient: ['#B08556', '#6E4F2A'] },
  igrejas: { icon: 'church', gradient: ['#8B6F4D', '#4E3E2A'] },
  religioso: { icon: 'church', gradient: ['#8B6F4D', '#4E3E2A'] },
  arte_urbana: { icon: 'palette', gradient: ['#C44536', '#7A2A1F'] },
  oficios_artesanato: { icon: 'handyman', gradient: ['#A26830', '#5C3A18'] },
  patrimonio_ferroviario: { icon: 'train', gradient: ['#4A6E5C', '#23362C'] },
  miradouros: { icon: 'landscape', gradient: ['#3FA66B', '#1F5236'] },
  cascatas_pocos: { icon: 'water', gradient: ['#3D8FB8', '#1B4459'] },
  praias_fluviais: { icon: 'pool', gradient: ['#5BA8C4', '#2A5468'] },
  praias_bandeira_azul: { icon: 'beach-access', gradient: ['#2A6F97', '#143A50'] },
  surf: { icon: 'surfing', gradient: ['#1B6FA8', '#0C3656'] },
  termas_banhos: { icon: 'spa', gradient: ['#5B9C8E', '#2C4D45'] },
  ecovias_passadicos: { icon: 'directions-walk', gradient: ['#4F8C5C', '#23402B'] },
  percursos_pedestres: { icon: 'hiking', gradient: ['#6B8E5A', '#33472B'] },
  natureza_especializada: { icon: 'park', gradient: ['#3FA66B', '#1F5236'] },
  natureza: { icon: 'park', gradient: ['#3FA66B', '#1F5236'] },
  fauna_autoctone: { icon: 'pets', gradient: ['#8C6E3F', '#4A3818'] },
  flora_autoctone: { icon: 'forest', gradient: ['#3FA66B', '#1F5236'] },
  flora_botanica: { icon: 'local-florist', gradient: ['#7AB85A', '#3A5A2C'] },
  barragens_albufeiras: { icon: 'water', gradient: ['#3D8FB8', '#1B4459'] },
  arqueologia_geologia: { icon: 'terrain', gradient: ['#8C6E3F', '#4A3818'] },
  rotas_tematicas: { icon: 'route', gradient: ['#A26830', '#5C3A18'] },
  moinhos_azenhas: { icon: 'air', gradient: ['#8B7E5A', '#4A4230'] },
  aventura_natureza: { icon: 'terrain', gradient: ['#3FA66B', '#1F5236'] },
  gastronomia: { icon: 'restaurant', gradient: ['#C44536', '#7A2A1F'] },
  restaurantes_gastronomia: { icon: 'restaurant', gradient: ['#C44536', '#7A2A1F'] },
  tabernas_historicas: { icon: 'local-bar', gradient: ['#8B3F2C', '#4A2218'] },
  produtores_dop: { icon: 'agriculture', gradient: ['#A26830', '#5C3A18'] },
  agroturismo_enoturismo: { icon: 'wine-bar', gradient: ['#7C2A2A', '#3F1414'] },
  mercados_feiras: { icon: 'storefront', gradient: ['#A26830', '#5C3A18'] },
  festas: { icon: 'celebration', gradient: ['#C44536', '#7A2A1F'] },
  festas_romarias: { icon: 'celebration', gradient: ['#C44536', '#7A2A1F'] },
  cultural: { icon: 'theater-comedy', gradient: ['#5B7BA8', '#2A3E5C'] },
  tradicional: { icon: 'groups', gradient: ['#A26830', '#5C3A18'] },
  musica_tradicional: { icon: 'music-note', gradient: ['#7C2A4A', '#3F1424'] },
  festivais_musica: { icon: 'music-note', gradient: ['#7C2A4A', '#3F1424'] },
  alojamentos_rurais: { icon: 'cottage', gradient: ['#8B6F4D', '#4E3E2A'] },
  parques_campismo: { icon: 'forest', gradient: ['#4F8C5C', '#23402B'] },
};

const DEFAULT_FALLBACK: CategoryFallback = {
  icon: 'image',
  gradient: ['#C49A6C', '#7A5E3F'],
};

/** Deterministic string hash → number. Same input always returns same output. */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface SmartImageProps {
  /** Primary image URL (POI image_url from backend). May be null/undefined. */
  uri?: string | null;
  /** Category or subcategory ID (e.g., 'castelos') used to pick fallback. */
  category?: string;
  /** POI / event name — used for accessibility label and deterministic image pick. */
  name?: string;
  style?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  blurhash?: string;
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
  // Stage: 0 = primary uri, 1 = wikimedia bank, 2 = gradient fallback
  const [stage, setStage] = useState<0 | 1 | 2>(uri ? 0 : 1);

  const wikimediaUrl = useMemo(() => {
    const bank = (category && WIKIMEDIA_BANK[category]) || DEFAULT_WIKIMEDIA;
    const idx = name ? hashString(name) % bank.length : 0;
    return bank[idx];
  }, [category, name]);

  const fallback = useMemo(
    () => (category && CATEGORY_FALLBACKS[category]) || DEFAULT_FALLBACK,
    [category]
  );

  const currentUri = stage === 0 ? uri : stage === 1 ? wikimediaUrl : null;

  if (stage === 2 || !currentUri) {
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
