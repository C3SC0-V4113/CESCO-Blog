import { describe, expect, it } from 'vitest';

import { parseDraftContent } from '@/lib/drafts';

const paragraph = (content: unknown[]) => ({
  type: 'doc',
  content: [{ type: 'paragraph', attrs: { blockId: 'p1' }, content }],
});

describe('draft content', () => {
  it('accepts a document the draft contract allows', () => {
    expect(parseDraftContent(paragraph([{ type: 'text', text: 'Hola' }]))).toEqual({
      success: true,
      data: paragraph([{ type: 'text', text: 'Hola' }]),
    });
  });

  it('rejects what the server rejects, even when the base document is valid', () => {
    const heading = {
      type: 'doc',
      content: [{ type: 'heading', attrs: { blockId: 'h1', level: 1 }, content: [] }],
    };
    expect(parseDraftContent(heading)).toEqual({ success: false, issues: ['doc: custom'] });
  });

  it('describes issues by path and code without echoing the text', () => {
    const result = parseDraftContent(
      paragraph([{ type: 'text', text: 'Confidential wording', marks: [{ type: 'bold' }] }])
    );
    expect(result).toEqual({
      success: false,
      issues: ['doc.content.0.content.0: unrecognized_keys'],
    });
    expect(JSON.stringify(result)).not.toContain('Confidential');
  });
});
