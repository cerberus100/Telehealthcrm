// Teleplatform Service Worker - PWA Functionality
const CACHE_NAME = 'teleplatform-v1'
const STATIC_CACHE = 'teleplatform-static-v1'
const DYNAMIC_CACHE = 'teleplatform-dynamic-v1'

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/login',
  '/dashboard',
  '/patients',
  '/portal',
  '/manifest.json',
  '/favicon.svg'
]

// API endpoints to cache for offline access
const CACHE_API_PATTERNS = [
  '/auth/me',
  '/health',
  '/notifications'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...')
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static files')
        return cache.addAll(STATIC_FILES)
      })
      .then(() => {
        console.log('[SW] Static files cached successfully')
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static files:', error)
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...')
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            })
        )
      })
      .then(() => {
        console.log('[SW] Service worker activated')
        return self.clients.claim()
      })
  )
})

// Fetch event - network-first with cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol.startsWith('chrome-extension')) {
    return
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/') || url.hostname.includes('telehealth-alb-prod')) {
    event.respondWith(handleApiRequest(request))
    return
  }

  // Handle static assets
  if (STATIC_FILES.some(file => url.pathname === file || url.pathname.startsWith(file))) {
    event.respondWith(handleStaticRequest(request))
    return
  }

  // Handle other requests with network-first strategy
  event.respondWith(handleDynamicRequest(request))
})

// Network-first strategy for API requests
async function handleApiRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request)
    
    // Cache successful responses
    if (networkResponse.ok && shouldCacheApiResponse(request.url)) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('[SW] Network failed for API request, checking cache:', request.url)
    
    // Fallback to cache
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      console.log('[SW] Serving API request from cache:', request.url)
      return cachedResponse
    }
    
    // Return offline response for critical endpoints
    if (request.url.includes('/auth/me')) {
      return new Response(JSON.stringify({
        offline: true,
        message: 'You are currently offline. Some features may be limited.'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    throw error
  }
}

// Cache-first strategy for static files
async function handleStaticRequest(request) {
  const cachedResponse = await caches.match(request)
  if (cachedResponse) {
    return cachedResponse
  }
  
  try {
    const networkResponse = await fetch(request)
    const cache = await caches.open(STATIC_CACHE)
    cache.put(request, networkResponse.clone())
    return networkResponse
  } catch (error) {
    console.error('[SW] Failed to fetch static resource:', request.url)
    throw error
  }
}

// Network-first with cache fallback for dynamic content
async function handleDynamicRequest(request) {
  try {
    const networkResponse = await fetch(request)
    const cache = await caches.open(DYNAMIC_CACHE)
    cache.put(request, networkResponse.clone())
    return networkResponse
  } catch (error) {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    throw error
  }
}

// Determine if API response should be cached
function shouldCacheApiResponse(url) {
  return CACHE_API_PATTERNS.some(pattern => url.includes(pattern))
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag)
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync())
  }
})

// Handle background sync
async function doBackgroundSync() {
  console.log('[SW] Performing background sync...')
  
  // Sync offline actions when network is restored
  try {
    const offlineActions = await getOfflineActions()
    
    for (const action of offlineActions) {
      try {
        await fetch(action.url, {
          method: action.method,
          headers: action.headers,
          body: action.body
        })
        
        // Remove successful action from offline queue
        await removeOfflineAction(action.id)
        console.log('[SW] Synced offline action:', action.id)
      } catch (error) {
        console.error('[SW] Failed to sync action:', action.id, error)
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error)
  }
}

// Get offline actions from IndexedDB
async function getOfflineActions() {
  // In a real implementation, this would read from IndexedDB
  return []
}

// Remove synced action from offline queue
async function removeOfflineAction(actionId) {
  // In a real implementation, this would remove from IndexedDB
  console.log('[SW] Removed offline action:', actionId)
}

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received')
  
  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Details',
        icon: '/icons/icon-72x72.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/icon-72x72.png'
      }
    ]
  }
  
  event.waitUntil(
    self.registration.showNotification('Teleplatform', options)
  )
})

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action)
  
  event.notification.close()
  
  if (event.action === 'explore') {
    // Open the app to relevant page
    event.waitUntil(
      clients.openWindow('/dashboard')
    )
  }
})

console.log('[SW] Teleplatform Service Worker loaded')
