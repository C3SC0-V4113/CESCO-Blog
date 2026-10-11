import { useSyncExternalStore } from 'react';

const subscribeToNothing = () => () => {};

/** False through server rendering and hydration, true once React owns the DOM. */
export function useHydrated() {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );
}
