import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPauseableDismissTimer,
  SUCCESS_TOAST_DURATION_MS,
} from "./toast-timer";

afterEach(() => vi.useRealTimers());

describe("createPauseableDismissTimer", () => {
  it("pauses elapsed time and resumes with the remaining duration", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const timer = createPauseableDismissTimer(onDismiss);

    vi.advanceTimersByTime(2_000);
    timer.pause();
    vi.advanceTimersByTime(SUCCESS_TOAST_DURATION_MS);
    expect(onDismiss).not.toHaveBeenCalled();

    timer.resume();
    vi.advanceTimersByTime(SUCCESS_TOAST_DURATION_MS - 2_001);
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("keeps a paused timer paused through repeated pause calls", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const timer = createPauseableDismissTimer(onDismiss, 1_000);

    vi.advanceTimersByTime(250);
    timer.pause();
    timer.pause();
    vi.advanceTimersByTime(2_000);
    expect(onDismiss).not.toHaveBeenCalled();

    timer.resume();
    vi.advanceTimersByTime(749);
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("can be cleared while paused and does not restart afterward", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const timer = createPauseableDismissTimer(onDismiss, 1_000);

    timer.pause();
    timer.clear();
    timer.resume();
    vi.advanceTimersByTime(2_000);

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
