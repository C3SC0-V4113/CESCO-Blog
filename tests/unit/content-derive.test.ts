import { describe, expect, it } from 'vitest';

import { deriveReadingTime, deriveToc } from '@/lib/content/derive';
import { parseContentDoc } from '@/lib/content/schema';

/**
 * Both values are persisted on `post_revisions` rather than recomputed per
 * request (ADR-0012). The seed script and the future admin share this module so
 * the two publish paths cannot produce inconsistent derived data (ADR-0017).
 */

function paragraph(blockId: string, text: string) {
  return { type: 'paragraph', attrs: { blockId }, content: [{ type: 'text', text }] };
}

function heading(blockId: string, level: number, text: string) {
  return { type: 'heading', attrs: { blockId, level }, content: [{ type: 'text', text }] };
}

function doc(...content: unknown[]) {
  return parseContentDoc({ type: 'doc', content });
}

describe('deriveReadingTime', () => {
  it('reports one minute for an empty document', () => {
    // Zero would render as "0 min de lectura", which reads as an error.
    expect(deriveReadingTime(doc())).toBe(1);
  });

  it('rounds a partial minute up', () => {
    expect(deriveReadingTime(doc(paragraph('a', 'palabra '.repeat(10))))).toBe(1);
  });

  it('scales with word count', () => {
    // 600 words at the documented 200 wpm.
    expect(deriveReadingTime(doc(paragraph('a', 'palabra '.repeat(600))))).toBe(3);
  });

  it('counts text across every block', () => {
    const single = deriveReadingTime(doc(paragraph('a', 'palabra '.repeat(400))));
    const split = deriveReadingTime(
      doc(paragraph('a', 'palabra '.repeat(200)), paragraph('b', 'palabra '.repeat(200)))
    );

    expect(split).toBe(single);
  });

  it('counts code as text rather than skipping it', () => {
    const withCode = doc({
      type: 'codeBlock',
      attrs: { blockId: 'c', language: 'ts' },
      content: [{ type: 'text', text: 'const a = 1; '.repeat(200) }],
    });

    expect(deriveReadingTime(withCode)).toBeGreaterThan(1);
  });
});

describe('deriveToc', () => {
  it('is empty for a document with no headings', () => {
    expect(deriveToc(doc(paragraph('a', 'Sin títulos.')))).toEqual([]);
  });

  it('takes anchors from the block id, never from the heading text', () => {
    const [entry] = deriveToc(doc(heading('block-42', 2, 'El combate')));

    expect(entry).toEqual({ id: 'block-42', level: 2, text: 'El combate' });
  });

  it('keeps anchors stable when a heading is reworded', () => {
    // The whole point of ADR-0012: rewording a heading must not break deep
    // links or the table of contents. Text-derived anchors would change here.
    const before = deriveToc(doc(heading('block-42', 2, 'El combate')));
    const after = deriveToc(doc(heading('block-42', 2, 'El sistema de combate')));

    expect(after[0]?.id).toBe(before[0]?.id);
    expect(after[0]?.text).not.toBe(before[0]?.text);
  });

  it('ignores non-heading blocks', () => {
    const entries = deriveToc(
      doc(paragraph('p', 'Intro.'), heading('h', 2, 'Uno'), paragraph('p2', 'Cuerpo.'))
    );

    expect(entries).toEqual([{ id: 'h', level: 2, text: 'Uno' }]);
  });

  it('preserves document order and level', () => {
    const entries = deriveToc(
      doc(heading('a', 2, 'Uno'), heading('b', 3, 'Uno punto uno'), heading('c', 2, 'Dos'))
    );

    expect(entries).toEqual([
      { id: 'a', level: 2, text: 'Uno' },
      { id: 'b', level: 3, text: 'Uno punto uno' },
      { id: 'c', level: 2, text: 'Dos' },
    ]);
  });

  it('joins a heading split across several text nodes', () => {
    const entries = deriveToc(
      doc({
        type: 'heading',
        attrs: { blockId: 'h', level: 2 },
        content: [
          { type: 'text', text: 'El ' },
          { type: 'text', text: 'combate' },
        ],
      })
    );

    expect(entries[0]?.text).toBe('El combate');
  });
});
