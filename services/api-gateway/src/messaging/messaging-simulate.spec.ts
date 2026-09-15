/**
 * The production fail-safe on MESSAGING_SIMULATE.
 *
 * An end-to-end audit sent 24 real SMS to a seeded number because this flag had
 * been set to `false` for a provider test and left that way, and ordinary CRM
 * actions queue resident messages automatically. The mirror of that failure
 * existed in production, where an unset flag silently meant "send for real".
 *
 * Whether real people are contacted must be a stated decision. These tests hold
 * that in place.
 */
import { MessagingConfig } from './messaging.config'

const ORIGINAL_ENV = process.env.NODE_ENV
const ORIGINAL_FLAG = process.env.MESSAGING_SIMULATE

const withEnv = (nodeEnv: string, flag: string | undefined, run: () => void) => {
  process.env.NODE_ENV = nodeEnv
  if (flag === undefined) delete process.env.MESSAGING_SIMULATE
  else process.env.MESSAGING_SIMULATE = flag
  try { run() } finally {
    process.env.NODE_ENV = ORIGINAL_ENV
    if (ORIGINAL_FLAG === undefined) delete process.env.MESSAGING_SIMULATE
    else process.env.MESSAGING_SIMULATE = ORIGINAL_FLAG
  }
}

describe('MESSAGING_SIMULATE outside production', () => {
  it('defaults to SIMULATING when unset — a stray credential must not text residents', () => {
    withEnv('development', undefined, () => {
      expect(MessagingConfig.forceSimulation).toBe(true)
    })
  })

  it('defaults to simulating in test too', () => {
    withEnv('test', undefined, () => {
      expect(MessagingConfig.forceSimulation).toBe(true)
    })
  })

  it('can still be switched off deliberately for a provider test', () => {
    withEnv('development', 'false', () => {
      expect(MessagingConfig.forceSimulation).toBe(false)
    })
  })
})

describe('MESSAGING_SIMULATE in production', () => {
  it('THROWS when unset — no silent default in either direction', () => {
    withEnv('production', undefined, () => {
      expect(() => MessagingConfig.forceSimulation).toThrow(/must be set explicitly in production/)
    })
  })

  it('THROWS when empty', () => {
    withEnv('production', '', () => {
      expect(() => MessagingConfig.forceSimulation).toThrow(/must be set explicitly in production/)
    })
  })

  it('THROWS on an unrecognised value rather than falling back', () => {
    withEnv('production', 'yes', () => {
      expect(() => MessagingConfig.forceSimulation).toThrow(/must be "true" or "false"/)
    })
  })

  it('accepts an explicit false — real sending, deliberately chosen', () => {
    withEnv('production', 'false', () => {
      expect(MessagingConfig.forceSimulation).toBe(false)
    })
  })

  it('accepts an explicit true — a quiet production deploy is expressible', () => {
    withEnv('production', 'true', () => {
      expect(MessagingConfig.forceSimulation).toBe(true)
    })
  })

  it('assertConfigured() is the boot gate and throws the same way', () => {
    withEnv('production', undefined, () => {
      expect(() => MessagingConfig.assertConfigured()).toThrow(/must be set explicitly in production/)
    })
    withEnv('production', 'true', () => {
      expect(() => MessagingConfig.assertConfigured()).not.toThrow()
    })
  })
})
