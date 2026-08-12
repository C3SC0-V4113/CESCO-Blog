/**
 * Generated editorial covers (ADR-0015, ADR-0006).
 *
 * ADR-0015 defines the editorial image as "clean photo or screenshot, **no
 * text**", and that constraint is what makes these cheap: with no text there is
 * no font, and with no font there is no Satori and none of the static `.ttf`
 * builds that ADR warned would be needed. An SVG string and a rasteriser are
 * the whole pipeline.
 *
 * They are **placeholders with intent**, not art. A real screenshot of the game
 * being discussed beats any of this, and the day covers can be uploaded these
 * stop being generated. Until then a listing of twenty identical grey boxes is
 * worse than a listing of twenty distinguishable ones: a reader recognises a
 * post they have already seen by its shape long before they re-read its title.
 *
 * Pure and deterministic (ADR-0031). The same slug always produces the same
 * image, which is what lets the generator skip work it has already done and
 * what makes the output reviewable in a diff rather than a surprise per run.
 *
 * The section is declared here rather than imported from `db/queries`, and that
 * is deliberate: `scripts/seed.ts` imports this module, so pulling the query
 * layer in through it would drag D1 and Drizzle into the type graph of a plain
 * Node script. A picture generator has no business knowing how posts are
 * fetched — it needs two words, and it can hold them itself.
 */

/** The two sections, held locally so this module depends on nothing. */
export type CoverSection = 'analysis' | 'opinion';

/** 1.91:1, the ratio link previews crop to. Sized once so covers and cards agree. */
export const COVER_WIDTH = 1200;
export const COVER_HEIGHT = 628;

/**
 * A stable 32-bit hash of a string.
 *
 * FNV-1a: small, well distributed for short inputs, and — the property that
 * matters here — identical in every runtime, so a cover generated on a laptop
 * matches one generated in CI.
 */
export function hashSeed(seed: string): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    // The FNV prime, applied with shifts so the result stays a 32-bit integer
    // rather than losing precision through `Math.imul`-free multiplication.
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

/**
 * Hue for a cover, anchored to its section.
 *
 * Analysis and opinion occupy separate arcs of the wheel, so the two sections
 * stay tellable apart at a glance in a mixed listing while no two posts inside
 * one section look alike. The section is a fact about the post; the offset
 * within the arc is the only part the hash decides.
 */
export function coverHue(seed: string, section: CoverSection): number {
  const base = section === 'analysis' ? 170 : 25;

  return (base + (hashSeed(seed) % 60)) % 360;
}

/**
 * The cover itself, as an SVG document.
 *
 * Three overlapping shapes over a gradient. Deliberately restrained: this sits
 * beside a serif headline in a sober editorial layout, and a busy placeholder
 * would fight the thing it is supposed to introduce.
 *
 * Coordinates come from the hash rather than from a random source, so the file
 * is a function of the slug and nothing else.
 */
export function coverSvg(seed: string, section: CoverSection): string {
  const hash = hashSeed(seed);
  const hue = coverHue(seed, section);

  // Independent draws from the same hash, taken from different bit ranges so
  // the shapes do not move together.
  //
  // Every range is bounded to the 100×52 viewBox. The first version let a
  // centre reach y=64 on a canvas 52 tall, which a test caught: the circle
  // still rendered, just entirely off the bottom edge, so the cover quietly
  // lost a shape rather than failing.
  const x1 = 12 + (hash % 25);
  const y1 = 8 + ((hash >>> 5) % 34);
  const r1 = 22 + ((hash >>> 10) % 14);
  const x2 = 55 + ((hash >>> 15) % 30);
  const y2 = 10 + ((hash >>> 20) % 32);
  const r2 = 14 + ((hash >>> 25) % 12);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_WIDTH}" height="${COVER_HEIGHT}" viewBox="0 0 100 52">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 32% 17%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 40) % 360} 38% 9%)"/>
    </linearGradient>
  </defs>
  <rect width="100" height="52" fill="url(#bg)"/>
  <circle cx="${x1}" cy="${y1}" r="${r1}" fill="hsl(${hue} 45% 55%)" opacity="0.16"/>
  <circle cx="${x2}" cy="${y2}" r="${r2}" fill="hsl(${(hue + 25) % 360} 55% 65%)" opacity="0.2"/>
  <rect x="0" y="${44 + (hash % 5)}" width="100" height="8" fill="hsl(${hue} 50% 60%)" opacity="0.12"/>
</svg>`;
}
