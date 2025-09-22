'use client'

import { useQuery } from '@tanstack/react-query'
import { Api } from '../../lib/api'
import { Protected } from '../../lib/auth'
import Link from 'next/link'

export default function NotificationsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications'],
    queryFn: Api.notifications,
  })

  const getNotificationLink = (notification: any) => {
    if (notification.type === 'LAB_RESULT_READY' && notification.payload?.lab_order_id) {
      return `/lab-orders/${notification.payload.lab_order_id}`
    }
    if (notification.type === 'RX_READY' && notification.payload?.rx_id) {
      return `/rx/${notification.payload.rx_id}`
    }
    if (notification.type === 'CONSULT_APPROVED' && notification.payload?.consult_id) {
      return `/consults/${notification.payload.consult_id}`
    }
    return null
  }

  const getNotificationText = (notification: any) => {
    switch (notification.type) {
      case 'LAB_RESULT_READY':
        return 'Lab result is ready for review'
      case 'RX_READY':
        return 'Prescription is ready for pickup'
      case 'CONSULT_APPROVED':
        return 'Consultation has been approved'
      case 'SHIPMENT_DELIVERED':
        return 'Shipment has been delivered'
      default:
        return notification.type.replace(/_/g, ' ').toLowerCase()
    }
  }

  return (
    <Protected>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Notifications</h1>
        
        {isLoading && <div className="text-gray-500">Loading notifications...</div>}
        {error && <div className="text-red-600">Error loading notifications</div>}
        
        {data && (
          <div className="space-y-4">
            {data.items.map((notification) => {
              const link = getNotificationLink(notification)
              const content = (
                <div className="bg-white p-4 rounded shadow hover:shadow-md">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{getNotificationText(notification)}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                    {link && (
                      <span className="text-brand-600 text-sm">View →</span>
                    )}
                  </div>
                </div>
              )

              return link ? (
                <Link key={notification.id} href={link}>
                  {content}
                </Link>
              ) : (
                <div key={notification.id}>{content}</div>
              )
            })}
            
            {data.items.length === 0 && (
              <p className="text-gray-500">No notifications</p>
            )}
          </div>
        )}
      </div>
    </Protected>
  )
}
