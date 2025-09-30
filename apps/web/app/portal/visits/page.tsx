/**
 * Patient Portal - Video Visits List
 * HIPAA Compliant: Patient can view their own scheduled visits
 * 
 * Features:
 * - List upcoming/past visits
 * - Join active visits (no token needed, uses Cognito session)
 * - Cancel/reschedule options
 * - Post-visit notes viewer
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../lib/auth'
import { Video, Clock, Calendar, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface Visit {
  id: string
  scheduledAt: string
  duration: number
  status: string
  clinician: {
    firstName: string
    lastName: string
  }
  visitType?: string
  canJoin: boolean
}

export default function VisitsPage() {
  const { token } = useAuth()
  const router = useRouter()
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming')

  useEffect(() => {
    async function loadVisits() {
      try {
        const response = await fetch('/api/visits', {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        })

        if (!response.ok) {
          throw new Error('Failed to load visits')
        }

        const data = await response.json()
        setVisits(data.items || [])
      } catch (error) {
        console.error('Failed to load visits', error)
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      loadVisits()
    }
  }, [token])

  // Filter visits
  const filteredVisits = visits.filter((visit) => {
    const isPast = new Date(visit.scheduledAt) < new Date()
    return filter === 'upcoming' ? !isPast : isPast
  })

  // Check if visit can be joined (10 min before - 1 hour after scheduled time)
  function canJoinVisit(visit: Visit): boolean {
    const now = new Date()
    const scheduled = new Date(visit.scheduledAt)
    const tenMinBefore = new Date(scheduled.getTime() - 10 * 60 * 1000)
    const oneHourAfter = new Date(scheduled.getTime() + 60 * 60 * 1000)

    return visit.status === 'SCHEDULED' && now >= tenMinBefore && now <= oneHourAfter
  }

  // Join visit
  function handleJoinVisit(visitId: string) {
    // Navigate to join page (will use Cognito session instead of token)
    router.push(`/portal/visits/${visitId}/join`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Video Visits</h1>
        <p className="text-gray-600">Scheduled telehealth appointments</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setFilter('upcoming')}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            filter === 'upcoming'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setFilter('past')}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            filter === 'past'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Past Visits
        </button>
      </div>

      {/* Visits List */}
      {filteredVisits.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            {filter === 'upcoming' ? 'No upcoming visits scheduled' : 'No past visits'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredVisits.map((visit) => {
            const joinable = canJoinVisit(visit)

            return (
              <div
                key={visit.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  
                  {/* Visit Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Dr. {visit.clinician.firstName} {visit.clinician.lastName}
                      </h3>
                      <StatusBadge status={visit.status} />
                    </div>

                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {new Date(visit.scheduledAt).toLocaleString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4" />
                        {visit.duration} minutes • {visit.visitType || 'Video visit'}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    {joinable && (
                      <button
                        onClick={() => handleJoinVisit(visit.id)}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2"
                      >
                        <Video className="w-4 h-4" />
                        Join Now
                      </button>
                    )}

                    {visit.status === 'SCHEDULED' && !joinable && (
                      <button
                        onClick={() => router.push(`/portal/visits/${visit.id}`)}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                      >
                        View Details
                      </button>
                    )}

                    {visit.status === 'COMPLETED' && (
                      <button
                        onClick={() => router.push(`/portal/visits/${visit.id}/notes`)}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                      >
                        View Notes
                      </button>
                    )}
                  </div>

                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    SCHEDULED: { icon: Clock, color: 'bg-blue-100 text-blue-700', label: 'Scheduled' },
    ACTIVE: { icon: Video, color: 'bg-green-100 text-green-700', label: 'In Progress' },
    COMPLETED: { icon: CheckCircle, color: 'bg-gray-100 text-gray-700', label: 'Completed' },
    CANCELLED: { icon: XCircle, color: 'bg-red-100 text-red-700', label: 'Cancelled' },
    NO_SHOW: { icon: AlertCircle, color: 'bg-amber-100 text-amber-700', label: 'No Show' },
    TECHNICAL: { icon: AlertCircle, color: 'bg-orange-100 text-orange-700', label: 'Technical Issue' }
  }

  const { icon: Icon, color, label } = config[status as keyof typeof config] || config.SCHEDULED

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  )
}

