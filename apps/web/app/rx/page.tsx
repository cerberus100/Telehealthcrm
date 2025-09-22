"use client"
import { useQuery } from '@tanstack/react-query'
import { Api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import Link from 'next/link'
import { Card } from '../../components/Card'
import { Badge } from '../../components/Badge'
import { DataTable, TableColumn } from '../../components/DataTable'
import { Topbar } from '../../components/Topbar'
import { Skeleton } from '../../components/Skeleton'
import { ErrorBanner } from '../../components/ErrorBanner'

interface RxItem {
  id: string
  status: string
  consult_id: string
  pharmacy_org_id: string
  refills_allowed: number
  refills_used: number
}

const statusVariants: Record<string, 'success' | 'warn' | 'info' | 'urgent'> = {
  'DISPENSED': 'success',
  'SUBMITTED': 'info',
  'DRAFT': 'warn',
  'CANCELLED': 'urgent'
}

export default function RxPage() {
  const { role } = useAuth()
  if (!(role === 'DOCTOR' || role === 'PHARMACIST')) return <p>Access denied</p>

  const { data, isLoading, error } = useQuery({ queryKey: ['rx'], queryFn: Api.rxList })

  const columns: TableColumn<RxItem>[] = [
    {
      key: 'id',
      title: 'ID',
      width: '120px',
      render: (value) => (
        <Link href={`/rx/${value}`} className="link cell-mono">
          {value}
        </Link>
      )
    },
    {
      key: 'status',
      title: 'Status',
      render: (value) => (
        <Badge variant={statusVariants[value] || 'info'}>
          {value}
        </Badge>
      )
    },
    {
      key: 'refills_used',
      title: 'Refills',
      align: 'center',
      render: (value, record) => `${value}/${record.refills_allowed}`
    },
    {
      key: 'id',
      title: 'Actions',
      width: '100px',
      align: 'center',
      render: (value) => (
        <Link href={`/rx/${value}`} className="btn-premium text-sm focus-gold">
          View
        </Link>
      )
    }
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Topbar>Signed in as dr@demo.health (DOCTOR)</Topbar>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton variant="card" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Topbar>Signed in as dr@demo.health (DOCTOR)</Topbar>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ErrorBanner
            title="Failed to load prescriptions"
            message="Please try again or contact support if the problem persists."
            action={<button className="btn-premium">Retry</button>}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Topbar>Signed in as dr@demo.health (DOCTOR)</Topbar>

      <div className="content-wrapper py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="h1 mb-2">Prescriptions</h1>
          <p className="meta">Manage patient prescriptions and refills</p>
        </div>

        {/* Controls */}
        <Card className="p-5 md:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-foreground">Filter by Status:</label>
              <select className="input-premium w-48">
                <option value="">All Statuses</option>
                <option value="DRAFT">DRAFT</option>
                <option value="SUBMITTED">SUBMITTED</option>
                <option value="DISPENSED">DISPENSED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
            <Link href="/rx/compose" className="btn-premium">
              Compose Rx
            </Link>
          </div>
        </Card>

        {/* Table */}
        <table className="table">
          <thead>
            <tr className="h-12">
              <th className="text-left">ID</th>
              <th className="text-left">Status</th>
              <th className="text-center">Refills</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((rx) => (
              <tr key={rx.id} className="h-12">
                <td className="cell-mono">
                  <Link href={`/rx/${rx.id}`} className="link">
                    {rx.id}
                  </Link>
                </td>
                <td>
                  <span className={`badge ${statusVariants[rx.status] === 'success' ? 'badge-success' :
                                            statusVariants[rx.status] === 'warn' ? 'badge-warn' :
                                            statusVariants[rx.status] === 'urgent' ? 'badge-urgent' : 'badge-info'}`}>
                    {rx.status}
                  </span>
                </td>
                <td className="text-center meta">
                  {rx.refills_used}/{rx.refills_allowed}
                </td>
                <td className="text-center">
                  <Link href={`/rx/${rx.id}`} className="btn-premium text-sm">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.items.length === 0 && (
          <div className="text-center py-12">
            <p className="meta mb-4">No prescriptions found</p>
            <Link href="/rx/compose" className="btn-premium">
              Compose First Prescription
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
