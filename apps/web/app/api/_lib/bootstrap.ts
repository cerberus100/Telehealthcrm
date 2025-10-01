import { ensureSeedAdmin } from '../../../lib/server/users'
import { getEnv } from '../../../lib/server/env'
import { serverLogger } from '../../../lib/server/logger'

let bootstrapped = false
let bootPromise: Promise<void> | null = null

export async function ensureBootstrap(): Promise<void> {
  if (bootstrapped) return
  if (!bootPromise) {
    bootPromise = (async () => {
      try {
        const env = getEnv()
        if (env.SEED_ADMIN_EMAIL) {
          await ensureSeedAdmin(env.SEED_ADMIN_EMAIL)
        }
        bootstrapped = true
      } catch (error) {
        serverLogger.error('Bootstrap failed', { error })
        throw error
      }
    })()
  }
  await bootPromise
}


