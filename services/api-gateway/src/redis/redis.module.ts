import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common'

export const REDIS = 'REDIS'

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: () => {
        const url = process.env.REDIS_URL
        if (!url) {
          if (process.env.NODE_ENV === 'production') {
            throw new Error('REDIS_URL environment variable is required in production')
          }
          return createMemoryFallback()
        }
        // Lazy import so ioredis is optional in dev without Redis
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        const { Redis } = require('ioredis') as any
        if (process.env.NODE_ENV !== 'production') {
          // In dev: try to connect; fall back to in-memory if unreachable.
          // Note: lazyConnect + connect() has issues with WSL2 networking on Windows;
          // use a ready-event timeout instead. Suppress error events during probe to
          // avoid unhandled-error crash, but only resolve once 'ready' or timeout fires.
          return new Promise(resolve => {
            let resolved = false
            const client = new Redis(url, { maxRetriesPerRequest: 0, connectTimeout: 2000, family: 4 })
            // Suppress unhandled error events during probe
            client.on('error', () => { /* intentionally suppressed during connection probe */ })
            const timer = setTimeout(() => {
              if (resolved) return
              resolved = true
              console.warn('[RedisModule] Redis unreachable — using in-memory fallback')
              client.disconnect()
              resolve(createMemoryFallback())
            }, 3500)
            client.once('ready', () => {
              if (resolved) return
              resolved = true
              clearTimeout(timer)
              console.log('[RedisModule] Connected to Redis')
              resolve(client)
            })
          })
        }
        return new Redis(url, { maxRetriesPerRequest: 3, family: 4 })
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly client: { quit?: () => Promise<unknown>; disconnect?: () => void }) {}

  async onModuleDestroy(): Promise<void> {
    // ioredis keeps its TCP socket alive after Nest closes unless the owning
    // module explicitly releases it. The fallback has neither method.
    if (typeof this.client.quit === 'function') {
      try {
        await this.client.quit()
        return
      } catch {
        // A half-open dev connection still needs to be released below.
      }
    }
    this.client.disconnect?.()
  }
}

// In-memory fallback for local dev without Redis
function createMemoryFallback() {
  const store = new Map<string, { value: string; expiresAt?: number }>()

  function isExpired(item: { value: string; expiresAt?: number }) {
    return item.expiresAt !== undefined && Date.now() > item.expiresAt
  }

  return {
    set: async (key: string, value: string, _ex?: string, _ttl?: number) => {
      store.set(key, { value })
      return 'OK'
    },
    get: async (key: string) => {
      const item = store.get(key)
      if (!item) return null
      if (isExpired(item)) { store.delete(key); return null }
      return item.value
    },
    del: async (...keys: string[]) => { keys.forEach(k => store.delete(k)); return keys.length },
    setex: async (key: string, ttl: number, value: string) => {
      store.set(key, { value, expiresAt: Date.now() + ttl * 1000 })
      return 'OK'
    },
    exists: async (key: string) => {
      const item = store.get(key)
      if (!item) return 0
      if (isExpired(item)) { store.delete(key); return 0 }
      return 1
    },
    incr: async (key: string) => {
      const item = store.get(key)
      if (item && isExpired(item)) store.delete(key)
      const v = parseInt(store.get(key)?.value ?? '0') + 1
      const old = store.get(key)
      store.set(key, { value: String(v), expiresAt: old?.expiresAt })
      return v
    },
    // Mirrors Redis TTL semantics: -2 = no such key, -1 = key with no expiry,
    // otherwise the remaining lifetime in whole seconds.
    ttl: async (key: string) => {
      const item = store.get(key)
      if (!item) return -2
      if (isExpired(item)) { store.delete(key); return -2 }
      if (item.expiresAt === undefined) return -1
      return Math.ceil((item.expiresAt - Date.now()) / 1000)
    },
    expire: async (key: string, ttl: number) => {
      const item = store.get(key)
      if (item) store.set(key, { ...item, expiresAt: Date.now() + ttl * 1000 })
      return 1
    },
  }
}
