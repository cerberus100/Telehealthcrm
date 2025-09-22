'use client'

import { useQuery } from '@tanstack/react-query'
import { Api } from '../../lib/api'
import { Protected, useAuth } from '../../lib/auth'
import Link from 'next/link'
import { Card } from '../../components/Card'
import { Badge } from '../../components/Badge'
import { DataTable, TableColumn } from '../../components/DataTable'
import { Topbar } from '../../components/Topbar'
import { Skeleton } from '../../components/Skeleton'
import { ErrorBanner } from '../../components/ErrorBanner'

interface LabResult {
  id: string
  lab_order_id: string
  flagged_abnormal: boolean | null
  released_to_provider_at: string | null
  result_blob_encrypted?: string
}

const statusVariants: Record<string, 'success' | 'warn' | 'info' | 'urgent'> = {
  'RELEASED': 'success',
  'PENDING': 'warn',
  'FLAGGED': 'urgent'
}

export default function LabResultsPage() {
  const { role } = useAuth()
  const { data, isLoading, error } = useQuery({
    queryKey: ['lab-results'],
    queryFn: Api.labResults,
  })

  // Role guard: Only Lab and Doctor can view
  const canView = role === 'LAB_TECH' || role === 'DOCTOR'

  if (!canView) {
    return (
      <Protected>
        <div className="min-h-screen bg-background">
          <Topbar>Signed in as dr@demo.health (DOCTOR)</Topbar>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <ErrorBanner
              title="Access denied"
              message="Only Lab and Provider personnel can view lab results."
              className="border-red-200"
            />
          </div>
        </div>
      </Protected>
    )
  }

  const columns: TableColumn<LabResult>[] = [
    {
      key: 'id',
      title: 'ID',
      width: '120px',
      render: (value) => (
        <Link href={`/lab-results/${value}`} className="link cell-mono">
          {value}
        </Link>
      )
    },
    {
      key: 'lab_order_id',
      title: 'Lab Order',
      render: (value) => (
        <Link href={`/lab-orders/${value}`} className="link">
          {value}
        </Link>
      )
    },
    {
      key: 'flagged_abnormal',
      title: 'Status',
      align: 'center',
      render: (value, record) => {
        if (record.flagged_abnormal) {
          return <Badge variant="urgent">Abnormal</Badge>
        }
        if (record.released_to_provider_at) {
          return <Badge variant="success">Released</Badge>
        }
        return <Badge variant="warn">Pending</Badge>
      }
    },
    {
      key: 'released_to_provider_at',
      title: 'Released',
      align: 'center',
      render: (value) => value ? new Date(value).toLocaleDateString() : '—'
    },
    {
      key: 'id',
      title: 'Actions',
      width: '100px',
      align: 'center',
      render: (value) => (
        <Link href={`/lab-results/${value}`} className="btn-premium text-sm focus-gold">
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
            title="Failed to load lab results"
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="h1 mb-2">Lab Results</h1>
          <p className="meta">Review and manage laboratory test results</p>
        </div>

        {/* Controls */}
        <Card className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-foreground">Filter by Status:</label>
              <select className="input-premium w-48">
                <option value="">All Results</option>
                <option value="released">Released</option>
                <option value="pending">Pending</option>
                <option value="abnormal">Abnormal</option>
              </select>
            </div>
            <Link href="/lab-orders/new" className="btn-premium">
              Order Tests
            </Link>
          </div>
        </Card>

        {/* Table */}
        <DataTable
          data={data.items}
          columns={columns}
          emptyMessage="No lab results found"
          emptyAction={<Link href="/lab-orders/new" className="btn-premium">Order First Test</Link>}
        />
      </div>
    </div>
  )
}
