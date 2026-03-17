// NativeMap.tsx - barrel file for TypeScript module resolution
// At runtime, Metro resolves .native.tsx or .web.tsx based on platform
// This file should NOT import directly - let Metro handle platform resolution

import { Platform } from 'react-native';

// Conditional exports based on platform
// Metro bundler will resolve the correct platform-specific file at build time
let MapComponent: any;
let LeafletMapComponent: any;
let Marker: any;
let Callout: any;
let PROVIDER_GOOGLE: any;
let isMapAvailable: boolean;

if (Platform.OS === 'web') {
  // Web platform - use Leaflet
  const webModule = require('./NativeMap.web');
  MapComponent = webModule.default;
  LeafletMapComponent = webModule.LeafletMapComponent;
  Marker = webModule.Marker;
  Callout = webModule.Callout;
  PROVIDER_GOOGLE = webModule.PROVIDER_GOOGLE;
  isMapAvailable = webModule.isMapAvailable;
} else {
  // Native platforms (iOS/Android) - use WebView with Leaflet
  const nativeModule = require('./NativeMap.native');
  MapComponent = nativeModule.default;
  LeafletMapComponent = nativeModule.LeafletMapComponent;
  Marker = nativeModule.Marker;
  Callout = nativeModule.Callout;
  PROVIDER_GOOGLE = nativeModule.PROVIDER_GOOGLE;
  isMapAvailable = nativeModule.isMapAvailable;
}

export default MapComponent;
export { LeafletMapComponent, Marker, Callout, PROVIDER_GOOGLE, isMapAvailable };
