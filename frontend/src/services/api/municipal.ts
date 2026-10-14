/**
 * Municipal (B2G) API — plans, subscription, impact dashboard, monthly PDF
 * report, public profile, featured audio guides and the public
 * /municipios pages (backend: municipal_api.py).
 *
 * Tenant endpoints (`/municipal/me/*`) need a logged-in municipal user; the
 * shared axios client attaches the Bearer token automatically.
 */
import { Platform } from 'react-native';
import type { AxiosResponse } from 'axios';
import api from './client';

// ─── Plans ────────────────────────────────────────────────────────────────────

export type MunicipalPlanId = 'essencial' | 'territorio' | 'destino';

export interface MunicipalPlan {
  id: MunicipalPlanId;
  name: string;
  audience: string;
  price_eur_year: number;
  /** null = unlimited */
  max_pois: number | null;
  max_audio_guides: number;
  white_label: boolean;
  setup_fee_eur: number;
}

export interface MunicipalPlansResponse {
  plans: MunicipalPlan[];
  setup_fee_eur: number;
  pilot_months: number;
  currency: string;
  vat_included: boolean;
  notes?: string;
}

// ─── Subscription ─────────────────────────────────────────────────────────────

export type MunicipalSubscriptionStatus = 'pilot' | 'active' | 'suspended' | 'expired';

export interface MunicipalSubscription {
  plan: MunicipalPlanId;
  status: MunicipalSubscriptionStatus;
  starts_at?: string | null;
  ends_at?: string | null;
  concelhos: string[];
  contract_ref?: string | null;
}

export interface MunicipalUsage {
  curated_pois: number;
  max_pois: number | null;
  featured_audio_guides: number;
  max_audio_guides: number | null;
  territory_pois_total: number;
}

export interface MySubscriptionResponse {
  municipality_id: string;
  subscription: MunicipalSubscription | null;
  active: boolean;
  plan: MunicipalPlan | null;
  usage: MunicipalUsage;
}

// ─── Impact ───────────────────────────────────────────────────────────────────

export interface ImpactTotals {
  poi_views: number;
  audio_plays: number;
  audio_completes: number;
  route_views: number;
  route_starts: number;
  directions: number;
  shares: number;
  favorites: number;
  qr_scans: number;
  profile_views: number;
  unique_visitors: number;
}

export interface ImpactOrigin {
  /** ISO 3166-1 alpha-2, or 'ZZ' when unknown */
  country: string;
  sessions: number;
  pct: number;
}

export interface ImpactNationalSplit {
  national_sessions: number;
  international_sessions: number;
  unknown_sessions: number;
  international_pct: number;
}

export interface ImpactTopPoi {
  poi_id: string;
  name: string;
  views: number;
  audio_plays: number;
  interactions: number;
}

export interface ImpactTopRoute {
  route_id: string;
  name: string;
  views: number;
  starts: number;
}

/** One day of events: `date` plus a count per event type (poi_view, audio_play, …). */
export type ImpactDailyPoint = { date: string } & { [eventType: string]: number | string };

export interface ImpactResponse {
  municipality_id: string;
  from: string;
  to: string;
  totals: ImpactTotals;
  origin: ImpactOrigin[];
  national_vs_international: ImpactNationalSplit;
  top_pois: ImpactTopPoi[];
  top_routes: ImpactTopRoute[];
  daily: ImpactDailyPoint[];
  platforms: Partial<Record<'ios' | 'android' | 'web' | 'desconhecida', number>>;
  methodology: string;
}

export interface ImpactParams {
  /** YYYY-MM-DD (inclusive) */
  from?: string;
  /** YYYY-MM-DD (inclusive) */
  to?: string;
}

// ─── Public profile ───────────────────────────────────────────────────────────

export interface MunicipalProfile {
  display_name: string;
  tagline?: string | null;
  description?: string | null;
  hero_image_url?: string | null;
  logo_url?: string | null;
  brand_color?: string | null;
  website?: string | null;
  contact_email?: string | null;
  featured_poi_ids: string[];
  featured_route_ids: string[];
}

export interface MyProfileResponse {
  municipality_id: string;
  profile: MunicipalProfile | null;
}

