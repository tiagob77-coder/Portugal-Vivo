// NativeMap.tsx - Platform-specific map exports
// Re-exports from the web implementation for web platform
// Metro bundler handles platform-specific resolution

import { Platform } from 'react-native';

// Export types from the shared types file
export type { MapItem, LeafletMapProps } from './NativeMap.types';

// On web, export the Leaflet-based web implementation
// On native, this file won't be loaded (Metro uses .native.tsx)

let MapComponent: any = null;
let LeafletMapComponent: any = null;
let Marker: any = () => null;
let Callout: any = () => null;
let PROVIDER_GOOGLE: any = null;
let isMapAvailable: boolean = false;

// Only load web module on web platform
if (Platform.OS === 'web') {
  try {
    // Dynamic require to avoid bundling issues
    const webModule = require('./NativeMap.web'); // eslint-disable-line @typescript-eslint/no-require-imports
    MapComponent = webModule.default;
    LeafletMapComponent = webModule.LeafletMapComponent;
    Marker = webModule.Marker;
    Callout = webModule.Callout;
    PROVIDER_GOOGLE = webModule.PROVIDER_GOOGLE;
    isMapAvailable = webModule.isMapAvailable;
  } catch (e) {
    console.warn('Failed to load NativeMap.web module:', e);
  }
}

export default MapComponent;
export { LeafletMapComponent, Marker, Callout, PROVIDER_GOOGLE, isMapAvailable };
