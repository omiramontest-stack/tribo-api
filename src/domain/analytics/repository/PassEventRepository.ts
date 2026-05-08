import type { PassEvent } from '../entities/PassEvent.js'

export interface PassEventRepository {
  save(event: PassEvent): Promise<void>
}
