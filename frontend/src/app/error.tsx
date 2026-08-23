"use client";

import { RefreshCcw } from "lucide-react";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="empty-page" role="alert">
      <p className="eyebrow">Something went wrong</p>
      <h1>SmartCart could not load this step.</h1>
      <p>Your basket has not been intentionally cleared. Try loading this step again.</p>
      <button className="button button--primary" type="button" onClick={reset}>
        <RefreshCcw size={17} aria-hidden="true" /> Try again
      </button>
    </section>
  );
}
