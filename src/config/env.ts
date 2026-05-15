const REQUIRED = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'API_URL',
  'FRONTEND_URL',
  'CLIENT_URL',
] as const

export function validateEnv(): void {
  const missing = REQUIRED.filter(key => !process.env[key]?.trim())
  if (missing.length > 0) {
    console.error(`[Startup] Missing required environment variables: ${missing.join(', ')}`)
    process.exit(1)
  }

  const jwtSecret = process.env.JWT_ACCESS_SECRET!
  if (jwtSecret.length < 32) {
    console.error('[Startup] JWT_ACCESS_SECRET must be at least 32 characters')
    process.exit(1)
  }
}
