/**
 * Thematic module registry — single source of truth for the slugs the backend
 * tags on heritage_items (`module` field, set by ingest_thematic_pois.py) and
 * the proximity API filters on (`?module=`).
 *
 * Used by the geofencing service (interest segmentation) and the notification
 * settings UI (module chips). Labels are pt-PT; icons are MaterialIcons names;
 * colours reuse the central category palette where possible.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { categoryColors } from '../theme/colors';

export interface ModuleConfig {
  slug: string;
  label: string;
  icon: string; // MaterialIcons name
  color: string;
}

// Shared with NotificationSettings — interest modules live inside the existing
// notification prefs blob so there is a single persisted source.
export const NOTIFICATION_PREFS_KEY = '@portugal_vivo_notification_prefs';

const c = (slug: string, fallback: string) => categoryColors[slug] || fallback;

export const MODULES: ModuleConfig[] = [
  { slug: 'gastronomia', label: 'Gastronomia', icon: 'restaurant', color: c('gastronomia', '#E8B649') },
  { slug: 'miradouros', label: 'Miradouros', icon: 'landscape', color: c('miradouros', '#2A6F97') },
  { slug: 'patrimonio', label: 'Património', icon: 'account-balance', color: c('patrimonio', '#8C7A6B') },
  { slug: 'cultura', label: 'Cultura & Museus', icon: 'museum', color: c('cultura', '#6A4C93') },
  { slug: 'trilhos', label: 'Trilhos', icon: 'hiking', color: c('trilhos', '#6BBF9A') },
  { slug: 'natureza', label: 'Natureza', icon: 'forest', color: c('natureza', '#3F6F4A') },
  { slug: 'costa', label: 'Costa & Praias', icon: 'beach-access', color: c('praias', '#7EC8E3') },
  { slug: 'fauna', label: 'Fauna', icon: 'pets', color: '#D97706' },
  { slug: 'flora', label: 'Flora', icon: 'local-florist', color: '#22C55E' },
  { slug: 'biodiversidade', label: 'Biodiversidade', icon: 'visibility', color: '#06B6D4' },
  { slug: 'infraestrutura', label: 'Passadiços & Ecovias', icon: 'directions-walk', color: c('ecovias', '#6BBF9A') },
  { slug: 'economia', label: 'Mercados & Produtos', icon: 'storefront', color: '#F97316' },
  { slug: 'saberes', label: 'Saberes & Ofícios', icon: 'handyman', color: '#10B981' },
  { slug: 'termas', label: 'Termas', icon: 'hot-tub', color: '#06B6D4' },
  { slug: 'aldeias', label: 'Aldeias', icon: 'cottage', color: c('aldeias', '#C49A6C') },
  { slug: 'aventura', label: 'Aventura', icon: 'terrain', color: '#DC2626' },
  { slug: 'festas', label: 'Festas & Romarias', icon: 'celebration', color: c('festas', '#E8B649') },
  { slug: 'rotas', label: 'Rotas', icon: 'route', color: c('rotas', '#6BBF9A') },
];

const MODULE_BY_SLUG: Record<string, ModuleConfig> = MODULES.reduce(
  (acc, m) => {
    acc[m.slug] = m;
    return acc;
  },
  {} as Record<string, ModuleConfig>,
);

const FALLBACK_COLOR = '#64748B';

/** Resolve a module slug to its config, with a graceful fallback for unknown slugs. */
export function getModuleConfig(slug: string | null | undefined): ModuleConfig {
  if (slug && MODULE_BY_SLUG[slug]) return MODULE_BY_SLUG[slug];
  return { slug: slug || 'outros', label: slug || 'Outros', icon: 'place', color: FALLBACK_COLOR };
}

/**
 * Read the user's interest modules from the notification prefs blob.
 * Empty array = no segmentation (all modules of interest).
 */
export async function loadInterestModules(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { interestModules?: unknown };
    if (Array.isArray(parsed.interestModules)) {
      return parsed.interestModules.filter((s): s is string => typeof s === 'string');
    }
  } catch {
    // fall through to default
  }
  return [];
}
