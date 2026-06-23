/**
 * Minimal structured logger.
 *
 * Emits single-line JSON so Vercel / Cloud logging can parse and index the
 * fields (level, event, context) instead of opaque `console.error` strings.
 * This is the in-house baseline for observability; for production alerting,
 * wire an error-tracking SDK (e.g. Sentry) into `logError` as well.
 */

type Context = Record<string, unknown>;

function emit(level: 'info' | 'warn' | 'error', event: string, context?: Context, err?: unknown) {
  const payload: Record<string, unknown> = {
    level,
    event,
    ts: new Date().toISOString(),
    ...(context ?? {}),
  };
  if (err !== undefined) {
    payload.error =
      err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err);
  }
  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, context?: Context) => emit('info', event, context),
  warn: (event: string, context?: Context) => emit('warn', event, context),
  error: (event: string, err?: unknown, context?: Context) => emit('error', event, context, err),
};
