import { describe, expect, it } from 'vitest';

import { COVER_HEIGHT, COVER_WIDTH, coverHue, coverSvg, hashSeed } from '@/lib/cover';

/**
 * Generated covers.
 *
 * The properties worth pinning are determinism and distinguishability — the two
 * things that decide whether these are useful placeholders or noise. Nothing
 * here asserts that the result is *pretty*, because a test cannot.
 */

describe('hashSeed', () => {
  it('returns the same number for the same input', () => {
    // The whole pipeline rests on this: a cover is a function of the slug, so
    // regenerating never produces a different image for a post that did not
    // change.
    expect(hashSeed('el-peso-del-silencio')).toBe(hashSeed('el-peso-del-silencio'));
  });

  it('separates inputs that differ by one character', () => {
    expect(hashSeed('relleno-01')).not.toBe(hashSeed('relleno-02'));
  });

  it('stays inside 32 unsigned bits', () => {
    // Overflowing to a negative or a float would make the modulo arithmetic
    // downstream produce out-of-range coordinates rather than fail loudly.
    for (const seed of ['', 'a', 'un-slug-considerablemente-mas-largo-que-los-demas']) {
      const hash = hashSeed(seed);

      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xff_ff_ff_ff);
    }
  });
});

describe('coverHue', () => {
  it('keeps the two sections in separate arcs', () => {
    // A mixed listing should read as two kinds of thing. Sampled across many
    // slugs rather than one, because a single pair proving it is a coincidence.
    for (let index = 0; index < 50; index += 1) {
      const analysis = coverHue(`post-${index}`, 'analysis');
      const opinion = coverHue(`post-${index}`, 'opinion');

      expect(analysis).toBeGreaterThanOrEqual(170);
      expect(analysis).toBeLessThan(230);
      expect(opinion).toBeGreaterThanOrEqual(25);
      expect(opinion).toBeLessThan(85);
    }
  });

  it('varies within a section', () => {
    // Otherwise every analysis cover is the same picture, which is the problem
    // these exist to solve.
    const hues = new Set(
      Array.from({ length: 20 }, (_, index) => coverHue(`relleno-${index}`, 'analysis'))
    );

    expect(hues.size).toBeGreaterThan(5);
  });
});

describe('coverSvg', () => {
  it('is stable for a given post', () => {
    expect(coverSvg('el-peso-del-silencio', 'analysis')).toBe(
      coverSvg('el-peso-del-silencio', 'analysis')
    );
  });

  it('differs between posts and between sections', () => {
    expect(coverSvg('uno', 'analysis')).not.toBe(coverSvg('dos', 'analysis'));
    expect(coverSvg('uno', 'analysis')).not.toBe(coverSvg('uno', 'opinion'));
  });

  it('declares the ratio link previews crop to', () => {
    const svg = coverSvg('cualquiera', 'opinion');

    expect(svg).toContain(`width="${COVER_WIDTH}"`);
    expect(svg).toContain(`height="${COVER_HEIGHT}"`);
    expect(COVER_WIDTH / COVER_HEIGHT).toBeCloseTo(1.91, 1);
  });

  it('carries no text, which is what keeps it fontless', () => {
    // ADR-0015 defines the editorial image as carrying no text, and that
    // constraint is load-bearing rather than cosmetic: a `<text>` element here
    // would need a font, and a font would need Satori and static `.ttf` builds.
    const svg = coverSvg('cualquiera', 'analysis');

    expect(svg).not.toContain('<text');
    expect(svg).not.toContain('font');
  });

  it('keeps every shape inside the frame', () => {
    // The coordinates come from modulo arithmetic on a hash, so an off-by-one
    // in a range shows up as a circle centred outside the canvas rather than as
    // an error.
    for (let index = 0; index < 200; index += 1) {
      const svg = coverSvg(`slug-${index}`, index % 2 === 0 ? 'analysis' : 'opinion');
      const centres = [...svg.matchAll(/c([xy])="(\d+)"/g)];

      expect(centres.length).toBeGreaterThan(0);

      for (const [, axis, value] of centres) {
        expect(Number(value)).toBeGreaterThanOrEqual(0);
        expect(Number(value)).toBeLessThanOrEqual(axis === 'x' ? 100 : 52);
      }
    }
  });
});
