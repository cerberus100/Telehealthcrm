"use client"
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../lib/auth'
import { Api } from '../../../lib/api'
import Link from 'next/link'
import { Card } from '../../../components/Card'
import { Badge } from '../../../components/Badge'
import { Topbar } from '../../../components/Topbar'
import ProviderAvailability from '../../../components/ProviderAvailability'

// Provider Dashboard KPI Cards
function DashboardCard({
  title,
  value,
  subtitle,
  href,
  urgentCount = 0
}: {
  title: string
  value: string | number
  subtitle: string
  href: string
  urgentCount?: number
}) {
  return (
    <Link href={href} className="block">
      <Card className="flex flex-col gap-2 justify-between h-full hover:shadow-lg transition-shadow focus-gold">
        <div className="h2">{title}</div>
        <div className="text-3xl font-semibold text-foreground">{value}</div>
        <div className="flex items-center justify-between">
          <span className="meta">{subtitle}</span>
          {urgentCount > 0 && (
            <Badge variant="urgent">{urgentCount} urgent</Badge>
          )}
        </div>
      </Card>
    </Link>
  )
}

// Recent Activity Item
function ActivityItem({
  title,
  subtitle,
  time,
  href,
  status
}: {
  title: string
  subtitle: string
  time: string
  href: string
  status: 'success' | 'warning' | 'info'
}) {
  const statusVariant = status === 'success' ? 'success' :
                       status === 'warning' ? 'warn' : 'info'

  return (
    <Link href={href} className="block hover:bg-[rgba(46,59,45,0.035)] p-4 rounded-lg focus-gold">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-sm meta">{subtitle}</p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant={statusVariant}>{status}</Badge>
          <span className="text-xs meta">{time}</span>
        </div>
      </div>
    </Link>
  )
}

