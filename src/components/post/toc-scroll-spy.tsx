import { useEffect } from 'react';

import { useScrollSpy } from '@/hooks/use-scroll-spy';

/**
 * Marks the table-of-contents entry for the heading currently being read.
 *
 * An island because it needs `IntersectionObserver` (ADR-0019), hydrated
 * `client:idle` rather than `client:visible`: it renders nothing, so it has no
 * box for a visibility observer to see (see `table-of-contents.astro`).
 *
 * It also closes the mobile outline once a reader picks a heading. That outline
 * is a sticky `<details>`; left open, it sits over the very heading the link
 * just scrolled to.
 *
 * The links work without this. The list is server-rendered and every anchor
 * points at a real block ID, so with JavaScript disabled the reader loses the
 * highlight and keeps the navigation.
 *
 * It sets `aria-current` on the DOM nodes rather than owning the markup,
 * because the list is `.astro` and this only decorates it.
 */

interface Props {
  ids: string[];
}

export default function TocScrollSpy({ ids }: Props) {
  const activeId = useScrollSpy(ids);

  useEffect(() => {
    // Delegated from the document rather than bound per outline: one listener,
    // and it runs before the browser follows the fragment, so the jump lands
    // against the collapsed outline.
    const closeOutline = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const outline = event.target.closest('[data-toc-link]')?.closest('details');
      if (outline) outline.open = false;
    };

    document.addEventListener('click', closeOutline);
    return () => document.removeEventListener('click', closeOutline);
  }, []);

  useEffect(() => {
    for (const id of ids) {
      // `querySelectorAll`, not `querySelector`: the outline is rendered twice —
      // once in the mobile disclosure, once in the desktop sidebar — and only
      // one of them is displayed at a time. Marking the first match alone would
      // highlight whichever copy happens to come first in the document, which is
      // the mobile one, and leave the visible desktop outline untouched.
      for (const link of document.querySelectorAll(`[data-toc-link="${id}"]`)) {
        if (id === activeId) {
          link.setAttribute('aria-current', 'true');
        } else {
          link.removeAttribute('aria-current');
        }
      }
    }
  }, [activeId, ids]);

  return null;
}
