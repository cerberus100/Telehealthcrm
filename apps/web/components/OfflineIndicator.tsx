"use client"
import { usePWA } from '../lib/pwa'

export default function OfflineIndicator() {
  const { isOnline } = usePWA()

  if (isOnline) return null

  return (
    <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black px-4 py-2 text-center text-sm font-medium z-50">
      <div className="flex items-center justify-center gap-2">
        <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
        You're offline. Some features may be limited until connection is restored.
      </div>
    </div>
  )
}
