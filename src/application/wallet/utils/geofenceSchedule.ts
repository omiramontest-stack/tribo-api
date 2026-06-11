import type { Geofence, GeofenceWindow } from '../../../domain/wallet/entities/Geofence.js'

/** Retorna true si la geofence debe incluirse en el pase en el momento dado. */
export function isGeofenceCurrentlyActive(geofence: Geofence, now: Date = new Date()): boolean {
  if (!geofence.isActive) return false
  if (!geofence.scheduleEnabled || geofence.schedule.length === 0) return true
  return isWithinSchedule(geofence.schedule, geofence.timezone, now)
}

export function isWithinSchedule(windows: GeofenceWindow[], timezone: string, now: Date): boolean {
  const { day, minutes } = getLocalDayAndMinutes(now, timezone)
  return windows.some(w =>
    w.days.includes(day) &&
    minutes >= timeToMinutes(w.startTime) &&
    minutes < timeToMinutes(w.endTime),
  )
}

function getLocalDayAndMinutes(date: Date, timezone: string): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? 'Sun'
  const hour    = parseInt(parts.find(p => p.type === 'hour')?.value   ?? '0', 10)
  const minute  = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10)

  return { day: WEEKDAY[weekday] ?? 0, minutes: hour * 60 + minute }
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}
