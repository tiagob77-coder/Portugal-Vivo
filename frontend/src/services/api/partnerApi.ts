import api from './client';

// =============================================================================
// PARTNER API (B2B) — plans, access requests, API key administration
// MUNICIPAL CONTRACTS (B2G) — plans and subscriptions (admin)
//
// Not re-exported from the barrel on purpose: import this module directly.
// =============================================================================

// ─── Partner API (B2B) ───────────────────────────────────────────────────────

export type ApiPlanId = 'explorador' | 'parceiro' | 'pro' | 'enterprise';

export type ApiFeature =
  | 'heritage'
  | 'routes'
  | 'map'
  | 'narratives'
  | 'weather'
  | 'events'
  | 'audio';

export interface ApiPlan {
  id: ApiPlanId;
  name: string;
  price_eur_month: number;
  price_eur_month_billed_annually: number;
  /** `null` means unlimited. */
  monthly_quota: number | null;
  features: ApiFeature[];
  sla: string | null;
  white_label: boolean;
}

export interface ApiPlansResponse {
  plans: ApiPlan[];
  annual_discount: number;
  currency: string;
  vat_included: boolean;
  auth_header: string;
}

export interface AccessRequestPayload {
  org_name: string;
  contact_name: string;
  contact_email: string;
  /** 10–2000 characters. */
  use_case: string;
  desired_plan: ApiPlanId;
  website?: string;
}

export interface AccessRequestCreated {
  request_id: string;
  status: 'pending';
}

export type ApiKeyStatus = 'active' | 'suspended' | 'revoked';

export interface ApiKeyUsage {
  period: string;
  used: number;
  quota: number | null;
}

export interface ApiKey {
  key_id: string;
  key_prefix: string;
  name: string;
  org_name: string;
  contact_email?: string | null;
  plan: ApiPlanId;
  status: ApiKeyStatus;
  created_at: string;
  last_used_at?: string | null;
  request_id?: string | null;
  usage?: ApiKeyUsage;
}

export interface ApiKeysResponse {
  keys: ApiKey[];
  total: number;
  mrr_eur_list_price: number;
}

export interface ApiKeyCreatePayload {
  name: string;
  org_name: string;
  contact_email?: string;
  plan: ApiPlanId;
  request_id?: string;
}

export interface ApiKeyCreated extends ApiKey {
  /** Plaintext key — returned only once, on creation. */
  api_key: string;
  warning: string;
}

export interface ApiKeyUpdatePayload {
  name?: string;
  plan?: ApiPlanId;
  status?: 'active' | 'suspended';
}

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AccessRequest {
  request_id: string;
  org_name: string;
  contact_name: string;
  contact_email: string;
  use_case: string;
  desired_plan: ApiPlanId;
  website?: string | null;
  status: AccessRequestStatus | string;
  created_at: string;
}

export interface AccessRequestsResponse {
  requests: AccessRequest[];
  total: number;
}

export const getApiPlans = async (): Promise<ApiPlansResponse> => {
  const response = await api.get('/v1/plans');
  return response.data;
};

export const createAccessRequest = async (
  payload: AccessRequestPayload,
): Promise<AccessRequestCreated> => {
  const body: AccessRequestPayload = { ...payload };
  if (!body.website) delete body.website;
  const response = await api.post('/v1/access-requests', body);
  return response.data;
};

export const listApiKeys = async (status?: ApiKeyStatus): Promise<ApiKeysResponse> => {
  const response = await api.get('/admin/api-keys', { params: status ? { status } : undefined });
  return response.data;
};

export const createApiKey = async (payload: ApiKeyCreatePayload): Promise<ApiKeyCreated> => {
  const body: ApiKeyCreatePayload = { ...payload };
  if (!body.contact_email) delete body.contact_email;
  if (!body.request_id) delete body.request_id;
  const response = await api.post('/admin/api-keys', body);
  return response.data;
};

export const updateApiKey = async (
  keyId: string,
  payload: ApiKeyUpdatePayload,
): Promise<ApiKey> => {
  const response = await api.patch(`/admin/api-keys/${encodeURIComponent(keyId)}`, payload);
  return response.data;
};

/** Revoke a key. Irreversible — the backend answers 204. */
export const revokeApiKey = async (keyId: string): Promise<void> => {
  await api.delete(`/admin/api-keys/${encodeURIComponent(keyId)}`);
};

export const listAccessRequests = async (
  status: AccessRequestStatus | string = 'pending',
): Promise<AccessRequestsResponse> => {
  const response = await api.get('/admin/api-keys/requests', { params: { status } });
  return response.data;
};

// ─── Municipal contracts (B2G) ───────────────────────────────────────────────

export type MunicipalPlanId = 'essencial' | 'territorio' | 'destino';

export type MunicipalSubscriptionStatus = 'pilot' | 'active' | 'suspended' | 'expired';

export interface MunicipalPlan {
  id: MunicipalPlanId;
  name: string;
  audience: string;
  price_eur_year: number;
  /** `null` means unlimited. */
  max_pois: number | null;
  max_audio_guides: number;
  white_label: boolean;
  setup_fee_eur: number;
}

export interface MunicipalPlansResponse {
  plans: MunicipalPlan[];
  setup_fee_eur: number;
  pilot_months: number;
  currency?: string;
  vat_included?: boolean;
  notes?: string;
}

export interface MunicipalSubscription {
  municipality_id: string;
  plan: MunicipalPlanId;
  status: MunicipalSubscriptionStatus;
  starts_at: string | null;
  ends_at: string | null;
  concelhos: string[];
  municipality_aliases: string[];
  contract_ref?: string | null;
  notes?: string | null;
  updated_at?: string | null;
}

export interface MunicipalSubscriptionsResponse {
  subscriptions: MunicipalSubscription[];
  total: number;
  active: number;
  arr_eur_list_price: number;
}

export interface MunicipalSubscriptionUpsert {
  plan: MunicipalPlanId;
  status: MunicipalSubscriptionStatus;
  starts_at?: string;
  ends_at?: string;
  concelhos: string[];
  municipality_aliases: string[];
  contract_ref?: string;
  notes?: string;
}

export const getMunicipalPlans = async (): Promise<MunicipalPlansResponse> => {
  const response = await api.get('/municipal/plans');
  return response.data;
};

export const listMunicipalSubscriptions = async (): Promise<MunicipalSubscriptionsResponse> => {
  const response = await api.get('/admin/municipal/subscriptions');
  return response.data;
};

export const upsertMunicipalSubscription = async (
  municipalityId: string,
  payload: MunicipalSubscriptionUpsert,
): Promise<MunicipalSubscription> => {
  const body: MunicipalSubscriptionUpsert = { ...payload };
  (['starts_at', 'ends_at', 'contract_ref', 'notes'] as const).forEach((field) => {
    if (!body[field]) delete body[field];
  });
  const response = await api.put(
    `/admin/municipal/subscriptions/${encodeURIComponent(municipalityId)}`,
    body,
  );
  return response.data;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract a human-readable message from an axios error (FastAPI `detail`). */
export const partnerApiErrorMessage = (error: unknown, fallback: string): string => {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string; loc?: (string | number)[] };
    const field = Array.isArray(first?.loc) ? first.loc[first.loc.length - 1] : undefined;
    if (first?.msg) return field ? `${field}: ${first.msg}` : first.msg;
  }
  return fallback;
};
