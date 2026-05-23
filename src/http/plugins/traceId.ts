/**
 * Fastify plugin: injects a trace ID into every request.
 *
 * - Reads `x-trace-id` header if present (allows propagation from upstream gateways)
 * - Otherwise generates a new UUID v4 trace ID
 * - Stores the trace ID in AsyncLocalStorage so it's accessible anywhere
 *   in the async call-stack without threading it through function signatures
 * - Attaches it to the Fastify request logger as a child binding
 * - Returns it in the `x-trace-id` response header for client/debug use
 */
import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { runWithContext } from '../../infrastructure/trace/requestContext.js'

export default async function traceIdPlugin(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', (request, reply, done) => {
    const traceId = (request.headers['x-trace-id'] as string | undefined) ?? randomUUID()

    // Bind the trace ID to the Fastify pino logger for this request
    request.log = request.log.child({ traceId })

    // Set it in the response header so the caller can correlate
    void reply.header('x-trace-id', traceId)

    // Run the rest of the request lifecycle inside the AsyncLocalStorage context
    runWithContext({ traceId }, done)
  })
}
