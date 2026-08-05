import { useEffect, useState } from 'react';

/**
 * Marks the table-of-contents entry for the heading currently being read.
 *
 * An island because it needs `IntersectionObserver`, hydrated `client:visible`
 * — the table of contents is below the fold on mobile and beside the article on
 * desktop, so there is no reason to spend the bytes before it is on screen
 * (ADR-0019).
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
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const headings = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);

    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // The topmost heading currently intersecting wins. Taking the last
        // entry instead would flip the highlight backwards while scrolling up.
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible[0]) setActiveId(visible[0].target.id);
      },
      // A band across the upper third: a heading counts as "being read" once it
      // reaches the top area, not when it first appears at the bottom.
      { rootMargin: '0px 0px -66% 0px', threshold: 0 }
    );

    for (const heading of headings) observer.observe(heading);

    return () => observer.disconnect();
  }, [ids]);

  useEffect(() => {
    for (const id of ids) {
      const link = document.querySelector(`[data-toc-link="${id}"]`);
      if (!link) continue;

      if (id === activeId) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    }
  }, [activeId, ids]);

  return null;
}
