'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../lib/auth'
import Link from 'next/link'

interface WorkItem {
  id: string
  type: 'consult' | 'rx' | 'lab_order' | 'lab_result'
  title: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  created_at: string
  sla_minutes: number
  assigned_to?: string
  status: string
}

// Mock work queue data
const mockWorkItems: WorkItem[] = [
  {
    id: 'c_1',
    type: 'consult',
    title: 'Patient consultation review',
    priority: 'high',
    created_at: new Date(Date.now() - 22 * 60 * 1000).toISOString(), // 22 minutes ago
    sla_minutes: 30,
    status: 'PENDING'
  },
  {
    id: 'rx_1',
    type: 'rx',
    title: 'Prescription requires signature',
    priority: 'medium',
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 minutes ago
    sla_minutes: 60,
    status: 'DRAFT'
  },
  {
    id: 'lr_1',
    type: 'lab_result',
    title: 'COVID-19 test results ready',
    priority: 'urgent',
    created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
    sla_minutes: 15,
    status: 'READY'
  }
]

function getTimeRemaining(createdAt: string, slaMinutes: number): { 
  minutes: number, 
  isOverdue: boolean,
  urgencyLevel: 'safe' | 'warning' | 'danger' | 'overdue'
} {
  const created = new Date(createdAt).getTime()
  const now = Date.now()
  const elapsed = (now - created) / (1000 * 60) // minutes elapsed
  const remaining = slaMinutes - elapsed

  const isOverdue = remaining <= 0
  let urgencyLevel: 'safe' | 'warning' | 'danger' | 'overdue' = 'safe'
  
  if (isOverdue) {
    urgencyLevel = 'overdue'
  } else if (remaining <= slaMinutes * 0.25) {
    urgencyLevel = 'danger'
  } else if (remaining <= slaMinutes * 0.5) {
    urgencyLevel = 'warning'
  }

  return { minutes: Math.floor(Math.abs(remaining)), isOverdue, urgencyLevel }
}

function SLABadge({ item }: { item: WorkItem }) {
  const [timeInfo, setTimeInfo] = useState(() => getTimeRemaining(item.created_at, item.sla_minutes))

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeInfo(getTimeRemaining(item.created_at, item.sla_minutes))
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [item.created_at, item.sla_minutes])

  const { minutes, isOverdue, urgencyLevel } = timeInfo

  const colorClass = {
    safe: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-orange-100 text-orange-800',
    overdue: 'bg-red-100 text-red-800'
  }[urgencyLevel]

  return (
    <span className={`px-2 py-1 text-xs rounded font-medium ${colorClass}`}>
      {isOverdue ? `+${minutes}m` : `${minutes}m left`}
    </span>
  )
}

export default function WorkQueue() {
  const { role } = useAuth()
  
  // Filter work items based on role
  const getRelevantItems = (items: WorkItem[]) => {
    switch (role) {
      case 'DOCTOR':
        return items.filter(item => ['consult', 'rx', 'lab_result'].includes(item.type))
      case 'PHARMACIST':
        return items.filter(item => item.type === 'rx')
      case 'LAB_TECH':
        return items.filter(item => ['lab_order', 'lab_result'].includes(item.type))
      case 'MARKETER':
        return items.filter(item => item.type === 'consult')
      default:
        return []
    }
  }

  const workItems = getRelevantItems(mockWorkItems)
  const overdue = workItems.filter(item => getTimeRemaining(item.created_at, item.sla_minutes).isOverdue)
  const urgent = workItems.filter(item => item.priority === 'urgent')

  const getItemLink = (item: WorkItem) => {
    switch (item.type) {
      case 'consult': return `/consults/${item.id}`
      case 'rx': return `/rx/${item.id}`
      case 'lab_order': return `/lab-orders/${item.id}`
      case 'lab_result': return `/lab-results/${item.id}`
      default: return '#'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'consult': return '👩‍⚕️'
      case 'rx': return '💊'
      case 'lab_order': return '🧪'
      case 'lab_result': return '📋'
      default: return '📄'
    }
  }

  if (workItems.length === 0) {
    return (
      <div className="bg-white rounded shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Work Queue</h2>
        <p className="text-gray-500">No pending items</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded shadow">
      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Work Queue</h2>
          <div className="flex gap-4 text-sm">
            {overdue.length > 0 && (
              <span className="text-red-600 font-medium">
                {overdue.length} overdue
              </span>
            )}
            {urgent.length > 0 && (
              <span className="text-orange-600 font-medium">
                {urgent.length} urgent
              </span>
            )}
            <span className="text-gray-600">
              {workItems.length} total
            </span>
          </div>
        </div>
      </div>
      
      <div className="divide-y">
        {workItems.map((item) => (
          <Link key={item.id} href={getItemLink(item)}>
            <div className="p-4 hover:bg-gray-50 cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{getTypeIcon(item.type)}</span>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-gray-600 capitalize">
                      {item.type.replace('_', ' ')} • {item.status}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded ${
                    item.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                    item.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                    item.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {item.priority}
                  </span>
                  <SLABadge item={item} />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
