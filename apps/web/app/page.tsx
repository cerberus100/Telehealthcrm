'use client'

import { useQuery } from '@tanstack/react-query'
import { Api } from '../lib/api'
import { Protected, useAuth, canViewOperationalMetrics } from '../lib/auth'
import WorkQueue from '../components/WorkQueue'
import { KpiTile } from '../components/KpiTile'
import { Sparkline } from '../components/Sparkline'

export default function HomePage() {
  const { role } = useAuth()
  const { data, isLoading, error } = useQuery({
    queryKey: ['me'],
    queryFn: Api.me,
  })

  const { data: dashboardMetrics } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: Api.dashboardMetrics,
  })

  const { data: operationalMetrics } = useQuery({
    queryKey: ['operational-metrics'],
    queryFn: Api.operationalMetrics,
    enabled: canViewOperationalMetrics(role), // Only fetch if user has permission
  })

  return (
    <Protected>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
        
        {/* KPI Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {dashboardMetrics?.consultsApproved && (
            <KpiTile 
              title="Consults Approved" 
              value={dashboardMetrics.consultsApproved.value} 
              delta={dashboardMetrics.consultsApproved.delta} 
              trend={dashboardMetrics.consultsApproved.trend}
            >
              <Sparkline points={dashboardMetrics.consultsApproved.sparkline} color="#16A34A" />
            </KpiTile>
          )}
          {canViewOperationalMetrics(role) && operationalMetrics?.avgTurnaroundTime && (
            <KpiTile 
              title="Avg TAT" 
              value={operationalMetrics.avgTurnaroundTime.value} 
              suffix={operationalMetrics.avgTurnaroundTime.suffix}
              delta={operationalMetrics.avgTurnaroundTime.delta} 
              trend={operationalMetrics.avgTurnaroundTime.trend}
            >
              <Sparkline points={operationalMetrics.avgTurnaroundTime.sparkline} color="#007DB8" />
            </KpiTile>
          )}
          {role !== 'DOCTOR' && dashboardMetrics?.kitsInTransit && (
            <KpiTile 
              title="Kits In Transit" 
              value={dashboardMetrics.kitsInTransit.value} 
              delta={dashboardMetrics.kitsInTransit.delta} 
              trend={dashboardMetrics.kitsInTransit.trend}
            >
              <Sparkline points={dashboardMetrics.kitsInTransit.sparkline} color="#4DAFE0" />
            </KpiTile>
          )}
          {dashboardMetrics?.resultsAging && (
            <KpiTile 
              title="Results Aging >24h" 
              value={dashboardMetrics.resultsAging.value} 
              delta={dashboardMetrics.resultsAging.delta} 
              trend={dashboardMetrics.resultsAging.trend}
            >
              <Sparkline points={dashboardMetrics.resultsAging.sparkline} color="#DC2626" />
            </KpiTile>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Work Queue Widget */}
          <WorkQueue />
          
          {/* Profile Card */}
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-xl font-semibold mb-4">Profile</h2>
            
            {isLoading && <div className="text-gray-500">Loading...</div>}
            {error && <div className="text-red-600">Error loading profile</div>}
            
            {data && (
              <div className="space-y-2">
                <p><strong>Email:</strong> {data.user.email}</p>
                <p><strong>Role:</strong> {data.user.role}</p>
                <p><strong>Organization:</strong> {data.org.name} ({data.org.type})</p>
                {data.user.last_login_at && (
                  <p><strong>Last Login:</strong> {new Date(data.user.last_login_at).toLocaleString()}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Role-specific quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {role === 'DOCTOR' && (
            <div className="bg-brand-50 p-4 rounded border border-brand-200">
              <h3 className="font-semibold text-brand-800 mb-2">Quick Actions</h3>
              <div className="space-y-1">
                <a href="/consults" className="block text-brand-600 hover:underline">Review Consults</a>
                <a href="/rx" className="block text-brand-600 hover:underline">Sign Prescriptions</a>
                <a href="/lab-results" className="block text-brand-600 hover:underline">Review Lab Results</a>
              </div>
            </div>
          )}
          
          {role === 'PHARMACIST' && (
            <div className="bg-green-50 p-4 rounded border border-green-200">
              <h3 className="font-semibold text-green-800 mb-2">Pharmacy Actions</h3>
              <div className="space-y-1">
                <a href="/rx" className="block text-green-600 hover:underline">Process Prescriptions</a>
                <a href="/shipments" className="block text-green-600 hover:underline">Track Shipments</a>
              </div>
            </div>
          )}
          
          {role === 'LAB_TECH' && (
            <div className="bg-purple-50 p-4 rounded border border-purple-200">
              <h3 className="font-semibold text-purple-800 mb-2">Lab Actions</h3>
              <div className="space-y-1">
                <a href="/lab-orders" className="block text-purple-600 hover:underline">Process Orders</a>
                <a href="/lab-results" className="block text-purple-600 hover:underline">Upload Results</a>
                <a href="/shipments" className="block text-purple-600 hover:underline">Ship Kits</a>
              </div>
            </div>
          )}
          
          {role === 'MARKETER' && (
            <div className="bg-orange-50 p-4 rounded border border-orange-200">
              <h3 className="font-semibold text-orange-800 mb-2">Marketing Actions</h3>
              <div className="space-y-1">
                <a href="/consults" className="block text-orange-600 hover:underline">Track Consults</a>
                <a href="/clients" className="block text-orange-600 hover:underline">Manage Clients</a>
                <a href="/requisitions" className="block text-orange-600 hover:underline">Use Templates</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </Protected>
  )
}
