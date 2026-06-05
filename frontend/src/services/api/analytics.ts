import api from './client';

// ── Analytics ────────────────────────────────────────────────────────────────

export interface AnalyticsDashboard {
  period_days: number;
  generated_at: string;
  overview: { total_users: number; total_pois: number; total_routes: number };
  visits: { total: number; unique_visitors: number; avg_visits_per_user: number };
  retention: { returning_visitors: number; retention_rate_pct: number };
  user_growth: {
    new_users_period: number;
    by_week: { week: string; count: number }[];
  };
  top_pois_favorited: {
    poi_id: string; name: string; category?: string; region?: string;
    image_url?: string; favorites_count: number;
  }[];
  top_routes_shared: {
    route_id?: string; name?: string; category?: string;
    share_count: number; view_count: number;
  }[];
  category_engagement: { category: string; visits: number }[];
  region_engagement: { region: string; visits: number }[];
}

export interface AnalyticsTrend {
  metric: string;
  period_days: number;
  data: { date: string; value: number }[];
}

export const getAnalyticsDashboard = async (
  periodDays: number = 30
): Promise<AnalyticsDashboard> => {
  const response = await api.get('/analytics/dashboard', {
    params: { period_days: periodDays },
  });
  return response.data;
};

export const getAnalyticsTrends = async (
  metric: 'visits' | 'new_users' = 'visits',
  days: number = 30
): Promise<AnalyticsTrend> => {
  const response = await api.get('/analytics/trends', {
    params: { metric, days },
  });
  return response.data;
};
