/**
 * Request context propagation via AsyncLocalStorage.
 *
 * Usage:
 *   - In the Fastify hook: `requestContext.run({ traceId }, () => next())`
 *   - Anywhere in the call-stack: `getTraceId()` returns the current request's trace ID
 *   - In pino child loggers: `logger.child({ traceId: getTraceId() })`
 *
 * This avoids threading `traceId` through every function signature while
 * keeping it available for structured logging and error reporting.
 */
import { AsyncLocalStorage } from 'async_hooks'

interface RequestContext {
  traceId: string
}

const _store = new AsyncLocalStorage<RequestContext>()

/** Runs `fn` with a bound request context (call once per request in the Fastify hook). */
export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return _store.run(ctx, fn)
}

/** Returns the trace ID for the current async context, or undefined outside a request. */
export function getTraceId(): string | undefined {
  return _store.getStore()?.traceId
}
