export const SUCCESS_TOAST_DURATION_MS = 5_000;

export interface PauseableDismissTimer {
  pause: () => void;
  resume: () => void;
  clear: () => void;
}

/** Creates a dismiss timer that can be paused without losing elapsed time. */
export function createPauseableDismissTimer(
  onDismiss: () => void,
  durationMs = SUCCESS_TOAST_DURATION_MS,
): PauseableDismissTimer {
  let remainingMs = durationMs;
  let startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active = true;

  const fire = () => {
    timer = null;
    active = false;
    onDismiss();
  };

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    active = false;
  };

  const pause = () => {
    if (!active || timer === null) return;
    remainingMs = Math.max(0, remainingMs - (Date.now() - startedAt));
    clearTimeout(timer);
    timer = null;
  };

  const resume = () => {
    if (!active || timer !== null || remainingMs <= 0) return;
    startedAt = Date.now();
    timer = setTimeout(fire, remainingMs);
  };

  timer = setTimeout(fire, remainingMs);

  return { pause, resume, clear };
}
