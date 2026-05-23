/**
 * Timezone-aware date utilities for analytics.
 *
 * All Date operations in Node.js default to UTC unless the TZ environment
 * variable is set.  We set TZ=America/Mexico_City in .env (loaded at the
 * very top of server.ts via `import 'dotenv/config'`), so after startup:
 *
 *   - date.getHours()       → local hour          ✅
 *   - date.getDay()         → local weekday        ✅
 *   - date.toLocaleDateString('en-CA') → YYYY-MM-DD in local tz  ✅
 *   - date.toISOString()    → always UTC (correct for DB storage) ✅
 *
 * If you ever need to support multiple tenant timezones, replace
 * toLocaleDateString('en-CA') with the Intl.DateTimeFormat variant below.
 */

/** Returns a YYYY-MM-DD string in the server's local timezone (set via TZ env). */
export function localDateKey(date: Date): string {
  // 'en-CA' locale formats as YYYY-MM-DD, which is what we use as map keys.
  return date.toLocaleDateString('en-CA')
}

/** Returns a YYYY-MM-DD string for "today minus n days" in local timezone. */
export function localDateKeyNDaysAgo(n: number): string {
  return localDateKey(new Date(Date.now() - n * 86_400_000))
}