// ─── Featured audio guides ────────────────────────────────────────────────────

export interface FeaturedAudioGuide {
  id: string;
  name: string;
  category?: string;
  audio_featured_at?: string | null;
}

export interface FeaturedAudioGuidesResponse {
  items: FeaturedAudioGuide[];
  used: number;
  /** null when the municipality has no plan */
  max: number | null;
}

export interface FeatureAudioGuideResponse {
  poi_id: string;
  featured: boolean;
  used?: number;
  max?: number | null;
}

// ─── Partner POIs (territory list used by the municipal panel) ────────────────

export interface PartnerPoi {
  id: string;
  name: string;
  category: string;
  region?: string;
  concelho?: string;
  location?: { lat: number; lng: number } | null;
  content_health_score: number;
  status: 'published' | 'draft';
  tier?: string;
  has_image?: boolean;
  has_narrative?: boolean;
}

export interface PartnerPoisResponse {
  pois: PartnerPoi[];
  items: PartnerPoi[];
  total: number;
  page: number;
  page_size: number;
  org_name?: string;
  access?: string;
}

// ─── Public municipalities (/municipios) ──────────────────────────────────────

export interface PartnerMunicipality {
  slug: string;
  municipality_id: string;
  display_name: string;
  tagline?: string | null;
  hero_image_url?: string | null;
  logo_url?: string | null;
  brand_color?: string | null;
}

export interface PartnerMunicipalitiesResponse {
  municipalities: PartnerMunicipality[];
  total: number;
}

export interface PublicMunicipalityPoi {
  id: string;
  name: string;
  category?: string;
  image_url?: string | null;
  micro_pitch?: string | null;
  location?: { lat: number; lng: number } | null;
}

export interface PublicMunicipalityRoute {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  duration_hours?: number | null;
}

export interface PublicMunicipalityResponse {
  slug: string;
  profile: MunicipalProfile & { municipality_id?: string };
  stats: {
    pois: number;
    audio_guides: number;
    categories: { category: string; count: number }[];
  };
  featured_pois: PublicMunicipalityPoi[];
  featured_routes: PublicMunicipalityRoute[];
  plan_white_label: boolean;
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

export const getMunicipalPlans = async (): Promise<MunicipalPlansResponse> => {
  const response = await api.get('/municipal/plans');
  return response.data;
};

/** 401 = not logged in, 403 = not a municipal user. */
export const getMySubscription = async (): Promise<MySubscriptionResponse> => {
  const response = await api.get('/municipal/me/subscription');
  return response.data;
};

/** Impact dashboard (defaults to the last 30 days). 402 when the municipality has no active plan. */
export const getMyImpact = async (params: ImpactParams = {}): Promise<ImpactResponse> => {
  const query: Record<string, string> = {};
  if (params.from) query.from = params.from;
  if (params.to) query.to = params.to;
  const response = await api.get('/municipal/me/impact', { params: query });
  return response.data;
};

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function filenameFromDisposition(header: unknown): string | null {
  if (typeof header !== 'string') return null;
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match ? match[1] : null;
}

/** Error bodies of `responseType: 'blob'` requests arrive as Blob — decode them so `detail` is readable. */
async function decodeBlobError(error: any): Promise<void> {
  const data = error?.response?.data;
  if (typeof Blob === 'undefined' || !(data instanceof Blob)) return;
  try {
    const text = await data.text();
    error.response.data = JSON.parse(text);
  } catch {
    // keep the original body
  }
}

/**
 * Download the monthly impact report (`period` = YYYY-MM) as PDF.
 *
 * Web: fetches the file with the Bearer header and triggers a browser download;
 * resolves `true`. Native: resolves `false` without a request (expo-file-system /
 * expo-sharing are not installed) — callers should point users to the web panel.
 * Throws the axios error on 402 / 422 / network failures.
 */
export const downloadMonthlyReport = async (period: string): Promise<boolean> => {
  if (!PERIOD_RE.test(period)) {
    throw new Error('Período inválido (AAAA-MM)');
  }
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return false;
  }
  let response: AxiosResponse<Blob>;
  try {
    response = await api.get(`/municipal/me/reports/${period}.pdf`, {
      responseType: 'blob',
      timeout: 60000,
    });
  } catch (error) {
    await decodeBlobError(error);
    throw error;
  }
  const data = response.data;
  const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
  const filename =
    filenameFromDisposition(response.headers?.['content-disposition']) ||
    `portugal-vivo-impacto-${period}.pdf`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
};

