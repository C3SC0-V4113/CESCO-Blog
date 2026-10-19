import { useCallback, useEffect, useRef, useTransition } from 'react';

export function useAsyncTransition() {
  const [isPending, startTransition] = useTransition();
  const finishPendingAction = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      finishPendingAction.current?.();
    },
    []
  );

  const runTransition = useCallback(
    (action: () => Promise<void>) => {
      startTransition(async () => {
        let finish!: () => void;
        const unmounted = new Promise<void>((resolve) => {
          finish = resolve;
        });
        finishPendingAction.current = finish;
        try {
          await Promise.race([action(), unmounted]);
        } finally {
          finish();
          if (finishPendingAction.current === finish) finishPendingAction.current = null;
        }
      });
    },
    [startTransition]
  );

  return [isPending, runTransition] as const;
}
