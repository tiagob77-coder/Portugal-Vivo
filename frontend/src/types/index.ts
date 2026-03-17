export interface Location {
  lat: number;
  lng: number;
}

export interface HeritageItem {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  region: string;
  location?: Location;
  address?: string;
  image_url?: string;
  tags: string[];
  related_items: string[];
  metadata: Record<string, any>;
  created_at: string;
}

export interface Route {
  id: string;
  name: string;
  description: string;
  category: string;
  region?: string;
  items: string[];
  duration_hours?: number;
  distance_km?: number;
  difficulty?: string;
  tags: string[];
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Region {
  id: string;
  name: string;
  color: string;
}

export interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  favorites: string[];
}

export interface Stats {
  total_items: number;
  total_routes: number;
  total_users: number;
  categories: { id: string; name: string; count: number }[];
  regions: { id: string; name: string; count: number }[];
}
