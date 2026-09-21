import { useCallback, useEffect, useRef } from "react";

type Pending = { timer: ReturnType<typeof setTimeout>; run: () => void };

/**
 * Debounces saves per key (e.g. "essay:<lessonId>") so typing into a text
 * field produces one request after the user pauses, not one per keystroke.
 * Pending saves are flushed on blur (via flush), on unmount and on page hide.
 */
export function useDebouncedSave(delay = 600) {
  const pending = useRef(new Map<string, Pending>());

  const flush = useCallback((key?: string) => {
    const keys = key ? [key] : [...pending.current.keys()];
    for (const k of keys) {
      const p = pending.current.get(k);
      if (!p) continue;
      clearTimeout(p.timer);
      pending.current.delete(k);
      p.run();
    }
  }, []);

  const schedule = useCallback(
    (key: string, run: () => void) => {
      const existing = pending.current.get(key);
      if (existing) clearTimeout(existing.timer);
      const timer = setTimeout(() => {
        pending.current.delete(key);
        run();
      }, delay);
      pending.current.set(key, { timer, run });
    },
    [delay]
  );

  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      flush();
    };
  }, [flush]);

  return { schedule, flush };
}
