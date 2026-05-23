import type { ProcessCampaignsUseCase } from '../../../application/campaign/useCases/ProcessCampaignsUseCase.js'
import { logger } from '../../logger/logger.js'

export interface IWorker {
  start(): void
  stop(): void
}

export class CampaignWorker implements IWorker {
  private _timer: ReturnType<typeof setInterval> | null = null
  private _running = false

  constructor(
    private readonly _processUseCase: ProcessCampaignsUseCase,
    private readonly _intervalMs: number = 60_000,
  ) {}

  start(): void {
    if (this._timer) return
    this._timer = setInterval(() => { void this._tick() }, this._intervalMs)
    logger.info({ intervalMs: this._intervalMs }, '[CampaignWorker] started')
  }

  stop(): void {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
      logger.info('[CampaignWorker] stopped')
    }
  }

  private async _tick(): Promise<void> {
    if (this._running) return
    this._running = true
    try {
      await this._processUseCase.run()
    } catch (err) {
      logger.error({ err }, '[CampaignWorker] error during tick')
    } finally {
      this._running = false
    }
  }
}
