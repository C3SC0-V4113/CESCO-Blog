import { useSyncExternalStore } from 'react';

// At 80rem the shell leaves 608px beside the panel: 544px of reading measure plus canvas chrome.
const wideEditorQuery = '(min-width: 80rem)';
const subscribeWideEditor = (callback: () => void) => {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const media = window.matchMedia(wideEditorQuery);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
const getWideEditorSnapshot = () =>
  typeof window.matchMedia === 'function' && window.matchMedia(wideEditorQuery).matches;
const getWideEditorServerSnapshot = () => false;

export function useWideEditor() {
  return useSyncExternalStore(
    subscribeWideEditor,
    getWideEditorSnapshot,
    getWideEditorServerSnapshot
  );
}
