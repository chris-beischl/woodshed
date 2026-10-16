import { useCallback, useEffect, useRef } from "react";
import { useInput } from "../input/store";

/** Long enough to see the green stamp, short enough to keep the flow. */
export const RAPID_FIRE_DELAY_MS = 700;

/**
 * Wraps an exercise's submit so it runs at most once per round. In rapid-fire mode it
 * also fires on its own once `clean` (solved without mistakes); anything else waits
 * for "Next" so the answer can be studied.
 */
export function useAdvance(clean: boolean, submit: () => void): () => void {
  const rapidFire = useInput((s) => s.rapidFire);
  const latest = useRef(submit);
  const sent = useRef(false);
  useEffect(() => {
    latest.current = submit;
  });
  const go = useCallback(() => {
    if (sent.current) return;
    sent.current = true;
    latest.current();
  }, []);
  useEffect(() => {
    if (!rapidFire || !clean) return;
    const id = setTimeout(go, RAPID_FIRE_DELAY_MS);
    return () => clearTimeout(id);
  }, [rapidFire, clean, go]);
  return go;
}
