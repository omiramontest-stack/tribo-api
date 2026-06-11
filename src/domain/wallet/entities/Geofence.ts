/** Ventana horaria dentro de un día. days usa convención JS: 0=Dom, 1=Lun … 6=Sáb. */
export interface GeofenceWindow {
  days: number[]
  /** Hora de inicio en formato "HH:mm" 24h. */
  startTime: string
  /** Hora de fin en formato "HH:mm" 24h. Debe ser mayor que startTime. */
  endTime: string
}

export interface Geofence {
  id: string
  walletId: string
  label: string
  latitude: number
  longitude: number
  /** Metros. Apple Wallet usa ~100 m como mínimo efectivo. */
  radiusMeters: number
  message: string
  /** Toggle manual. Si es false, la geofence nunca es activa independientemente del horario. */
  isActive: boolean
  scheduleEnabled: boolean
  /** Ventanas horarias en las que la geofence debe estar activa. Vacío = todo el día. */
  schedule: GeofenceWindow[]
  /** IANA timezone, e.g. "America/Mexico_City". */
  timezone: string
  createdAt: string
  updatedAt: string
}
