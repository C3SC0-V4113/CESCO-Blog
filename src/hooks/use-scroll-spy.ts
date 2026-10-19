import { useEffect, useState } from 'react';

type Options = {
  rootMargin?: string;
  threshold?: number;
};

export function useScrollSpy(ids: string[], options: Options = {}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const { rootMargin = '0px 0px -66% 0px', threshold = 0 } = options;

  useEffect(() => {
    const headings = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);

    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // The topmost heading currently intersecting wins, including when
        // scrolling upward through multiple visible headings.
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin, threshold }
    );

    for (const heading of headings) observer.observe(heading);

    return () => observer.disconnect();
  }, [ids, rootMargin, threshold]);

  return activeId;
}
