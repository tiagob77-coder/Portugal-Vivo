/**
 * Sentry Browser SDK initialization and Error Boundary for React/Expo.
 *
 * Configure via the EXPO_PUBLIC_SENTRY_DSN environment variable.
 */
import * as Sentry from "@sentry/react";
import React from "react";

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";
const ENVIRONMENT = process.env.EXPO_PUBLIC_ENVIRONMENT ?? "development";
const APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION ?? "0.0.0";

let _initialized = false;

/**
 * Initialize Sentry for the browser / React-Native web target.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function initMonitoring(): void {
  if (_initialized || !SENTRY_DSN) {
    if (!SENTRY_DSN) {
      console.log(
        "[monitoring] EXPO_PUBLIC_SENTRY_DSN not set — Sentry disabled"
      );
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: `patrimonio-frontend@${APP_VERSION}`,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    // Performance monitoring
    tracesSampleRate: ENVIRONMENT === "production" ? 0.1 : 1.0,
    // Session replay (only in production)
    replaysSessionSampleRate: ENVIRONMENT === "production" ? 0.1 : 0,
    replaysOnErrorSampleRate: 1.0,
  });

  Sentry.setTag("service", "patrimonio-frontend");
  Sentry.setTag("version", APP_VERSION);

  _initialized = true;
  console.log(
    `[monitoring] Sentry initialized (env=${ENVIRONMENT}, version=${APP_VERSION})`
  );
}

// ---------------------------------------------------------------------------
// Error Boundary
// ---------------------------------------------------------------------------

const DefaultFallback: React.FC<{
  error: unknown;
  resetError: () => void;
}> = ({ error, resetError }) =>
  React.createElement(
    "div",
    {
      style: {
        padding: 24,
        textAlign: "center" as const,
        fontFamily: "system-ui, sans-serif",
      },
    },
    React.createElement("h2", null, "Algo correu mal"),
    React.createElement(
      "p",
      { style: { color: "#666" } },
      error instanceof Error ? error.message : "Erro inesperado"
    ),
    React.createElement(
      "button",
      {
        onClick: resetError,
        style: {
          marginTop: 16,
          padding: "8px 24px",
          borderRadius: 6,
          border: "none",
          background: "#0066cc",
          color: "#fff",
          cursor: "pointer",
          fontSize: 14,
        },
      },
      "Tentar novamente"
    )
  );

/**
 * Sentry-powered Error Boundary.
 *
 * Usage:
 * ```tsx
 * import { ErrorBoundary } from "@/utils/monitoring";
 *
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export const ErrorBoundary = Sentry.withErrorBoundary(
  // Wrap children in a passthrough component so withErrorBoundary has something to wrap
  ((props: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, props.children)) as React.FC<{
    children?: React.ReactNode;
  }>,
  {
    fallback: ({ error, resetError }) =>
      React.createElement(DefaultFallback, { error, resetError }),
  }
);

// ---------------------------------------------------------------------------
// Manual capture helpers
// ---------------------------------------------------------------------------

/** Capture an exception manually. */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/** Capture a message manually. */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "info"
): void {
  Sentry.captureMessage(message, level);
}
