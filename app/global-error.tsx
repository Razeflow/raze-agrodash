"use client";

/**
 * Root-level error boundary. Catches errors that escape app/error.tsx — i.e.
 * errors thrown inside the root layout, Providers tree, or before the
 * segment-level boundary mounts. Replaces the root layout when active, so
 * it must define its own <html> and <body>.
 *
 * Per Next 16 docs, metadata/generateMetadata exports are NOT supported here
 * because this file must be a Client Component. Use the <title> element.
 *
 * Pairs with app/error.tsx (segment-level fallback).
 */

import { useEffect } from "react";
import { reportError } from "@/lib/error-log";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[app/global-error] root-layout error", error);
    void reportError(error, {
      context: {
        source: "error-boundary",
        scope: "root-layout",
        digest: error.digest ?? null,
      },
    });
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Something went wrong — Raze AgroDash</title>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F0F4F8",
          color: "#0f172a",
          fontFamily:
            'DM Sans, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          padding: "24px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 440,
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 24,
            padding: 32,
            boxShadow:
              "0 20px 25px -5px rgba(148, 163, 184, 0.10), 0 8px 10px -6px rgba(148, 163, 184, 0.10)",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              background: "#fee2e2",
              color: "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              marginBottom: 20,
            }}
            aria-hidden
          >
            !
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
            The app failed to load
          </h2>
          <p
            style={{
              marginTop: 8,
              fontSize: 14,
              lineHeight: 1.6,
              color: "#475569",
            }}
          >
            A serious error prevented the dashboard from starting. The failure
            has been recorded. Try again, or reload the page.
          </p>
          {error.digest ? (
            <p
              style={{
                marginTop: 12,
                fontFamily: '"Space Mono", monospace',
                fontSize: 12,
                color: "#94a3b8",
              }}
            >
              ref: <span style={{ userSelect: "all" }}>{error.digest}</span>
            </p>
          ) : null}
          <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => unstable_retry()}
              style={{
                padding: "10px 16px",
                borderRadius: 16,
                background: "#0f172a",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") window.location.reload();
              }}
              style={{
                padding: "10px 16px",
                borderRadius: 16,
                background: "#ffffff",
                color: "#334155",
                fontSize: 14,
                fontWeight: 500,
                border: "1px solid #e2e8f0",
                cursor: "pointer",
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
