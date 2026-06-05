import api from './client';
import type { ApiParams } from '../../types';

// ============================================
// IQ ENGINE API
// ============================================

export interface IQModuleResult {
  module: string;
  score: number;
  status: string;
  processing_time_ms: number;
  data: any;
  suggestions: string[];
}

export interface IQProcessResult {
  poi_id: string;
  poi_name: string;
  overall_score: number;
  processing_time_ms: number;
  modules_run: string[];
  results: IQModuleResult[];
  recommendations: string[];
}

export interface IQEngineHealth {
  status: string;
  modules_registered: string[];
  total_modules: number;
}

export const getIQHealth = async (): Promise<IQEngineHealth> => {
  const response = await api.get('/iq/health');
  return response.data;
};

export const processPoiIQ = async (
  poiId: string,
  tenantId: string,
  modules?: string[]
): Promise<IQProcessResult> => {
  const config: { params?: ApiParams; headers?: Record<string, string> } = {
    headers: { 'X-Tenant-ID': tenantId },
  };
  const response = await api.post(
    `/iq/process-poi/${poiId}`,
    modules && modules.length > 0 ? modules : null,
    config
  );
  return response.data;
};

export const batchProcessIQ = async (
  tenantId: string,
  limit?: number
): Promise<any> => {
  const response = await api.post(
    '/iq/batch-process',
    { limit: limit || 10 },
    { headers: { 'X-Tenant-ID': tenantId } }
  );
  return response.data;
};

export const getIQStats = async (tenantId: string): Promise<any> => {
  const response = await api.get('/iq/stats', {
    headers: { 'X-Tenant-ID': tenantId },
  });
  return response.data;
};

// Get tenant heritage items for IQ processing
export const getTenantPOIs = async (tenantId: string): Promise<any[]> => {
  const response = await api.get('/heritage', {
    headers: { 'X-Tenant-ID': tenantId },
  });
  return response.data;
};

// ========================
// IQ MONITOR
// ========================

export interface IQOverview {
  total_pois: number;
  iq_processed: number;
  iq_pending: number;
  iq_progress_pct: number;
  with_coordinates: number;
  avg_iq_score: number;
  max_iq_score: number;
  min_iq_score: number;
  score_distribution: { label: string; min: number; max: number; count: number; color: string }[];
  categories: { name: string; count: number; avg_score: number; max_score: number }[];
  regions: { name: string; count: number; avg_score: number }[];
}

export interface IQAdminData extends IQOverview {
  modules: { name: string; processed: number; avg_score: number; avg_confidence: number; pass: number; warn: number; fail: number }[];
  sources: { name: string; count: number }[];
  recent_processed: { id: string; name: string; category: string; region: string; iq_score: number; iq_processed_at: string; iq_module_count: number }[];
  top_pois: { id: string; name: string; category: string; region: string; iq_score: number }[];
  bottom_pois: { id: string; name: string; category: string; region: string; iq_score: number }[];
  import_batches: { batch_id: string; total: number; iq_done: number }[];
}

export const getIQOverview = async (): Promise<IQOverview> => {
  const response = await api.get('/iq-monitor/overview');
  return response.data;
};

export const getIQAdmin = async (): Promise<IQAdminData> => {
  const response = await api.get('/iq-monitor/admin');
  return response.data;
};

// ========================
// POI DO DIA
// ========================

export interface POIDoDia {
  has_poi: boolean;
  date: string;
  category: string;
  category_label: string;
  category_icon: string;
  tomorrow_category: string;
  poi: {
    id: string;
    name: string;
    description: string;
    category: string;
    subcategory: string;
    region: string;
    address: string;
    location: { lat: number; lng: number };
    image_url: string | null;
    iq_score: number;
    rarity: string;
    website: string;
  };
}

export const getPOIDoDia = async (): Promise<POIDoDia> => {
  const response = await api.get('/poi-do-dia');
  return response.data;
};
