/**
 * Lightweight logger that respects __DEV__ so the production bundle does
 * not ship dozens of stray `console.*` calls. Use this in place of
 * `console.log/warn/error` everywhere that is not in `__tests__`.
 *
 * Why a custom wrapper instead of `babel-plugin-transform-remove-console`?
 *   - Some statements must still reach Sentry / the browser console in
 *     production (uncaught errors, push-notification fallbacks). Stripping
 *     them blindly silences forensics.
 *   - Sentry's React SDK already routes `console.error` to its breadcrumbs
 *     pipeline; we just need to make sure debug noise does not flood it.
 *
 * Levels:
 *   - debug / info — only on __DEV__
 *   - warn — always (lightweight; reach Sentry as breadcrumbs)
 *   - error — always; in production Sentry's `captureException` should be
 *     preferred for things we want as alerts, but `logger.error` is the
 *     safe default when the call site already has a serialised error
 *     payload.
 *
 * To override the default for a specific call site, use the explicit
 * `logger.production.info(...)` namespace — it bypasses the __DEV__ gate.
 */

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

function noop(..._args: unknown[]): void {}

type Method = (...args: unknown[]) => void;

interface Logger {
  debug: Method;
  info: Method;
  warn: Method;
  error: Method;
  production: {
    debug: Method;
    info: Method;
    warn: Method;
    error: Method;
  };
}

// eslint-disable-next-line no-console
const native = console;

export const logger: Logger = {
  debug: isDev ? native.log.bind(native) : noop,
  info: isDev ? native.log.bind(native) : noop,
  warn: native.warn.bind(native),
  error: native.error.bind(native),
  production: {
    debug: native.log.bind(native),
    info: native.log.bind(native),
    warn: native.warn.bind(native),
    error: native.error.bind(native),
  },
};

export default logger;
