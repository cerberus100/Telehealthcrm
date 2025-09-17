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

  useEffect(() => {
    // Only connect if authenticated
    if (!token || !orgId) return
    
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://127.0.0.1:3001'
    
    const socket = io(`${wsUrl}/realtime`, {
      transports: ['websocket'],
      timeout: 10000,
      auth: {
        token: `${token.split('_')[2] || 'demo'}|${orgId}|${role}` // Demo token format
      }
    })

    socket.on('connect', () => {
      console.log('WebSocket connected to realtime gateway')
      setConnected(true)
      
      // Auto-subscribe to relevant channels based on role
      if (role === 'DOCTOR') {
        socket.emit('subscribe', { room: 'calls' })
        socket.emit('subscribe', { room: 'lab-results' })
      } else if (role === 'MARKETER') {
        socket.emit('subscribe', { room: 'approvals' })
        socket.emit('subscribe', { room: 'intake-submissions' })
      }
    })

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected')
      setConnected(false)
    })

    socket.on('error', (error) => {
      console.error('WebSocket error:', error)
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
      socket.disconnect()
    }
  }, [token, role, orgId])

  const subscribe = (topic: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe', { room: topic })
    }
  }

  const unsubscribe = (topic: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe', { room: topic })
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