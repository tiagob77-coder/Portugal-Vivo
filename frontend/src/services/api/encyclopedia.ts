import api from './client';
import type { HeritageItem } from '../../types';

// ========================
// ENCYCLOPEDIA VIVA
// ========================

export interface EncyclopediaUniverse {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  categories: string[];
  article_count: number;
  item_count: number;
}

export interface EncyclopediaArticle {
  id: string;
  title: string;
  slug: string;
  universe: string;
  summary: string;
  content?: string;
  region?: string;
  location?: { lat: number; lng: number };
  image_url?: string;
  gallery?: string[];
  related_articles?: string[];
  related_items?: string[];
  tags: string[];
  sources?: string[];
  views: number;
  created_at: string;
  updated_at: string;
}

export interface EncyclopediaUniverseDetail extends EncyclopediaUniverse {
  articles: EncyclopediaArticle[];
  featured_items: HeritageItem[];
  total_articles: number;
  total_items: number;
}

export interface EncyclopediaArticleDetail extends EncyclopediaArticle {
  body?: string;
  universe_name?: string;
  category_name?: string;
  related_articles_data: EncyclopediaArticle[];
  related_items_data: HeritageItem[];
  universe_info: EncyclopediaUniverse;
}

export interface EncyclopediaFeatured {
  top_articles: EncyclopediaArticle[];
  recent_articles: EncyclopediaArticle[];
  universe_highlights: {
    universe: EncyclopediaUniverse;
    featured_article: EncyclopediaArticle;
  }[];
}

export const getEncyclopediaUniverses = async (): Promise<EncyclopediaUniverse[]> => {
  const response = await api.get('/encyclopedia/universes');
  return response.data;
};

export const getEncyclopediaUniverse = async (universeId: string): Promise<EncyclopediaUniverseDetail> => {
  const response = await api.get(`/encyclopedia/universe/${universeId}`);
  return response.data;
};

export const getEncyclopediaArticles = async (params?: {
  universe?: string;
  region?: string;
  tag?: string;
  search?: string;
  limit?: number;
  skip?: number;
}): Promise<{ articles: EncyclopediaArticle[]; total: number }> => {
  const response = await api.get('/encyclopedia/articles', { params });
  return response.data;
};

export const getEncyclopediaArticle = async (articleId: string): Promise<EncyclopediaArticleDetail> => {
  const response = await api.get(`/encyclopedia/article/${articleId}`);
  return response.data;
};

export const getEncyclopediaFeatured = async (): Promise<EncyclopediaFeatured> => {
  const response = await api.get('/encyclopedia/featured');
  return response.data;
};

export const searchEncyclopedia = async (query: string, limit: number = 20): Promise<{
  query: string;
  articles: EncyclopediaArticle[];
  items: HeritageItem[];
  total: number;
}> => {
  const response = await api.get('/encyclopedia/search', { params: { q: query, limit } });
  return response.data;
};
