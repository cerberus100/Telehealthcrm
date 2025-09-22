"use client"
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../lib/auth'
import { Api } from '../../../lib/api'
import Link from 'next/link'
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
      <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">{title}</p>
            <p className="text-2xl font-semibold text-slate-900">{value}</p>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
          {urgentCount > 0 && (
            <div className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {urgentCount} urgent
            </div>
          )}
        </div>
      </div>
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
  const statusColors = {
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    info: 'bg-brand-100 text-brand-800',
  }

  return (
    <Link href={href} className="block hover:bg-slate-50 px-4 py-3 rounded-md">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-900">{title}</p>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status]}`}>
            {status}
          </span>
          <span className="text-xs text-slate-400">{time}</span>
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate">
            Provider Dashboard
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Welcome back! Here's what needs your attention today.
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <ProviderAvailability />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <DashboardCard
          title="My Patients"
          value={dashboardData?.myPatients || 0}
          subtitle="Active patients"
          href="/patients"
        />
        <DashboardCard
          title="Consults to Review"
          value={dashboardData?.consultsToReview || 0}
          subtitle="Pending approval"
          href="/consults?status=pending"
          urgentCount={1}
        />
        <DashboardCard
          title="Rx to Sign"
          value={dashboardData?.rxToSign || 0}
          subtitle="Awaiting signature"
          href="/rx?status=draft"
          urgentCount={dashboardData?.rxToSign || 0}
        />
        <DashboardCard
          title="Results Arrived"
          value={dashboardData?.resultsArrived || 0}
          subtitle="New lab results"
          href="/lab-results?status=new"
          urgentCount={2}
        />
        <DashboardCard
          title="Recent Activity"
          value="2h ago"
          subtitle="Last patient interaction"
          href="/patients"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-medium text-slate-900">Recent Activity</h3>
          </div>
          <div className="p-2">
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
          <div className="px-6 py-3 border-t border-slate-200">
            <Link href="/activity" className="text-sm text-brand-600 hover:text-brand-700">
              View all activity →
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-medium text-slate-900">Quick Actions</h3>
          </div>
          <div className="p-6 space-y-4">
            <Link
              href="/consults/new"
              className="flex items-center p-4 border border-slate-200 rounded-lg hover:border-brand-300 hover:bg-brand-50 transition-colors"
            >
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-900">New Consult</p>
                <p className="text-sm text-slate-500">Start a new patient consultation</p>
              </div>
            </Link>

            <Link
              href="/rx/compose"
              className="flex items-center p-4 border border-slate-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors"
            >
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-900">Compose Prescription</p>
                <p className="text-sm text-slate-500">Write and e-sign prescription</p>
              </div>
            </Link>

            <Link
              href="/lab-orders/new"
              className="flex items-center p-4 border border-slate-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
            >
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-900">Order Labs</p>
                <p className="text-sm text-slate-500">Request laboratory tests</p>
              </div>
            </Link>

            <Link
              href="/patients/search"
              className="flex items-center p-4 border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition-colors"
            >
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-900">Find Patient</p>
                <p className="text-sm text-slate-500">Search by name, MRN, or phone</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
