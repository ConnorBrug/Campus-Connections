'use client';

import { useEffect } from 'react';

/*
 * Safety-net error boundary for failures in the root layout itself
 * (fonts, Toaster, metadata evaluation, etc.). A normal `error.tsx`
 * can't catch those because it's rendered *inside* the root layout.
 * This file replaces the whole document on a root-level crash, so it
 * must include its own <html> and <body>. Keep it dependency-free -
 * if Tailwind classes or shadcn components themselves were the cause,
 * we still want this to render.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/global-error]', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          margin: 0,
          padding: '1rem',
          textAlign: 'center',
          backgroundColor: '#ffffff',
          color: '#111827',
        }}
      >
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Something went wrong
        </h1>
        <p style={{ color: '#6b7280', maxWidth: '28rem', marginBottom: '1rem' }}>
          The app failed to load. Try again, or reload the page.
        </p>
        {error.digest && (
          <p
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.75rem',
              color: '#9ca3af',
              marginBottom: '1.5rem',
            }}
          >
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            background: '#111827',
            color: '#ffffff',
            border: 'none',
            borderRadius: '0.5rem',
            padding: '0.625rem 1.25rem',
            fontSize: '0.95rem',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