export const getMyProfile = async (): Promise<MyProfileResponse> => {
  const response = await api.get('/municipal/me/profile');
  return response.data;
};

/** 403 if the role is not 'municipio'; 402 without plan; 422 on validation errors. */
export const updateMyProfile = async (profile: MunicipalProfile): Promise<MunicipalProfile> => {
  const response = await api.put('/municipal/me/profile', profile);
  return response.data;
};

export const getFeaturedAudioGuides = async (): Promise<FeaturedAudioGuidesResponse> => {
  const response = await api.get('/municipal/me/audio-guides');
  return response.data;
};

/** 403 quota exhausted, 404 POI outside the territory, 402 no plan. */
export const featureAudioGuide = async (poiId: string): Promise<FeatureAudioGuideResponse> => {
  const response = await api.post(`/municipal/me/audio-guides/${encodeURIComponent(poiId)}`);
  return response.data;
};

export const unfeatureAudioGuide = async (poiId: string): Promise<void> => {
  await api.delete(`/municipal/me/audio-guides/${encodeURIComponent(poiId)}`);
};

export const getPartnerPois = async (
  params: { page?: number; page_size?: number; tier?: string; order?: 'asc' | 'desc' } = {},
): Promise<PartnerPoisResponse> => {
  const response = await api.get('/partner/pois', { params });
  return response.data;
};

export const getPartnerMunicipalities = async (): Promise<PartnerMunicipalitiesResponse> => {
  const response = await api.get('/municipios');
  return response.data;
};

/** 404 when the municipality has no public page. */
export const getPublicMunicipality = async (slug: string): Promise<PublicMunicipalityResponse> => {
  const response = await api.get(`/municipios/${encodeURIComponent(slug)}`);
  return response.data;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** HTTP status of an axios error (undefined for network errors). */
export function getApiErrorStatus(error: unknown): number | undefined {
  const status = (error as any)?.response?.status;
  return typeof status === 'number' ? status : undefined;
}

/**
 * Human-readable message from a FastAPI error: `detail` may be a string or a
 * list of `{loc, msg}` validation errors.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as any)?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length) {
    const messages = detail
      .map((d: any) => {
        const msg = typeof d?.msg === 'string' ? d.msg.replace(/^Value error, /, '') : '';
        const loc = Array.isArray(d?.loc) ? d.loc.filter((p: unknown) => p !== 'body').join('.') : '';
        return msg ? (loc ? `${loc}: ${msg}` : msg) : '';
      })
      .filter(Boolean);
    if (messages.length) return messages.join('\n');
  }
  return fallback;
}

export const SUBSCRIPTION_STATUS_LABELS: Record<MunicipalSubscriptionStatus, string> = {
  pilot: 'Piloto',
  active: 'Ativo',
  suspended: 'Suspenso',
  expired: 'Expirado',
};

const COUNTRY_NAMES_PT: Record<string, string> = {
  PT: 'Portugal',
  ES: 'Espanha',
  FR: 'França',
  GB: 'Reino Unido',
  DE: 'Alemanha',
  US: 'Estados Unidos',
  BR: 'Brasil',
  NL: 'Países Baixos',
  IT: 'Itália',
  ZZ: 'Desconhecida',
};

/** Portuguese country name for the most common origins, else the ISO code. */
export function countryLabel(code: string): string {
  const key = (code || 'ZZ').toUpperCase();
  return COUNTRY_NAMES_PT[key] ?? key;
}

/** "arcos-de-valdevez" → "Arcos de Valdevez" */
export function prettifyMunicipalitySlug(slug: string): string {
  const lower = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  return (slug || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w, i) => (i > 0 && lower.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** 12345 → "12 345" (pt-PT grouping, independent of Intl support). */
export function formatCount(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
