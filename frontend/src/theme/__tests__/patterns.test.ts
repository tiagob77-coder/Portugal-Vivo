import { patternUri, azulejoTile, calcadaTile } from '../patterns';

describe('theme/patterns', () => {
  it('azulejoTile returns an SVG data-URI', () => {
    const uri = azulejoTile();
    expect(uri.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('calcadaTile encodes the stroke colour (# → %23)', () => {
    const uri = calcadaTile('#1F4E79');
    expect(uri).toContain('%231F4E79');
  });

  it('patternUri dispatches azulejo by default and calcada when asked', () => {
    expect(patternUri('azulejo')).toMatch(/^data:image\/svg\+xml/);
    expect(patternUri('calcada')).toMatch(/^data:image\/svg\+xml/);
    // azulejo and calcada produce different tiles
    expect(patternUri('azulejo')).not.toBe(patternUri('calcada'));
  });

  it('respects a custom tile size', () => {
    const small = azulejoTile('#1B5E91', 20);
    const large = azulejoTile('#1B5E91', 80);
    expect(small).not.toBe(large);
  });
});
