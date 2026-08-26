/**
 * Dispatcher configuration.
 *
 * Everything here is read from the environment ONCE per process, through
 * helpers that fail safe: an unparseable or out-of-range value falls back to
 * the default rather than producing `NaN`, which in a backoff calculation would
 * mean `nextAttemptAt = Invalid Date` and a message that is never retried.
 */

function intEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  // Explicit string comparison. Never `Boolean(raw)` — that makes `'false'`
  // true, which is exactly the class of bug that has bitten this codebase.
  return raw === 'true' || raw === '1'
}

export const MessagingConfig = {
  /** Default per-message attempt cap; copied onto the row at enqueue time. */
  get maxAttempts(): number { return intEnv('MESSAGE_MAX_ATTEMPTS', 5, 1, 20) },

  /** First retry delay in seconds; doubles each attempt up to the ceiling. */
  get backoffBaseSeconds(): number { return intEnv('MESSAGE_BACKOFF_BASE_SECONDS', 30, 1, 3600) },
  get backoffMaxSeconds(): number { return intEnv('MESSAGE_BACKOFF_MAX_SECONDS', 3600, 60, 86400) },

  /** How often the worker polls for claimable rows. */
  get pollIntervalMs(): number { return intEnv('MESSAGE_POLL_INTERVAL_MS', 5000, 250, 300_000) },

  /** How many messages one worker tick will attempt. */
  get batchSize(): number { return intEnv('MESSAGE_BATCH_SIZE', 20, 1, 200) },

  /**
   * A row PROCESSING for longer than this is presumed abandoned (the process
   * died mid-call) and is returned to QUEUED. Must comfortably exceed the
   * slowest provider timeout, or a slow-but-alive send gets double-sent.
   */
  get stuckAfterMs(): number { return intEnv('MESSAGE_STUCK_AFTER_MS', 120_000, 10_000, 3_600_000) },

  /** Per-provider-call timeout. */
  get providerTimeoutMs(): number { return intEnv('MESSAGE_PROVIDER_TIMEOUT_MS', 15_000, 1000, 120_000) },

  /**
   * The worker loop. Off by default under `NODE_ENV=test` so a test suite does
   * not race a background timer against its own assertions — the dispatcher is
   * driven explicitly there. Everywhere else it runs unless switched off.
   */
  get workerEnabled(): boolean {
    return boolEnv('MESSAGE_WORKER_ENABLED', process.env.NODE_ENV !== 'test')
  },

  /**
   * Forces the dev/no-op provider regardless of configured credentials. The
   * default is "simulate unless we are in production", which is the safe
   * direction: a developer with a stray TWILIO_ACCOUNT_SID in their `.env`
   * must not start texting real residents.
   */
  get forceSimulation(): boolean {
    return boolEnv('MESSAGING_SIMULATE', process.env.NODE_ENV !== 'production')
  },

  // ── Phase 5: reminders ────────────────────────────────────────────────
  /**
   * Reminder offsets in minutes before `Meeting.startTime`, largest first.
   * `MEETING_REMINDER_OFFSETS_MINUTES=1440,120` → a day before and two hours
   * before. Empty disables reminders entirely.
   */
  get reminderOffsetsMinutes(): number[] {
    const raw = process.env.MEETING_REMINDER_OFFSETS_MINUTES
    if (raw === undefined) return [1440, 120]
    return [...new Set(
      raw.split(',')
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0 && n <= 60 * 24 * 30),
    )].sort((a, b) => b - a)
  },

  get reminderScanIntervalMs(): number {
    return intEnv('MEETING_REMINDER_SCAN_INTERVAL_MS', 60_000, 5_000, 3_600_000)
  },

  get reminderSchedulerEnabled(): boolean {
    return boolEnv('MEETING_REMINDER_ENABLED', process.env.NODE_ENV !== 'test')
  },

  // ── Phase 4: resident meeting access tokens ───────────────────────────
  /** Token lifetime measured from the meeting's start time, in days after it. */
  get meetingTokenGraceDays(): number { return intEnv('MEETING_TOKEN_GRACE_DAYS', 2, 0, 60) },
  /** Hard ceiling on lifetime, so a meeting scheduled in 2029 has no 2029 token. */
  get meetingTokenMaxDays(): number { return intEnv('MEETING_TOKEN_MAX_DAYS', 90, 1, 365) },
  /** Replay ceiling — see `MeetingAccessToken.useCount` in the schema. */
  get meetingTokenMaxUses(): number { return intEnv('MEETING_TOKEN_MAX_USES', 20, 1, 500) },

  // ── Phase 6: notification retention ───────────────────────────────────
  get notificationRetentionDays(): number {
    return intEnv('NOTIFICATION_RETENTION_DAYS', 180, 7, 3650)
  },
  get notificationRetentionEnabled(): boolean {
    return boolEnv('NOTIFICATION_RETENTION_ENABLED', process.env.NODE_ENV !== 'test')
  },
  get notificationRetentionIntervalMs(): number {
    return intEnv('NOTIFICATION_RETENTION_INTERVAL_MS', 6 * 3600_000, 60_000, 7 * 86_400_000)
  },
  /** Rows deleted per tenant per sweep, so a huge backlog drains gradually. */
  get notificationRetentionBatchSize(): number {
    return intEnv('NOTIFICATION_RETENTION_BATCH_SIZE', 1000, 10, 50_000)
  },

  /** Public origin residents are sent to. Used to build invitation links. */
  get portalUrl(): string {
    return (process.env.PORTAL_URL ?? 'http://localhost:3002').replace(/\/+$/, '')
  },
}

/**
 * Exponential backoff with full jitter.
 *
 * Jitter matters more than it looks: without it, a provider outage that fails
 * 500 queued messages at once schedules all 500 to retry at the same
 * millisecond, and the recovery attempt re-creates the outage. Full jitter
 * (a uniform draw over `[0, delay]`) spreads them.
 */
export function backoffDelayMs(attemptCount: number): number {
  const base = MessagingConfig.backoffBaseSeconds * 1000
  const ceiling = MessagingConfig.backoffMaxSeconds * 1000
  const exponential = Math.min(ceiling, base * 2 ** Math.max(0, attemptCount - 1))
  return Math.floor(Math.random() * exponential)
}
