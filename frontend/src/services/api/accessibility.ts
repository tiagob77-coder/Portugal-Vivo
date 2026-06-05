import api from './client';
import type { HeritageItem } from '../../types';

// ========================
// ACCESSIBILITY FILTERS
// ========================

export interface AccessibilityFilter {
  id: string;
  name: string;
  icon: string;
}

export const getAccessibilityFilters = async (): Promise<{ filters: AccessibilityFilter[] }> => {
  const response = await api.get('/accessibility/filters');
  return response.data;
};

export const getAccessibleHeritage = async (
  filters?: string[],
  region?: string,
  category?: string,
  limit?: number
): Promise<{ items: HeritageItem[]; total: number; filters_applied: string[] }> => {
  const response = await api.get('/heritage/accessible', {
    params: {
      filters: filters?.join(','),
      region,
      category,
      limit,
    },
  });
  return response.data;
};
