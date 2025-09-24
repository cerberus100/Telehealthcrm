"use client"
import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './auth'

interface RealtimeEvent {
  type: string
  payload: any
  timestamp: string
}

interface RealtimeHook {
  connected: boolean
  subscribe: (topic: string) => void
  unsubscribe: (topic: string) => void
  send: (event: string, data: any) => void
  lastEvent: RealtimeEvent | null
  screenPop: RealtimeEvent | null
  approvalUpdate: RealtimeEvent | null
  notification: RealtimeEvent | null
}

export function useRealtime(): RealtimeHook {
  const { token, role, orgId } = useAuth()
  const [connected, setConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null)
  const [screenPop, setScreenPop] = useState<RealtimeEvent | null>(null)
  const [approvalUpdate, setApprovalUpdate] = useState<RealtimeEvent | null>(null)
  const [notification, setNotification] = useState<RealtimeEvent | null>(null)
  const socketRef = useRef<Socket | null>(null)

  // Extend Socket interface to include our custom properties
  interface ExtendedSocket extends Socket {
    heartbeatInterval?: NodeJS.Timeout
  }

  useEffect(() => {
    // Only connect if authenticated
    if (!token || !orgId) return

    // Use environment variable for WebSocket URL, fallback to API base URL
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://telehealth-alb-prod-422934810.us-east-1.elb.amazonaws.com'
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || apiBaseUrl.replace(/^https?:\/\//, '')

    console.log('Connecting to WebSocket:', `https://${wsUrl}`)

    const socket = io(`https://${wsUrl}`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'], // Support both WebSocket and polling fallback
      timeout: 20000,
      forceNew: true,
      auth: {
        token: token // Send the actual JWT token from server
      },
      query: {
        orgId: orgId || 'unknown',
        role: role || 'SUPPORT'
      }
    })

    socket.on('connect', () => {
      console.log('WebSocket connected to realtime gateway')
      setConnected(true)

      // Send initial health check
      socket.emit('health', {})

      // Auto-subscribe to relevant topics based on role
      if (role === 'DOCTOR') {
        socket.emit('subscribe', { topics: ['CONSULT_STATUS_CHANGE', 'RX_STATUS_CHANGE'] })
      } else if (role === 'MARKETER') {
        socket.emit('subscribe', { topics: ['CONSULT_STATUS_CHANGE', 'SHIPMENT_UPDATE'] })
      } else if (role === 'PHARMACIST') {
        socket.emit('subscribe', { topics: ['RX_STATUS_CHANGE'] })
      } else if (role === 'LAB_TECH') {
        socket.emit('subscribe', { topics: ['SHIPMENT_UPDATE'] })
      } else {
        // Default subscription for other roles
        socket.emit('subscribe', { topics: ['SYSTEM_ALERT'] })
      }

      // Start heartbeat
      const heartbeatInterval = setInterval(() => {
        socket.emit('heartbeat', { timestamp: Date.now() })
      }, 30000) // Send heartbeat every 30 seconds

      // Store interval for cleanup
      socketRef.current = socket as ExtendedSocket
      ;(socket as ExtendedSocket).heartbeatInterval = heartbeatInterval
    })

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
      setConnected(false)
      setLastEvent(null)
      setScreenPop(null)
      setApprovalUpdate(null)
      setNotification(null)
    })

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      setConnected(false)
    })

    socket.on('error', (error) => {
      console.error('WebSocket error:', error)
    })

    socket.on('health_response', (data) => {
      console.log('WebSocket health response:', data)
    })

    socket.on('heartbeat_ack', (data) => {
      // Heartbeat acknowledged, connection is healthy
      console.log('Heartbeat acknowledged:', data)
    })

    // Listen for specific event types
    socket.on('screen-pop', (data) => {
      console.log('Screen-pop received:', data)
      setScreenPop({ type: 'screen-pop', payload: data, timestamp: data.timestamp })
    })

    socket.on('approval-update', (data) => {
      console.log('Approval update received:', data)
      setApprovalUpdate({ type: 'approval-update', payload: data, timestamp: data.timestamp })
    })

    socket.on('notification', (data) => {
      console.log('Notification received:', data)
      setNotification({ type: 'notification', payload: data, timestamp: data.timestamp })
    })

    socket.on('provider-availability', (data) => {
      console.log('Provider availability update:', data)
      setLastEvent({ type: 'provider-availability', payload: data, timestamp: data.timestamp })
    })

    socket.on('intake-submission', (data) => {
      console.log('Intake submission received:', data)
      setLastEvent({ type: 'intake-submission', payload: data, timestamp: data.timestamp })
    })

    socket.on('lab-result', (data) => {
      console.log('Lab result received:', data)
      setLastEvent({ type: 'lab-result', payload: data, timestamp: data.timestamp })
    })

    socket.on('shipment-update', (data) => {
      console.log('Shipment update received:', data)
      setLastEvent({ type: 'shipment-update', payload: data, timestamp: data.timestamp })
    })

    socketRef.current = socket

    return () => {
      if (socketRef.current) {
        const extendedSocket = socketRef.current as ExtendedSocket
        if (extendedSocket.heartbeatInterval) {
          clearInterval(extendedSocket.heartbeatInterval)
        }
        socket.disconnect()
        socketRef.current = null
      }
    }
  }, [token, role, orgId])

  const subscribe = (topic: string) => {
    if (socketRef.current?.connected) {
      (socketRef.current as ExtendedSocket).emit('subscribe', { topics: [topic] })
    }
  }

  const unsubscribe = (topic: string) => {
    if (socketRef.current?.connected) {
      (socketRef.current as ExtendedSocket).emit('unsubscribe', { topics: [topic] })
    }
  }

  const send = (event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data)
    }
  }

  return {
    connected,
    subscribe,
    unsubscribe,
    send,
    lastEvent,
    screenPop,
    approvalUpdate,
    notification,
  }
}

// Hook for screen-pop functionality (providers only)
export function useScreenPop() {
  const { screenPop } = useRealtime()
  const [activeCall, setActiveCall] = useState<any>(null)
  const [dismissed, setDismissed] = useState<string[]>([])

  useEffect(() => {
    if (screenPop && screenPop.payload.consultId && !dismissed.includes(screenPop.payload.consultId)) {
      setActiveCall(screenPop.payload)
    }
  }, [screenPop, dismissed])

  const dismissCall = (consultId: string) => {
    setDismissed(prev => [...prev, consultId])
    setActiveCall(null)
  }

  return { activeCall, dismissCall }
}

// Hook for approval updates (marketers only)
export function useApprovalUpdates() {
  const { approvalUpdate } = useRealtime()
  const [updates, setUpdates] = useState<any[]>([])

  useEffect(() => {
    if (approvalUpdate) {
      setUpdates(prev => [approvalUpdate.payload, ...prev.slice(0, 49)]) // Keep last 50
    }
  }, [approvalUpdate])

  return { updates }
}

// Legacy export for backward compatibility
export function useRealtimeNotifications() {
  const { notification, lastEvent } = useRealtime()
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    if (notification) {
      setNotifications(prev => [notification.payload, ...prev.slice(0, 99)])
    }
  }, [notification])

  return {
    notifications,
    unreadCount: notifications.length,
    connectionState: { status: 'connected' },
    markAsRead: (id: string) => {},
    markAllAsRead: () => {},
    removeNotification: (id: string) => {},
    clearAll: () => {}
  }
}