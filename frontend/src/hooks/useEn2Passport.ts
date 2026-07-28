/**
 * useEn2Passport — passaporte de carimbos da EN2
 *
 * 11 distritos atravessados pela estrada. Os carimbos ficam guardados
 * localmente (AsyncStorage) — são um registo pessoal da viagem, não algo que
 * dependa de conta ou de rede.
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EN2_DISTRICTS } from '../data/en2';
import logger from '../utils/logger';

const STORAGE_KEY = '@portugal_vivo_en2_passport';

export interface En2PassportState {
  /** Nomes de distrito já carimbados */
  stamped: string[];
  /** Quantos dos 11 estão feitos */
  count: number;
  total: number;
  /** 0–100 */
  progress: number;
  /** Os 11 carimbados */
  complete: boolean;
  toggle: (district: string) => void;
  reset: () => void;
  /** false até o AsyncStorage responder — evita piscar o estado vazio */
  loaded: boolean;
}

export function useEn2Passport(): En2PassportState {
  const [stamped, setStamped] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            // Descarta distritos que já não existam na rota
            const valid = parsed.filter(
              (d): d is string =>
                typeof d === 'string' && EN2_DISTRICTS.some((x) => x.name === d),
            );
            setStamped(valid);
          }
        }
      })
      .catch((err) => logger.warn('useEn2Passport: falha ao ler carimbos', err))
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: string[]) => {
    setStamped(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((err) =>
      logger.warn('useEn2Passport: falha ao gravar carimbos', err),
    );
  }, []);

  const toggle = useCallback(
    (district: string) => {
      setStamped((current) => {
        const next = current.includes(district)
          ? current.filter((d) => d !== district)
          : [...current, district];
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((err) =>
          logger.warn('useEn2Passport: falha ao gravar carimbos', err),
        );
        return next;
      });
    },
    [],
  );

  const reset = useCallback(() => persist([]), [persist]);

  const total = EN2_DISTRICTS.length;
  const count = stamped.length;

  return {
    stamped,
    count,
    total,
    progress: total === 0 ? 0 : Math.round((count / total) * 100),
    complete: count === total,
    toggle,
    reset,
    loaded,
  };
}

export { STORAGE_KEY as EN2_PASSPORT_KEY };
