/**
 * cdnImage — wrapper opcional sobre o Cloudinary *fetch* com fallback no-op seguro.
 *
 * Quando `EXPO_PUBLIC_CLOUDINARY_CLOUD` está definido, os URLs de imagem remotos
 * são servidos via Cloudinary para formato/qualidade automáticos e um tratamento
 * "hora dourada" opcional. Quando NÃO está definido (default), devolve o URL
 * original inalterado — zero mudança de comportamento, zero risco.
 *
 * Assets locais (`require()`), data-URIs (ex.: padrões), `blob:`/`file:` e URLs
 * já-Cloudinary passam intactos. A leitura do env é feita dentro das funções
 * para ser testável e respeitar a substituição estática do Expo (`EXPO_PUBLIC_*`).
 *
 * Usage:
 *   import { cdnImage } from '../utils/cdnImage';
 *   <Image source={{ uri: cdnImage(uri, { width: 400, look: 'warm' }) }} />
 */

export type CdnLook = 'none' | 'warm';

export interface CdnOptions {
  /** Largura de exibição alvo (px) → Cloudinary `w_`. */
  width?: number;
  /** Altura de exibição alvo (px) → Cloudinary `h_`. */
  height?: number;
  /** Qualidade. Default 'auto'. */
  quality?: number | 'auto';
  /** Modo de corte quando há width/height. Default 'fill'. */
  crop?: 'fill' | 'fit' | 'scale' | 'thumb';
  /** Tratamento de cor. 'warm' aplica um grading subtil de hora dourada. */
  look?: CdnLook;
  /** Device pixel ratio. Default 'auto'. */
  dpr?: number | 'auto';
}

const getCloudName = (): string =>
  (process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD || '').trim();

const getDefaultLook = (): CdnLook => {
  const v = (process.env.EXPO_PUBLIC_CLOUDINARY_LOOK || 'warm').trim();
  return v === 'none' ? 'none' : 'warm';
};

/** True quando há um cloud Cloudinary configurado. */
export const isCdnEnabled = (): boolean => getCloudName().length > 0;

/** Apenas URLs remotos http(s) e ainda não servidos por Cloudinary são transformáveis. */
function isTransformable(uri: string): boolean {
  if (!uri) return false;
  if (uri.startsWith('data:') || uri.startsWith('blob:') || uri.startsWith('file:')) return false;
  if (!/^https?:\/\//i.test(uri)) return false;          // relativo / asset local
  if (uri.includes('res.cloudinary.com')) return false;  // já transformado
  return true;
}

function buildTransform(opts: CdnOptions, look: CdnLook): string {
  const parts: string[] = ['f_auto', `q_${opts.quality ?? 'auto'}`, `dpr_${opts.dpr ?? 'auto'}`];
  if (opts.width) parts.push(`w_${Math.round(opts.width)}`);
  if (opts.height) parts.push(`h_${Math.round(opts.height)}`);
  if (opts.width || opts.height) parts.push(`c_${opts.crop ?? 'fill'}`);
  if (look === 'warm') {
    // Hora dourada subtil: ligeiro reforço de saturação + contraste.
    parts.push('e_saturation:12', 'e_contrast:6');
  }
  return parts.join(',');
}

/**
 * Encaminha um URL de imagem remoto via Cloudinary fetch (quando configurado).
 * Devolve o URL original quando o CDN está desligado ou o URL é local/inline.
 */
export function cdnImage(uri?: string | null, opts: CdnOptions = {}): string | undefined {
  if (uri == null) return undefined;
  if (!isCdnEnabled() || !isTransformable(uri)) return uri;
  const look = opts.look ?? getDefaultLook();
  const transform = buildTransform(opts, look);
  return `https://res.cloudinary.com/${getCloudName()}/image/fetch/${transform}/${encodeURIComponent(uri)}`;
}

export default cdnImage;
