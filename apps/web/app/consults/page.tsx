"use client"
import { useMemo, useState } from 'react'
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

interface Consult {
  id: string
  status: string
  created_at: string
  provider_org_id: string
}

const statusVariants: Record<string, 'success' | 'warn' | 'info' | 'urgent'> = {
  'APPROVED': 'success',
  'PASSED': 'success',
  'PENDING': 'warn',
  'FAILED': 'urgent',
  'DECLINED': 'urgent'
}

export default function ConsultsPage() {
  const { role } = useAuth()
  if (role !== 'DOCTOR' && role !== 'SUPER_ADMIN') return <p>Access denied</p>

  const [status, setStatus] = useState<string>('')
  const { data, isLoading, error } = useQuery({ queryKey: ['consults'], queryFn: Api.consults })

  const columns: TableColumn<Consult>[] = [
    {
      key: 'id',
      title: 'ID',
      width: '120px',
      render: (value) => (
        <Link href={`/consults/${value}`} className="link cell-mono">
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
      key: 'created_at',
      title: 'Created',
      render: (value) => new Date(value).toLocaleString()
    },
    {
      key: 'id',
      title: 'Actions',
      width: '100px',
      align: 'center',
      render: (value) => (
        <Link href={`/consults/${value}`} className="btn-premium text-sm focus-gold">
          Open
        </Link>
      )
    }
  ]

  const filteredData = useMemo(() => {
    if (!data) return []
    return data.items.filter((c: Consult) => (status ? c.status === status : true))
  }, [data, status])

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
            title="Failed to load consults"
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

      <div className="container-eu py-8">
        {/* Page Header */}
        <h1 className="h1 mb-4">Consults</h1>
        <p className="meta mb-6">Manage patient consultations and reviews</p>

        {/* Controls */}
        <Card className="card-pad mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-foreground">Filter by Status:</label>
              <select
                className="input-eu w-48"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="PENDING">PENDING</option>
                <option value="PASSED">PASSED</option>
                <option value="FAILED">FAILED</option>
                <option value="APPROVED">APPROVED</option>
                <option value="DECLINED">DECLINED</option>
              </select>
            </div>
            <Link href="/consults/new" className="btn-primary">
              New Consult
            </Link>
          </div>
        </Card>

        {/* Table */}
        <Card className="card-pad">
          <table className="table-eu">
            <thead>
              <tr>
                <th className="th-eu">ID</th>
                <th className="th-eu">STATUS</th>
                <th className="th-eu">CREATED</th>
                <th className="th-eu text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((consult) => (
                <tr key={consult.id} className="tr-eu">
                  <td className="td-eu id-mono">
                    <Link href={`/consults/${consult.id}`} className="link">
                      {consult.id}
                    </Link>
                  </td>
                  <td className="td-eu">
                    <span className={`badge badge-${statusVariants[consult.status] || 'info'}`}>
                      {consult.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="td-eu meta">
                    {new Date(consult.created_at).toLocaleString()}
                  </td>
                  <td className="td-eu text-right">
                    <Link href={`/consults/${consult.id}`} className="btn-pill">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {filteredData.length === 0 && (
          <div className="text-center py-12">
            <p className="meta mb-4">No consults found</p>
            <Link href="/consults/new" className="btn-primary">
              Create First Consult
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
