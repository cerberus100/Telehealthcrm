"use client"
import { useQuery } from '@tanstack/react-query'
import { Api } from '../lib/api'

export default function NotificationsBell() {
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: Api.notifications, refetchInterval: 15000 })
  const count = data?.items?.length ?? 0
  return (
    <div className="relative">
      <span aria-label="notifications">🔔</span>
      {count > 0 && (
        <span className="absolute -top-2 -right-2 text-xs bg-red-600 text-white rounded-full px-1.5">
          {count}
        </span>
      )}
    </div>
  )
}