export default function ProviderDashboard() {
  const { role, orgId } = useAuth()

  // Mock data for dashboard - replace with actual API calls
  const { data: dashboardData } = useQuery({
    queryKey: ['provider-dashboard', orgId],
    queryFn: () => Promise.resolve({
      myPatients: 47,
      consultsToReview: 3,
      rxToSign: 2,
      resultsArrived: 5,
      kitsInTransit: 8,
      recentActivity: [
        {
          id: '1',
          title: 'Lab Result - COVID-19 Panel',
          subtitle: 'Patient: Jane D. - Negative',
          time: '2 hours ago',
          href: '/lab-results/1',
          status: 'success' as const,
        },
        {
          id: '2',
          title: 'Prescription Signed',
          subtitle: 'Amoxicillin 500mg - John S.',
          time: '4 hours ago',
          href: '/rx/2',
          status: 'info' as const,
        },
        {
          id: '3',
          title: 'Consult Approved',
          subtitle: 'Telehealth Visit - Mary K.',
          time: '6 hours ago',
          href: '/consults/3',
          status: 'success' as const,
        },
      ],
    }),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <Topbar>
        Signed in as dr@demo.health (DOCTOR)
      </Topbar>

      <div className="content-wrapper py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="h1 mb-2">Provider Dashboard</h1>
          <p className="meta">Welcome back! Here's what needs your attention today.</p>
        </div>

        {/* 12-Column Grid Layout */}
        <div className="grid grid-cols-12 gap-6">
          {/* Dashboard top metrics (4 cols) */}
          <div className="col-span-12 md:col-span-3">
            <Card padding="md">
              <div className="flex flex-col gap-2 justify-between h-full">
                <div className="h2">My Patients</div>
                <div className="text-3xl font-semibold text-foreground">{dashboardData?.myPatients || 0}</div>
                <div className="flex items-center justify-between">
                  <span className="meta">Active patients</span>
                </div>
              </div>
            </Card>
          </div>

          <div className="col-span-12 md:col-span-3">
            <Card padding="md">
              <div className="flex flex-col gap-2 justify-between h-full">
                <div className="h2">Consults to Review</div>
                <div className="text-3xl font-semibold text-foreground">{dashboardData?.consultsToReview || 0}</div>
                <div className="flex items-center justify-between">
                  <span className="meta">Pending approval</span>
                  <span className="badge badge-urgent">1 urgent</span>
                </div>
              </div>
            </Card>
          </div>

          <div className="col-span-12 md:col-span-3">
            <Card padding="md">
              <div className="flex flex-col gap-2 justify-between h-full">
                <div className="h2">Rx to Sign</div>
                <div className="text-3xl font-semibold text-foreground">{dashboardData?.rxToSign || 0}</div>
                <div className="flex items-center justify-between">
                  <span className="meta">Awaiting signature</span>
                  <span className="badge badge-urgent">{dashboardData?.rxToSign || 0} urgent</span>
                </div>
              </div>
            </Card>
          </div>

          <div className="col-span-12 md:col-span-3">
            <Card padding="md">
              <div className="flex flex-col gap-2 justify-between h-full">
                <div className="h2">Results Arrived</div>
                <div className="text-3xl font-semibold text-foreground">{dashboardData?.resultsArrived || 0}</div>
                <div className="flex items-center justify-between">
                  <span className="meta">New lab results</span>
                  <span className="badge badge-urgent">2 urgent</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Recent + Quick Actions */}
          <div className="col-span-12 md:col-span-7">
            <Card padding="md" className="h-full">
              <div className="h2 mb-4">Recent Activity</div>
              <div className="space-y-2">
                {dashboardData?.recentActivity?.map((activity) => (
                  <ActivityItem
                    key={activity.id}
                    title={activity.title}
                    subtitle={activity.subtitle}
                    time={activity.time}
                    href={activity.href}
                    status={activity.status}
                  />
                ))}
              </div>
              <div className="mt-6 pt-4 border-t border-[rgba(46,59,45,0.08)]">
                <Link href="/activity" className="link">
                  View all activity →
                </Link>
              </div>
            </Card>
          </div>

          <div className="col-span-12 md:col-span-5">
            <Card padding="md" className="h-full">
              <div className="h2 mb-4">Quick Actions</div>
              <div className="space-y-4">
                <Link
                  href="/consults/new"
                  className="flex items-center p-4 border border-[rgba(46,59,45,0.25)] rounded-xl hover:border-gold hover:bg-[rgba(199,168,103,0.05)] transition-colors focus:ring-2 focus:ring-[rgba(199,168,103,0.45)] focus:outline-none"
                >
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-[rgba(85,107,79,0.12)] rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-olive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-foreground">New Consult</p>
                    <p className="text-sm meta">Start a new patient consultation</p>
                  </div>
                </Link>

                <Link
                  href="/rx/compose"
                  className="flex items-center p-4 border border-[rgba(46,59,45,0.25)] rounded-xl hover:border-gold hover:bg-[rgba(199,168,103,0.05)] transition-colors focus:ring-2 focus:ring-[rgba(199,168,103,0.45)] focus:outline-none"
                >
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-[rgba(85,107,79,0.12)] rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-olive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-foreground">Compose Prescription</p>
                    <p className="text-sm meta">Write and e-sign prescription</p>
                  </div>
                </Link>

                <Link
                  href="/lab-orders/new"
                  className="flex items-center p-4 border border-[rgba(46,59,45,0.25)] rounded-xl hover:border-gold hover:bg-[rgba(199,168,103,0.05)] transition-colors focus:ring-2 focus:ring-[rgba(199,168,103,0.45)] focus:outline-none"
                >
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-[rgba(85,107,79,0.12)] rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-olive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-foreground">Order Labs</p>
                    <p className="text-sm meta">Request laboratory tests</p>
                  </div>
                </Link>

                <Link
                  href="/patients/search"
                  className="flex items-center p-4 border border-[rgba(46,59,45,0.25)] rounded-xl hover:border-gold hover:bg-[rgba(199,168,103,0.05)] transition-colors focus:ring-2 focus:ring-[rgba(199,168,103,0.45)] focus:outline-none"
                >
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-[rgba(46,59,45,0.08)] rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-foreground">Find Patient</p>
                    <p className="text-sm meta">Search by name, MRN, or phone</p>
                  </div>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
