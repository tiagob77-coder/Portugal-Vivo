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
  session_token?: string;
}

export interface Stats {
  total_items: number;
  total_routes: number;
  total_users: number;
  categories: { id: string; name: string; count: number }[];
  regions: { id: string; name: string; count: number }[];
}

export interface Contribution {
  id: string;
  user_id: string;
  user_name: string;
  heritage_item_id?: string;
  type: string;
  title: string;
  content: string;
  location?: Location;
  category?: string;
  region?: string;
  status: string;
  votes: number;
  created_at: string;
}

export interface ContributionCreate {
  heritage_item_id?: string;
  type: string;
  title: string;
  content: string;
  location?: Location;
  category?: string;
  region?: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  requirement: number;
  type: string;
  earned?: boolean;
  progress?: number;
  current?: number;
}

export interface UserProgress {
  user_id: string;
  visits_count: number;
  favorites_count: number;
  routes_completed: number;
  contributions_approved: number;
  total_points: number;
  level: number;
  badges: Badge[];
}

export interface LeaderboardEntry {
  user_id: string;
  name: string;
  picture?: string;
  total_points: number;
  level: number;
  badges_count: number;
}

export interface CalendarEvent {
  id: string;
  name: string;
  date_start: string;
  date_end: string;
  category: string;
  region: string;
  description: string;
}
