"use client"
import { useEffect, useState } from 'react'

// PWA Installation and Management
export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    // Check if app is already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         (window.navigator as any).standalone ||
                         document.referrer.includes('android-app://')
    setIsInstalled(isStandalone)

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
      console.log('[PWA] Install prompt available')
    }

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsInstallable(false)
      setDeferredPrompt(null)
      console.log('[PWA] App installed successfully')
      
      // Track installation
      console.log('[PWA] App installed - tracking event')
    }

    // Listen for online/offline status
    const handleOnline = () => {
      setIsOnline(true)
      console.log('[PWA] App is online')
    }

    const handleOffline = () => {
      setIsOnline(false)
      console.log('[PWA] App is offline')
    }

    // Add event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Set initial online status
    setIsOnline(navigator.onLine)

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registered:', registration)
          
          // Check for updates
          registration.addEventListener('updatefound', () => {
            console.log('[PWA] New service worker available')
          })
        })
        .catch((error) => {
          console.error('[PWA] Service Worker registration failed:', error)
        })
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const installApp = async () => {
    if (!deferredPrompt) return false

    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      
      if (outcome === 'accepted') {
        console.log('[PWA] User accepted install prompt')
        setIsInstallable(false)
        setDeferredPrompt(null)
        return true
      } else {
        console.log('[PWA] User dismissed install prompt')
        return false
      }
    } catch (error) {
      console.error('[PWA] Install prompt failed:', error)
      return false
    }
  }

  return {
    isInstallable,
    isInstalled,
    isOnline,
    installApp
  }
}

// Hook for offline functionality
export function useOfflineStorage() {
  const [offlineActions, setOfflineActions] = useState<any[]>([])

  const addOfflineAction = (action: {
    id: string
    url: string
    method: string
    headers: Record<string, string>
    body?: string
    timestamp: number
  }) => {
    setOfflineActions(prev => [...prev, action])
    
    // Store in localStorage for persistence
    if (typeof window !== 'undefined') {
      const stored = JSON.parse(localStorage.getItem('offline_actions') || '[]')
      stored.push(action)
      localStorage.setItem('offline_actions', JSON.stringify(stored))
    }
  }

  const removeOfflineAction = (actionId: string) => {
    setOfflineActions(prev => prev.filter(a => a.id !== actionId))
    
    // Remove from localStorage
    if (typeof window !== 'undefined') {
      const stored = JSON.parse(localStorage.getItem('offline_actions') || '[]')
      const filtered = stored.filter((a: any) => a.id !== actionId)
      localStorage.setItem('offline_actions', JSON.stringify(filtered))
    }
  }

  const syncOfflineActions = async () => {
    for (const action of offlineActions) {
      try {
        await fetch(action.url, {
          method: action.method,
          headers: action.headers,
          body: action.body
        })
        
        removeOfflineAction(action.id)
        console.log('[PWA] Synced offline action:', action.id)
      } catch (error) {
        console.error('[PWA] Failed to sync action:', action.id)
      }
    }
  }

  return {
    offlineActions,
    addOfflineAction,
    removeOfflineAction,
    syncOfflineActions
  }
}

// PWA Install Banner Component
export function PWAInstallBanner(): JSX.Element | null {
  const { isInstallable, installApp } = usePWA()
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // Show banner after 30 seconds if installable
    if (isInstallable) {
      const timer = setTimeout(() => setShowBanner(true), 30000)
      return () => clearTimeout(timer)
    }
  }, [isInstallable])

  const handleInstall = async () => {
    const success = await installApp()
    if (success) {
      setShowBanner(false)
    }
  }

  if (!showBanner || !isInstallable) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50 md:left-auto md:right-4 md:max-w-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="font-medium text-sm">Install Teleplatform</div>
          <div className="text-xs opacity-90">Get the app for faster access and offline features</div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowBanner(false)}
            className="px-3 py-1 text-xs border border-white/30 rounded hover:bg-white/10"
          >
            Later
          </button>
          <button 
            onClick={handleInstall}
            className="px-3 py-1 text-xs bg-white text-blue-600 rounded font-medium hover:bg-blue-50"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  )
}
