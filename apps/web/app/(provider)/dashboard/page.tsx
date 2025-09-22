"use client"
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../lib/auth'
import { Api } from '../../../lib/api'
import Link from 'next/link'
import { Card } from '../../../components/Card'
import { Badge } from '../../../components/Badge'
import { Topbar } from '../../../components/Topbar'
import { Spark } from '../../../components/Spark'
import ProviderAvailability from '../../../components/ProviderAvailability'
import { Stethoscope, FileText, FlaskConical, Search } from 'lucide-react'

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
    <Link href={href} className="block hover:bg-[rgba(46,59,45,0.035)] p-4 rounded-lg focus:ring-2 focus:ring-[rgba(199,168,103,0.45)] focus:outline-none">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-sm meta">{subtitle}</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className={`badge badge-${statusVariant}`}>{status}</span>
          <span className="meta text-xs">{time}</span>
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

      <div className="container-eu py-8">
        {/* Page Header */}
        <h1 className="h1 mb-4">Provider Dashboard</h1>
        <p className="meta mb-6">Welcome back! Here's what needs your attention today.</p>

        {/* KPI Stats Grid */}
        <div className="grid grid-cols-12 gap-6 mb-6">
          {[
            {label:'My Patients', value:'47', delta:'+5%', dir:'up' as const},
            {label:'Consults to Review', value:'3', delta:'1 urgent', dir:'down' as const},
            {label:'Rx to Sign', value:'2', delta:'2 urgent', dir:'down' as const},
            {label:'Results Arrived', value:'5', delta:'2 urgent', dir:'up' as const},
          ].map((m,i)=>(
            <div key={i} className="col-span-12 md:col-span-3 stat">
              <div className="label">{m.label}</div>
              <Spark dir={m.dir} />
              <div className="value">{m.value}</div>
              <div className="trend">
                <span className={`badge ${m.delta.includes('urgent') ? 'badge-warn badge-urgent' : 'badge-info'}`}>{m.delta}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Activity + Quick Actions */}
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-7 card card-pad card-equal">
            <h2 className="h2 mb-2">Recent Activity</h2>
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
          </div>

          <div className="col-span-12 md:col-span-5 card card-pad card-equal">
            <h2 className="h2 mb-2">Quick Actions</h2>
            <div className="space-y-3">
              <button className="action-row focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(199,168,103,.45)]">
                <Stethoscope className="h-4 w-4 text-[color:var(--olive)]" />
                <span>New Consult</span>
              </button>
              <button className="action-row focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(199,168,103,.45)]">
                <FileText className="h-4 w-4 text-[color:var(--olive)]" />
                <span>Compose Prescription</span>
              </button>
              <button className="action-row focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(199,168,103,.45)]">
                <FlaskConical className="h-4 w-4 text-[color:var(--olive)]" />
                <span>Order Labs</span>
              </button>
              <button className="action-row focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(199,168,103,.45)]">
                <Search className="h-4 w-4 text-[color:var(--olive)]" />
                <span>Find Patient</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
