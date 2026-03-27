/**
 * NativeMap.types.ts — Shared types for map components
 */

export interface MapItem {
  id: string;
  name: string;
  category: string;
  region: string;
  location: { lat: number; lng: number };
  description?: string;
  iq_score?: number;
  image_url?: string;
}

export interface LeafletMapProps {
  items: MapItem[];
  onItemPress?: (item: MapItem) => void;
  getMarkerColor: (category: string) => string;
  getLayerIcon?: (category: string) => string;
  mapMode?: string;
  trailPoints?: { lat: number; lng: number; ele?: number }[];
  trailColor?: string;
  style?: any;
  children?: React.ReactNode;
  ref?: any;
  provider?: any;
  initialRegion?: any;
  onMapReady?: () => void;
  showsUserLocation?: boolean;
  [key: string]: any;
}
