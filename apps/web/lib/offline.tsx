"use client"
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAccessibility } from '../components/AccessibilityProvider'

interface OfflineAction {
  id: string
  type: 'CREATE' | 'UPDATE' | 'DELETE'
  resource: string
  data: any
  timestamp: string
  retryCount: number
  maxRetries: number
}

interface OfflineState {
  isOnline: boolean
  pendingActions: OfflineAction[]
  isSyncing: boolean
  lastSyncAt?: Date
  syncErrors: Array<{ actionId: string; error: string }>
}

const MAX_RETRY_ATTEMPTS = 3
const SYNC_DEBOUNCE_MS = 2000
const STORAGE_KEY = 'teleplatform_offline_actions'

export function useOfflineSync() {
  const { announceMessage } = useAccessibility()
  
  const [state, setState] = useState<OfflineState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingActions: [],
    isSyncing: false,
    syncErrors: [],
  })
  
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load pending actions from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const pendingActions = JSON.parse(stored)
        setState(prev => ({ ...prev, pendingActions }))
      }
    } catch (error) {
      console.error('Failed to load offline actions from storage:', error)
    }
  }, [])

  // Save pending actions to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.pendingActions))
    } catch (error) {
      console.error('Failed to save offline actions to storage:', error)
    }
  }, [state.pendingActions])

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }))
      announceMessage('Connection restored. Syncing pending changes...', 'polite')
      // Trigger sync after a short delay to allow for connection stabilization
      setTimeout(syncPendingActions, 1000)
    }

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }))
      announceMessage('Connection lost. Changes will be saved locally and synced when connection is restored.', 'assertive')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [announceMessage])

  // Queue an action for offline execution
  const queueAction = useCallback((
    type: OfflineAction['type'],
    resource: string,
    data: any,
    options?: { maxRetries?: number }
  ): string => {
    const action: OfflineAction = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      resource,
      data,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      maxRetries: options?.maxRetries ?? MAX_RETRY_ATTEMPTS,
    }

    setState(prev => ({
      ...prev,
      pendingActions: [...prev.pendingActions, action],
    }))

    // If online, trigger sync after debounce
    if (state.isOnline) {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
      syncTimeoutRef.current = setTimeout(syncPendingActions, SYNC_DEBOUNCE_MS)
    }

    return action.id
  }, [state.isOnline])

  // Execute a single action
  const executeAction = async (action: OfflineAction): Promise<boolean> => {
    try {
      const { type, resource, data } = action
      const endpoint = `/api/${resource.toLowerCase()}`
      
      let response: Response
      
      switch (type) {
        case 'CREATE':
          response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
          break
        case 'UPDATE':
          response = await fetch(`${endpoint}/${data.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
          break
        case 'DELETE':
          response = await fetch(`${endpoint}/${data.id}`, {
            method: 'DELETE',
          })
          break
        default:
          throw new Error(`Unknown action type: ${type}`)
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return true
    } catch (error) {
      console.error(`Failed to execute offline action ${action.id}:`, error)
      return false
    }
  }

  // Sync all pending actions
  const syncPendingActions = useCallback(async () => {
    if (state.isSyncing || !state.isOnline || state.pendingActions.length === 0) {
      return
    }

    setState(prev => ({ ...prev, isSyncing: true, syncErrors: [] }))

    const actionsToSync = [...state.pendingActions]
    const successfulActions: string[] = []
    const failedActions: Array<{ actionId: string; error: string }> = []

    for (const action of actionsToSync) {
      const success = await executeAction(action)
      
      if (success) {
        successfulActions.push(action.id)
      } else {
        // Increment retry count
        const updatedAction = {
          ...action,
          retryCount: action.retryCount + 1,
        }

        if (updatedAction.retryCount >= updatedAction.maxRetries) {
          // Max retries reached, move to failed
          failedActions.push({
            actionId: action.id,
            error: `Failed after ${updatedAction.maxRetries} attempts`,
          })
          successfulActions.push(action.id) // Remove from pending
        } else {
          // Update the action with new retry count
          setState(prev => ({
            ...prev,
            pendingActions: prev.pendingActions.map(a =>
              a.id === action.id ? updatedAction : a
            ),
          }))
        }
      }
    }

    // Remove successful actions from pending list
    setState(prev => ({
      ...prev,
      pendingActions: prev.pendingActions.filter(
        action => !successfulActions.includes(action.id)
      ),
      syncErrors: failedActions,
      isSyncing: false,
      lastSyncAt: new Date(),
    }))

    // Announce sync results
    if (successfulActions.length > 0) {
      announceMessage(
        `Successfully synced ${successfulActions.length} pending changes.`,
        'polite'
      )
    }

    if (failedActions.length > 0) {
      announceMessage(
        `${failedActions.length} changes failed to sync. Please check your connection and try again.`,
        'assertive'
      )
    }
  }, [state.isSyncing, state.isOnline, state.pendingActions, announceMessage])

  // Retry failed actions
  const retryFailedActions = useCallback(() => {
    setState(prev => ({ ...prev, syncErrors: [] }))
    syncPendingActions()
  }, [syncPendingActions])

  // Clear all pending actions (use with caution)
  const clearPendingActions = useCallback(() => {
    setState(prev => ({
      ...prev,
      pendingActions: [],
      syncErrors: [],
    }))
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return {
    isOnline: state.isOnline,
    pendingActions: state.pendingActions,
    isSyncing: state.isSyncing,
    lastSyncAt: state.lastSyncAt,
    syncErrors: state.syncErrors,
    queueAction,
    syncPendingActions,
    retryFailedActions,
    clearPendingActions,
  }
}

// Higher-order hook for offline-aware API calls
export function useOfflineAwareApi() {
  const { queueAction, isOnline } = useOfflineSync()

  const apiCall = useCallback(async (
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    options?: { skipOfflineQueue?: boolean }
  ) => {
    if (!isOnline && !options?.skipOfflineQueue && method !== 'GET') {
      // Queue non-GET requests when offline
      const actionType = method === 'POST' ? 'CREATE' : method === 'PUT' ? 'UPDATE' : 'DELETE'
      const resource = endpoint.split('/').filter(Boolean)[1] || 'unknown' // Extract resource from /api/resource
      
      queueAction(actionType, resource, data)
      
      // Return optimistic response for offline operations
      return Promise.resolve(data)
    }

    // Make actual API call when online
    const response = await fetch(endpoint, {
      method,
      headers: method !== 'GET' ? { 'Content-Type': 'application/json' } : {},
      body: method !== 'GET' ? JSON.stringify(data) : undefined,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }, [isOnline, queueAction])

  return { apiCall, isOnline }
}

// Component for offline status indicator
export function OfflineIndicator() {
  const { isOnline, pendingActions, isSyncing, syncErrors } = useOfflineSync()

  if (isOnline && pendingActions.length === 0 && syncErrors.length === 0) {
    return null
  }

  return (
    <div className={`
      fixed bottom-4 right-4 z-50 max-w-sm
      ${isOnline ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}
      border rounded-lg shadow-lg p-3
    `}>
      <div className="flex items-center gap-2">
        {!isOnline && (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )}
        
        <div className="flex-1">
          {!isOnline && (
            <div className="font-medium text-sm">Offline Mode</div>
          )}
          
          {pendingActions.length > 0 && (
            <div className="text-xs">
              {isSyncing ? 'Syncing...' : `${pendingActions.length} changes pending`}
            </div>
          )}
          
          {syncErrors.length > 0 && (
            <div className="text-xs text-red-600">
              {syncErrors.length} sync errors
            </div>
          )}
        </div>
        
        {isSyncing && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
        )}
      </div>
    </div>
  )
}
