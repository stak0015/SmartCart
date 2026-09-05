"use client";

import { useEffect, useRef } from "react";
import {
  createPauseableDismissTimer,
  type PauseableDismissTimer,
} from "@/lib/toast-timer";

export interface SuccessToastProps {
  message: string;
  onDismiss: () => void;
  notificationId: number;
  dismissLabel?: string;
}

export function SuccessToast({
  message,
  onDismiss,
  notificationId,
  dismissLabel = "Dismiss notification",
}: SuccessToastProps) {
  const onDismissRef = useRef(onDismiss);
  const isHoveredRef = useRef(false);
  const isFocusedRef = useRef(false);
  const timerRef = useRef<PauseableDismissTimer | null>(null);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    timerRef.current = createPauseableDismissTimer(() => onDismissRef.current());
    if (isHoveredRef.current || isFocusedRef.current) {
      timerRef.current.pause();
    }

    return () => {
      timerRef.current?.clear();
      timerRef.current = null;
    };
  }, [notificationId]);

  const pause = () => {
    timerRef.current?.pause();
  };

  const resumeIfInactive = () => {
    if (!isHoveredRef.current && !isFocusedRef.current) {
      timerRef.current?.resume();
    }
  };

  return (
    <div
      className="fixed bottom-28 right-4 z-50 flex max-w-[min(calc(100vw-2rem),26rem)] items-center gap-3 rounded-xl border border-[#b7e0c6] bg-[#effaf1] px-4 py-3 text-sm font-medium text-[#14532d] shadow-lg lg:bottom-4"
      role="status"
      aria-live="polite"
      onPointerEnter={() => {
        isHoveredRef.current = true;
        pause();
      }}
      onPointerLeave={() => {
        isHoveredRef.current = false;
        resumeIfInactive();
      }}
      onFocus={() => {
        isFocusedRef.current = true;
        pause();
      }}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          isFocusedRef.current = false;
          resumeIfInactive();
        }
      }}
      data-notification-id={notificationId}
    >
      <span className="flex-1" key={notificationId}>{message}</span>
      <button
        type="button"
        className="min-h-11 min-w-11 rounded-md px-1.5 py-1 text-lg leading-none text-[#14532d] hover:bg-[#d7f1dc]"
        aria-label={dismissLabel}
        onClick={onDismiss}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
