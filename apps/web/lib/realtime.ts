"use client"
import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from './auth'
import { useAccessibility } from '../components/AccessibilityProvider'

interface RealtimeNotification {
  id: string
  type: 'SHIPMENT_UPDATE' | 'CONSULT_STATUS' | 'LAB_RESULT' | 'SYSTEM_ALERT' | 'USER_MESSAGE'
  title: string
  message: string
  data?: any
  timestamp: string
  read: boolean
  priority: 'low' | 'medium' | 'high' | 'urgent'
  orgId?: string
  userId?: string
}

interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  lastConnected?: Date
  reconnectAttempts: number
}

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY_BASE = 1000 // 1 second
const HEARTBEAT_INTERVAL = 30000 // 30 seconds

export function useRealtimeNotifications() {
  const { token, orgId, role } = useAuth()
  const { announceMessage } = useAccessibility()
  
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'disconnected',
    reconnectAttempts: 0,
  })
  
  const wsRef = useRef<WebSocket | null>(null)
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) return

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws'
    const ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`)
    
    wsRef.current = ws
    setConnectionState(prev => ({ ...prev, status: 'connecting' }))

    ws.onopen = () => {
      console.log('WebSocket connected')
      setConnectionState({
        status: 'connected',
        lastConnected: new Date(),
        reconnectAttempts: 0,
      })

      // Send heartbeat periodically
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, HEARTBEAT_INTERVAL)

      // Subscribe to user-specific and org-specific channels
      ws.send(JSON.stringify({
        type: 'subscribe',
        channels: [
          `user:${token}`, // User-specific notifications
          orgId ? `org:${orgId}` : null, // Org-specific notifications
          `role:${role}`, // Role-based notifications
        ].filter(Boolean),
      }))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'pong') {
          // Heartbeat response - connection is healthy
          return
        }

        if (data.messageType === 'notification' || data.type === 'notification') {
          const notification: RealtimeNotification = {
            id: data.id || `notif_${Date.now()}`,
            type: data.notificationType,
            title: data.title,
            message: data.message,
            data: data.data,
            timestamp: data.timestamp || new Date().toISOString(),
            read: false,
            priority: data.priority || 'medium',
            orgId: data.orgId,
            userId: data.userId,
          }

          setNotifications(prev => [notification, ...prev.slice(0, 99)]) // Keep last 100

          // Announce important notifications to screen readers
          if (notification.priority === 'urgent' || notification.priority === 'high') {
            announceMessage(`${notification.title}: ${notification.message}`, 'assertive')
          }

          // Show browser notification if permission granted
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title, {
              body: notification.message,
              icon: '/favicon.ico',
              tag: notification.id,
            })
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason)
      
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }

      setConnectionState(prev => ({
        ...prev,
        status: event.code === 1000 ? 'disconnected' : 'error',
      }))

      // Attempt to reconnect unless it was a clean close
      if (event.code !== 1000 && connectionState.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = RECONNECT_DELAY_BASE * Math.pow(2, connectionState.reconnectAttempts)
        
        reconnectTimeoutRef.current = setTimeout(() => {
          setConnectionState(prev => ({
            ...prev,
            reconnectAttempts: prev.reconnectAttempts + 1,
          }))
          connect()
        }, delay)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setConnectionState(prev => ({ ...prev, status: 'error' }))
    }
  }, [token, orgId, role, connectionState.reconnectAttempts, announceMessage])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'User initiated disconnect')
      wsRef.current = null
    }
    
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId 
          ? { ...notif, read: true }
          : notif
      )
    )
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })))
  }, [])

  const removeNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== notificationId))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  // Connect when component mounts and token is available
  useEffect(() => {
    if (token) {
      connect()
    }
    return disconnect
  }, [token, connect, disconnect])

  // Request notification permission on first use
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  return {
    notifications,
    unreadCount,
    connectionState,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    connect,
    disconnect,
  }
}

// Hook for sending notifications (admin/system use)
export function useNotificationSender() {
  const { token } = useAuth()
  const wsRef = useRef<WebSocket | null>(null)

  const sendNotification = useCallback(async (notification: Omit<RealtimeNotification, 'id' | 'timestamp' | 'read'>) => {
    // In a real app, this would send via REST API to the backend
    // which would then broadcast via WebSocket to relevant users
    
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(notification),
      })

      if (!response.ok) {
        throw new Error('Failed to send notification')
      }

      return await response.json()
    } catch (error) {
      console.error('Error sending notification:', error)
      throw error
    }
  }, [token])

  return { sendNotification }
}

// Utility function to create notification objects
export function createNotification(
  type: RealtimeNotification['type'],
  title: string,
  message: string,
  options?: Partial<Pick<RealtimeNotification, 'priority' | 'data' | 'orgId' | 'userId'>>
): Omit<RealtimeNotification, 'id' | 'timestamp' | 'read'> {
  return {
    type,
    title,
    message,
    priority: 'medium',
    ...options,
  }
}

// Mock WebSocket server for development
export class MockWebSocketServer {
  private clients: Set<WebSocket> = new Set()
  
  constructor() {
    // Simulate periodic notifications in development
    if (process.env.NODE_ENV === 'development') {
      setInterval(() => {
        this.broadcast(createNotification(
          'SHIPMENT_UPDATE',
          'Shipment Update',
          `Tracking #1Z123 is now out for delivery`,
          { priority: 'medium' }
        ))
      }, 30000) // Every 30 seconds
    }
  }

  addClient(ws: WebSocket) {
    this.clients.add(ws)
  }

  removeClient(ws: WebSocket) {
    this.clients.delete(ws)
  }

  broadcast(notification: Omit<RealtimeNotification, 'id' | 'timestamp' | 'read'>) {
    const message = JSON.stringify({
      ...notification,
      messageType: 'notification', // Renamed to avoid conflict with notification.type
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    })

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message)
      }
    })
  }
}
