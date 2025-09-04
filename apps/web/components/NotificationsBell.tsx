"use client"
import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Api } from '../lib/api'
import { useRealtimeNotifications } from '../lib/realtime'
import { useKeyboardNavigation } from '../lib/keyboard'
import { FocusTrap } from './AccessibilityProvider'

export default function NotificationsBell() {
  const [isOpen, setIsOpen] = useState(false)
  const bellRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  
  // Fallback to polling if real-time is not available
  const { data } = useQuery({ 
    queryKey: ['notifications'], 
    queryFn: Api.notifications, 
    refetchInterval: 15000 
  })
  
  // Real-time notifications
  const {
    notifications,
    unreadCount,
    connectionState,
    markAsRead,
    markAllAsRead,
    removeNotification,
  } = useRealtimeNotifications()

  // Use real-time count if available, otherwise fall back to API
  const count = notifications.length > 0 ? unreadCount : (data?.items?.length ?? 0)

  // Keyboard navigation
  useKeyboardNavigation({
    shortcuts: [
      {
        key: 'Escape',
        action: () => setIsOpen(false),
        description: 'Close notifications',
        disabled: !isOpen,
      },
    ],
  })

  const handleToggle = () => {
    setIsOpen(!isOpen)
  }

  const handleNotificationClick = (notificationId: string) => {
    markAsRead(notificationId)
    // Navigate to relevant page based on notification type
    const notification = notifications.find(n => n.id === notificationId)
    if (notification?.type === 'SHIPMENT_UPDATE' && notification.data?.shipmentId) {
      window.location.href = `/shipments?highlight=${notification.data.shipmentId}`
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="relative">
      <button
        ref={bellRef}
        onClick={handleToggle}
        className="relative p-2 text-slate-600 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-full"
        aria-label={`Notifications ${count > 0 ? `(${count} unread)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <svg 
          className="w-5 h-5" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" 
          />
        </svg>
        
        {count > 0 && (
          <span 
            className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-red-600 rounded-full"
            aria-hidden="true"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Notifications Panel */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <FocusTrap active={isOpen}>
            <div
              ref={panelRef}
              className="absolute right-0 mt-2 w-80 max-h-96 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-labelledby="notifications-title"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-200">
                <h2 id="notifications-title" className="font-medium text-slate-900">
                  Notifications
                </h2>
                <div className="flex items-center gap-2">
                  {/* Connection Status */}
                  <div className="flex items-center gap-1">
                    <div 
                      className={`w-2 h-2 rounded-full ${
                        connectionState.status === 'connected' 
                          ? 'bg-green-500' 
                          : connectionState.status === 'connecting'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                      title={`Connection: ${connectionState.status}`}
                    />
                    <span className="text-xs text-slate-500">
                      {connectionState.status === 'connected' ? 'Live' : 'Offline'}
                    </span>
                  </div>
                  
                  {count > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-brand-600 hover:text-brand-700"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
              </div>

              {/* Notifications List */}
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 && data?.items?.length === 0 ? (
                  <div className="p-4 text-center text-slate-500">
                    <svg className="w-8 h-8 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="text-sm">No notifications</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-3 hover:bg-slate-50 cursor-pointer ${
                          !notification.read ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                        }`}
                        onClick={() => handleNotificationClick(notification.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleNotificationClick(notification.id)
                          }
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className={`text-sm ${!notification.read ? 'font-medium' : ''}`}>
                                {notification.title}
                              </h3>
                              {notification.priority === 'urgent' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                  Urgent
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {formatTime(notification.timestamp)}
                            </p>
                          </div>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              removeNotification(notification.id)
                            }}
                            className="ml-2 text-slate-400 hover:text-slate-600"
                            aria-label="Remove notification"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {/* Fallback to API notifications if no real-time */}
                    {notifications.length === 0 && data?.items?.map((item: any) => (
                      <div
                        key={item.id}
                        className="p-3 hover:bg-slate-50"
                      >
                        <div className="text-sm font-medium">{item.type}</div>
                        <div className="text-xs text-slate-600 mt-1">
                          {new Date(item.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-slate-200 bg-slate-50">
                <button
                  onClick={() => {
                    setIsOpen(false)
                    window.location.href = '/notifications'
                  }}
                  className="w-full text-sm text-center text-brand-600 hover:text-brand-700"
                >
                  View all notifications
                </button>
              </div>
            </div>
          </FocusTrap>
        </>
      )}
    </div>
  )
}
