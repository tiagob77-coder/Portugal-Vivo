/**
 * useDefaultRegion — resolve a região de partida do Guia de Exploração
 *
 * Cadeia de resolução, da mais forte para a mais fraca:
 *   1. escolha explícita do utilizador (chip do guia)
 *   2. GPS, quando já autorizado (nunca pede permissão por iniciativa própria)
 *   3. região escolhida no onboarding
 *   4. região passada por deep-link (`?region=`)
 *   5. Centro — fallback geográfico razoável para o continente
 *
 * O passo do GPS é deliberadamente passivo: pedir permissão só para escolher um
 * chip por omissão seria intrusivo. Se o utilizador já autorizou noutro ponto da
 * app, aproveitamos; caso contrário passamos ao passo seguinte em silêncio.
 */
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { guideRegions } from '../data/explorationGuide';
import { toTourismRegion } from '../utils/regionMatch';
import logger from '../utils/logger';

const PROFILE_REGION_KEY = 'profile_region';
const FALLBACK_REGION = 'centro';

const isKnownRegion = (id?: string | null): id is string =>
  !!id && guideRegions.some((r) => r.id === id);

/**
 * Região das 7 turísticas que contém um ponto, por caixa envolvente.
 *
 * Caixas aproximadas — chegam para escolher um chip por omissão, não para
 * classificar POIs (isso é trabalho do backend, com os limites da CAOP).
 */
export function regionFromCoords(lat: number, lng: number): string | null {
  if (lat >= 36.9 && lat <= 37.6 && lng >= -9.0 && lng <= -7.3) return 'algarve';
  if (lat >= 32.3 && lat <= 33.2 && lng >= -17.3 && lng <= -16.2) return 'madeira';
  if (lat >= 36.9 && lat <= 39.8 && lng >= -31.4 && lng <= -24.9) return 'acores';
  if (lat >= 37.0 && lat <= 39.4 && lng >= -8.3 && lng <= -6.9) return 'alentejo';
  if (lat >= 38.4 && lat <= 39.6 && lng >= -9.6 && lng <= -8.3) return 'lisboa';
  if (lat >= 39.4 && lat <= 41.1 && lng >= -9.0 && lng <= -6.8) return 'centro';
  if (lat >= 41.0 && lat <= 42.2 && lng >= -8.9 && lng <= -6.2) return 'norte';
  return null;
}

/** Lê o GPS apenas se a permissão já estiver concedida. */
async function regionFromGrantedLocation(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.permissions || !navigator.geolocation) {
        return null;
      }
      const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      if (status.state !== 'granted') return null;
      return await new Promise<string | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(regionFromCoords(pos.coords.latitude, pos.coords.longitude)),
          () => resolve(null),
          { timeout: 5000 },
        );
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExpoLocation = require('expo-location');
    const { status } = await ExpoLocation.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.Low,
    });
    return regionFromCoords(loc.coords.latitude, loc.coords.longitude);
  } catch (err) {
    logger.warn('useDefaultRegion: falha ao ler localização', err);
    return null;
  }
}

/**
 * @param explicit  região escolhida pelo utilizador neste ecrã
 * @param deepLink  região vinda de `?region=`
 */
export function useDefaultRegion(explicit?: string | null, deepLink?: string | null): string {
  const [resolved, setResolved] = useState<string>(FALLBACK_REGION);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (isKnownRegion(explicit)) return; // escolha explícita ganha sempre

      const fromGps = await regionFromGrantedLocation();
      if (cancelled) return;
      if (isKnownRegion(fromGps)) {
        setResolved(fromGps);
        return;
      }

      const stored = await AsyncStorage.getItem(PROFILE_REGION_KEY);
      if (cancelled) return;
      const fromProfile = toTourismRegion(stored ?? undefined);
      if (isKnownRegion(fromProfile)) {
        setResolved(fromProfile);
        return;
      }

      const fromLink = toTourismRegion(deepLink ?? undefined);
      if (isKnownRegion(fromLink)) {
        setResolved(fromLink);
        return;
      }

      setResolved(FALLBACK_REGION);
    })();

    return () => {
      cancelled = true;
    };
  }, [explicit, deepLink]);

  return isKnownRegion(explicit) ? explicit : resolved;
}

export { FALLBACK_REGION, isKnownRegion };
