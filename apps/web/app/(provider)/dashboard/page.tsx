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
            {label:'My Patients', value:'47', delta:'+5%', spark:'/sparklines/patients.svg'},
            {label:'Consults to Review', value:'3', delta:'1 urgent', spark:'/sparklines/consults.svg'},
            {label:'Rx to Sign', value:'2', delta:'2 urgent', spark:'/sparklines/rx.svg'},
            {label:'Results Arrived', value:'5', delta:'2 urgent', spark:'/sparklines/results.svg'},
          ].map((m,i)=>(
            <div key={i} className="col-span-12 md:col-span-3 stat">
              <div className="label">{m.label}</div>
              <img src={m.spark} alt="" className="h-6 w-24 opacity-80" />
              <div className="value">{m.value}</div>
              <div className="trend"><span className="badge badge-urgent">{m.delta}</span></div>
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
            <ul className="space-y-3">
              <li><button className="btn-primary w-full justify-start gap-2"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> New Consult</button></li>
              <li><button className="btn-primary w-full justify-start gap-2"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> Compose Prescription</button></li>
              <li><button className="btn-primary w-full justify-start gap-2"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg> Order Labs</button></li>
              <li><button className="btn-primary w-full justify-start gap-2"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> Find Patient</button></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
