import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';

let currentError: Error | null = null;
let forceUpdate: () => void;

function showError(error: Error) {
  currentError = error;
  console.error('[KSAS ErrorBoundary]', error);
  if (forceUpdate) forceUpdate();
}

function clearError() {
  currentError = null;
  if (forceUpdate) forceUpdate();
}

function ErrorUI() {
  const [, setTick] = React.useState(0);
  forceUpdate = () => setTick(t => t + 1);

  if (!currentError) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base, #0D0506)',
        padding: '32px',
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: '420px',
          width: '100%',
          textAlign: 'center',
          background: 'var(--bg-surface, #1A0F11)',
          border: '1px solid var(--bg-border, #2A1A1E)',
          borderRadius: '20px',
          padding: '48px 36px',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'var(--danger-bg, rgba(220,38,38,0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
          }}
        >
          <AlertTriangle style={{ width: '28px', height: '28px', color: 'var(--danger, #DC2626)' }} />
        </div>

        <h2
          style={{
            fontFamily: "'Gloock', serif",
            fontSize: '22px',
            color: 'var(--text-primary, #F5F0F0)',
            marginBottom: '8px',
            letterSpacing: '-0.01em',
          }}
        >
          Something went wrong
        </h2>

        <p
          style={{
            fontSize: '14px',
            fontWeight: 300,
            color: 'var(--text-secondary, #9A7A82)',
            marginBottom: '8px',
            lineHeight: 1.5,
          }}
        >
          An unexpected error occurred. Please try again.
        </p>

        <p
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--text-tertiary, #6B4A50)',
            marginBottom: '28px',
            padding: '12px',
            background: 'var(--bg-elevated, #120A0C)',
            borderRadius: '8px',
            wordBreak: 'break-all',
            lineHeight: 1.4,
            maxHeight: '120px',
            overflow: 'auto',
          }}
        >
          {currentError.message || String(currentError)}
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={() => { clearError(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              borderRadius: '12px',
              border: '1px solid var(--bg-border, #2A1A1E)',
              background: 'var(--bg-elevated, #120A0C)',
              color: 'var(--text-primary, #F5F0F0)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            <RefreshCw style={{ width: '14px', height: '14px' }} />
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              border: 'none',
              background: 'var(--kabu-maroon, #7B1A2B)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ErrorUI />
      <React.Fragment>{children}</React.Fragment>
    </>
  );
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> {
  return function WrappedWithErrorBoundary(props: P) {
    const [error, setError] = React.useState<Error | null>(null);

    if (error) {
      return createPortal(
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-base, #0D0506)',
            padding: '32px',
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: '420px',
              width: '100%',
              textAlign: 'center',
              background: 'var(--bg-surface, #1A0F11)',
              border: '1px solid var(--bg-border, #2A1A1E)',
              borderRadius: '20px',
              padding: '48px 36px',
            }}
          >
            <AlertTriangle style={{ width: '28px', height: '28px', color: 'var(--danger, #DC2626)', margin: '0 auto 24px' }} />
            <h2 style={{ fontFamily: "'Gloock', serif", fontSize: '22px', color: 'var(--text-primary, #F5F0F0)', marginBottom: '8px' }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: '14px', fontWeight: 300, color: 'var(--text-secondary, #9A7A82)', marginBottom: '20px', lineHeight: 1.5 }}>
              {error.message || 'An unexpected error occurred.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => setError(null)} style={{ padding: '12px 24px', borderRadius: '12px', border: '1px solid var(--bg-border, #2A1A1E)', background: 'var(--bg-elevated, #120A0C)', color: 'var(--text-primary, #F5F0F0)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
                Try Again
              </button>
              <button onClick={() => window.location.reload()} style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', background: 'var(--kabu-maroon, #7B1A2B)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
                Reload Page
              </button>
            </div>
          </div>
        </div>,
        document.body
      );
    }

    return <Component {...props} />;
  };
}
