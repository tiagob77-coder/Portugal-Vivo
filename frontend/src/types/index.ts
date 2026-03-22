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
  /** CAOP — Carta Administrativa Oficial de Portugal (DGT) */
  distrito?: string;
  concelho?: string;
  freguesia?: string;
  nuts_iii?: string;
  codigo_postal?: string;
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
  category?: string;
  theme?: string;
  region?: string;
  items: string[];
  duration_hours?: number;
  duration_days?: number;
  distance_km?: number;
  difficulty?: string;
  icon?: string;
  tags: string[];
  image_url?: string;
  external_url?: string;
  highlights?: string[];
  subtitle?: string;
  best_season?: string;
  audience?: string[];
  rating?: number;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface MainCategory extends Category {
  description: string;
  poi_target: number;
  subcategories?: Subcategory[];
}

export interface Subcategory extends Category {
  main_category: string;
  theme: string;
  poi_target: number;
}

export interface Region {
  id: string;
  name: string;
  color: string;
  icon?: string;
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

// Nature & Biodiversity Types
export interface ProtectedArea {
  id: string;
  name: string;
  designation: string;
  area_km2?: number;
  region: string;
  municipality: string;
  lat?: number;
  lng?: number;
  description: string;
  network: string;
  distance_km?: number;
}

export interface Natura2000Site {
  id: string;
  name: string;
  type: 'SIC' | 'ZPE';
  lat: number;
  lng: number;
  area_km2: number;
  region: string;
  habitats: string[];
  distance_km?: number;
}

export interface BiodiversityStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  municipality: string;
  district: string;
  habitat_type: string;
  species_count?: number;
  highlights: string[];
  distance_km?: number;
}

export interface SpeciesOccurrence {
  key: number;
  species: string;
  scientific_name: string;
  kingdom: string;
  family: string;
  lat?: number;
  lng?: number;
  locality: string;
  event_date: string;
}

export interface NotableSpecies {
  name: string;
  scientific: string;
  taxon_key: number;
  iucn: string;
  habitat: string;
  regions: string[];
}

export interface WMSMapLayer {
  id: string;
  name: string;
  wms_url: string;
  type: string;
  opacity: number;
  color: string;
}

// Transport Types
export interface TransportStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  line?: string;
  transport_type: string;
  operator: string;
  distance_km: number;
  distance_m: number;
}

export interface TransportRoute {
  origin: Location;
  destination: Location;
  direct_distance_km: number;
  origin_stops: TransportStop[];
  destination_stops: TransportStop[];
  suggestions: TransportSuggestion[];
}

export interface TransportSuggestion {
  type: string;
  operator?: string;
  from_station: string;
  to_station: string;
  walk_origin_m?: number;
  walk_dest_m?: number;
  note?: string;
}

// Discovery Types
export interface EventEnrichment {
  event: { name: string; lat: number; lng: number };
  protected_area?: { area: ProtectedArea; distance_km: number };
  biodiversity_station?: { station: BiodiversityStation; distance_km: number };
  transport: TransportStop[];
  trails: any[];
  natura2000_nearby?: Natura2000Site[];
  geo_context?: GeoContext;
  nature_suggestions: NatureSuggestion[];
}

export interface GeoContext {
  lat: number;
  lng: number;
  freguesia: string;
  concelho: string;
  distrito: string;
  codigo_postal: string;
}

export interface NatureSuggestion {
  type: string;
  title: string;
  description: string;
  distance_km: number;
  priority: number;
  highlights?: string[];
}

export interface EventToNatureItinerary {
  event: { name: string; lat: number; lng: number };
  day_1_evening: {
    activity: string;
    location: Location;
    transport_to_event: TransportStop[];
  };
  day_2_morning?: {
    activity: string;
    nature_destination: any;
    location: Location;
    notable_species?: NotableSpecies[];
  };
  transport_between?: TransportRoute;
  sustainability_tips: string[];
}

export interface TrailSafety {
  location: Location;
  weather_alerts: WeatherAlertInfo[];
  protected_area_rules: string[];
  nearby_protected_area?: { area: ProtectedArea; distance_km: number };
}

export interface WeatherAlertInfo {
  type: string;
  level: string;
  region: string;
  title: string;
  description: string;
}

export interface HikingTrail {
  osm_id: number;
  name: string;
  type: string;
  distance?: string;
  difficulty?: string;
  network?: string;
  source: string;
}

export interface EuroVeloRoute {
  id: string;
  name: string;
  description: string;
  distance_km: number;
  start: string;
  end: string;
  highlights: string[];
  difficulty: string;
}

export interface LongDistanceTrail {
  id: string;
  name: string;
  distance_km: number;
  stages: number;
  difficulty: string;
  region: string;
  description: string;
}
