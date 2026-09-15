import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { MessageDispatcherService } from './message-dispatcher.service'
import { MessagingConfig } from './messaging.config'
import { sanitiseProviderDetail } from './sanitise'

/**
 * The polling loop that drives the dispatcher.
 *
 * Plain `setTimeout`, not `@nestjs/schedule` and not a cron library: the module
 * is not a dependency of this service today, and one recursive timer is the
 * entire requirement. Adding a scheduling framework to run a single 5-second
 * poll would be infrastructure for its own sake.
 *
 * Self-rescheduling rather than `setInterval`, because `setInterval` will
 * happily start a second tick while the first is still draining a slow batch —
 * two overlapping ticks are safe (the atomic claim makes them safe) but they
 * pile up connections for no benefit. Chaining guarantees one tick at a time
 * per process.
 *
 * DISABLED UNDER TEST. `MESSAGE_WORKER_ENABLED` defaults to false when
 * `NODE_ENV=test`, so a suite never races a background timer against its own
 * assertions; tests call `dispatcher.tick()` explicitly.
 */
@Injectable()
export class DispatchWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DispatchWorkerService.name)
  private timer: NodeJS.Timeout | null = null
  private stopped = false
  private running = false

  constructor(private readonly dispatcher: MessageDispatcherService) {}

  onModuleInit(): void {
    if (!MessagingConfig.workerEnabled) {
      this.logger.log('Dispatch worker disabled (MESSAGE_WORKER_ENABLED)')
      return
    }
    this.logger.log(
      `Dispatch worker started — polling every ${MessagingConfig.pollIntervalMs}ms, ` +
      `batch ${MessagingConfig.batchSize}`,
    )
    this.schedule(0)
  }

  onModuleDestroy(): void {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return
    this.timer = setTimeout(() => { void this.run() }, delayMs)
    // Do not hold the event loop open on this timer alone — otherwise a Nest
    // app that has finished its work (a test, a CLI task) never exits.
    this.timer.unref?.()
  }

  private async run(): Promise<void> {
    if (this.stopped || this.running) return
    this.running = true
    try {
      const r = await this.dispatcher.tick()
      if (r.claimed > 0 || r.requeuedStuck > 0) {
        this.logger.log(
          `tick: claimed=${r.claimed} sent=${r.sent} retried=${r.retried} ` +
          `failed=${r.failed} requeued=${r.requeuedStuck}`,
        )
      }
    } catch (err) {
      // `tick()` already swallows per-message errors; this is the last line of
      // defence so an unexpected throw cannot kill the loop permanently.
      this.logger.error(`Dispatch tick failed: ${sanitiseProviderDetail(err)}`)
    } finally {
      this.running = false
      this.schedule(MessagingConfig.pollIntervalMs)
    }
  }
}
