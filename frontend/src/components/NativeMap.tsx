/**
 * NativeMap.tsx - Platform-specific map exports
 * 
 * Metro bundler handles platform-specific resolution:
 * - Web: This file is used, which imports from NativeMap.web.tsx
 * - Native (iOS/Android): NativeMap.native.tsx is used instead
 */

// Export types from the shared types file
export type { MapItem, LeafletMapProps } from './NativeMap.types';

// Import everything from web module for web platform
// On native, Metro will use NativeMap.native.tsx instead of this file
export { 
  default,
  LeafletMapComponent, 
  Marker, 
  Callout, 
  PROVIDER_GOOGLE, 
  isMapAvailable 
} from './NativeMap.web';
