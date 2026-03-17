// NativeMap.tsx - barrel file for TypeScript module resolution
// At runtime, Metro resolves .native.tsx or .web.tsx based on platform
import { Platform } from 'react-native';

let MapComponent: any;
let LeafletMapComp: any;
let MarkerComp: any;
let CalloutComp: any;
let PROVIDER: any;
let mapAvailable: boolean;

if (Platform.OS === 'web') {
  const webModule = require('./NativeMap.web');
  MapComponent = webModule.default;
  LeafletMapComp = webModule.LeafletMapComponent;
  MarkerComp = webModule.Marker;
  CalloutComp = webModule.Callout;
  PROVIDER = webModule.PROVIDER_GOOGLE;
  mapAvailable = webModule.isMapAvailable;
} else {
  const nativeModule = require('./NativeMap.native');
  MapComponent = nativeModule.default;
  LeafletMapComp = nativeModule.LeafletMapComponent;
  MarkerComp = nativeModule.Marker;
  CalloutComp = nativeModule.Callout;
  PROVIDER = nativeModule.PROVIDER_GOOGLE;
  mapAvailable = nativeModule.isMapAvailable;
}

export default MapComponent;
export const LeafletMapComponent = LeafletMapComp;
export const Marker = MarkerComp;
export const Callout = CalloutComp;
export const PROVIDER_GOOGLE = PROVIDER;
export const isMapAvailable = mapAvailable;
