/**
 * Texturas portuguesas como data-URIs SVG (sem dependências nativas).
 *
 * Cada função devolve um SVG *self-tiling* (via <pattern patternUnits=
 * "userSpaceOnUse">) codificado como data-URI, pronto a usar em <expo-image>.
 * Renderiza em web e nativo; se o SVG não renderizar, degrada para
 * transparente (nunca crasha). Usar sempre tom-sobre-tom via <PatternBackground>.
 *
 * Usage:
 *   import { patternUri } from '../theme/patterns';
 *   <Image source={{ uri: patternUri('azulejo', '#1B5E91') }} />
 */

export type PatternKind = 'azulejo' | 'calcada';

// utf8 data-URI — funciona em web e em expo-image (nativo)
function encode(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Padrão de azulejo — losango + quadrilóbulo central + arcos de canto que
 * formam círculos completos nas junções das tiles (malha clássica).
 */
export function azulejoTile(color = '#1B5E91', size = 44): string {
  const s = size;
  const h = s / 2;
  const r = 8;
  const corners =
    `M0 ${r} A${r} ${r} 0 0 1 ${r} 0 ` +
    `M${s - r} 0 A${r} ${r} 0 0 1 ${s} ${r} ` +
    `M${s} ${s - r} A${r} ${r} 0 0 1 ${s - r} ${s} ` +
    `M${r} ${s} A${r} ${r} 0 0 1 0 ${s - r}`;
  const diamond = `M${h} 3 L${s - 3} ${h} L${h} ${s - 3} L3 ${h} Z`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">` +
    `<defs><pattern id="a" patternUnits="userSpaceOnUse" width="${s}" height="${s}">` +
    `<g fill="none" stroke="${color}" stroke-width="1.4">` +
    `<path d="${diamond}"/>` +
    `<rect x="${h - 6}" y="${h - 6}" width="12" height="12" transform="rotate(45 ${h} ${h})"/>` +
    `<path d="${corners}"/>` +
    `</g></pattern></defs>` +
    `<rect width="100%" height="100%" fill="url(#a)"/></svg>`;
  return encode(svg);
}

/**
 * Padrão de calçada portuguesa — ondas paralelas (estilo Rossio / mar).
 */
export function calcadaTile(color = '#1F4E79', size = 48): string {
  const w = size;
  const h = size / 2;
  const wave = `M0 ${h * 0.72} Q ${w * 0.25} ${h * 0.12}, ${w * 0.5} ${h * 0.72} T ${w} ${h * 0.72}`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">` +
    `<defs><pattern id="c" patternUnits="userSpaceOnUse" width="${w}" height="${h}">` +
    `<path d="${wave}" fill="none" stroke="${color}" stroke-width="2"/>` +
    `</pattern></defs>` +
    `<rect width="100%" height="100%" fill="url(#c)"/></svg>`;
  return encode(svg);
}

export function patternUri(kind: PatternKind, color?: string): string {
  return kind === 'calcada' ? calcadaTile(color) : azulejoTile(color);
}
