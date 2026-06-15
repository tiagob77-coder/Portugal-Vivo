import { cdnImage, isCdnEnabled } from '../cdnImage';

const CLOUD = 'EXPO_PUBLIC_CLOUDINARY_CLOUD';
const LOOK = 'EXPO_PUBLIC_CLOUDINARY_LOOK';

describe('cdnImage', () => {
  afterEach(() => {
    delete process.env[CLOUD];
    delete process.env[LOOK];
  });

  describe('no-op when CDN is not configured', () => {
    it('returns the original remote URL unchanged', () => {
      expect(cdnImage('https://images.unsplash.com/photo-1.jpg')).toBe(
        'https://images.unsplash.com/photo-1.jpg',
      );
    });

    it('reports CDN disabled', () => {
      expect(isCdnEnabled()).toBe(false);
    });

    it('returns undefined for null / undefined input', () => {
      expect(cdnImage(undefined)).toBeUndefined();
      expect(cdnImage(null)).toBeUndefined();
    });
  });

  describe('when a cloud is configured', () => {
    beforeEach(() => {
      process.env[CLOUD] = 'demo';
    });

    it('reports CDN enabled', () => {
      expect(isCdnEnabled()).toBe(true);
    });

    it('routes remote URLs through Cloudinary fetch with f_auto/q_auto', () => {
      const out = cdnImage('https://images.unsplash.com/photo-1.jpg')!;
      expect(out).toContain('https://res.cloudinary.com/demo/image/fetch/');
      expect(out).toContain('f_auto');
      expect(out).toContain('q_auto');
      expect(out).toContain(encodeURIComponent('https://images.unsplash.com/photo-1.jpg'));
    });

    it('applies the warm look by default', () => {
      expect(cdnImage('https://x.com/a.jpg')!).toContain('e_saturation:12');
    });

    it('omits the warm grade when look=none', () => {
      expect(cdnImage('https://x.com/a.jpg', { look: 'none' })!).not.toContain('e_saturation');
    });

    it('honours the global look env override', () => {
      process.env[LOOK] = 'none';
      expect(cdnImage('https://x.com/a.jpg')!).not.toContain('e_saturation');
    });

    it('adds width + crop when a width is given', () => {
      const out = cdnImage('https://x.com/a.jpg', { width: 400 })!;
      expect(out).toContain('w_400');
      expect(out).toContain('c_fill');
    });

    it('leaves data-URIs untouched', () => {
      const data = 'data:image/svg+xml;utf8,<svg/>';
      expect(cdnImage(data)).toBe(data);
    });

    it('does not double-transform existing Cloudinary URLs', () => {
      const cl =
        'https://res.cloudinary.com/demo/image/fetch/f_auto/https%3A%2F%2Fx.com%2Fa.jpg';
      expect(cdnImage(cl)).toBe(cl);
    });

    it('leaves relative / local paths untouched', () => {
      expect(cdnImage('/assets/local.png')).toBe('/assets/local.png');
    });
  });
});
