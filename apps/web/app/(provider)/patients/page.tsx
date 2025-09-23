"use client"
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../lib/auth'
import Link from 'next/link'
import { Card } from '../../../components/Card'
import { Badge } from '../../../components/Badge'
import { DataTable, TableColumn } from '../../../components/DataTable'
import { Topbar } from '../../../components/Topbar'
import { Skeleton } from '../../../components/Skeleton'
import { ErrorBanner } from '../../../components/ErrorBanner'

interface Patient {
  id: string
  name: string
  dob: string
  mrn: string
  phone: string
  status: 'active' | 'pending' | 'inactive'
  lastActivity: string
  nextAction: string
}

// Patient search with token parsing
function PatientSearchBar({
  onSearch
}: {
  onSearch: (query: string, filters: any) => void
}) {
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()

    // Parse search tokens: name:"Jane D" dob:1990 phone:555-1234 mrn:MRN123
    const tokens = parseSearchTokens(query)
    onSearch(query, tokens)
  }

  return (
    <Card className="card-pad">
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="patient-search" className="sr-only">Search patients</label>
            <input
              id="patient-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Search: name:"Jane D" dob:1990 phone:555-1234 mrn:MRN123'
              className="input-eu w-full"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="btn-primary"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="btn-secondary"
            >
              Filters
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-[rgba(46,59,45,0.08)]">
            <select className="input-eu">
              <option value="">All patients</option>
              <option value="seen-by-me">Seen by me</option>
              <option value="assigned-to-me">Assigned to me</option>
            </select>
            <select className="input-eu">
              <option value="">All time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
            <select className="input-eu">
              <option value="">Any status</option>
              <option value="open-consult">Has open consult</option>
              <option value="active-rx">Has active Rx</option>
              <option value="pending-results">Pending results</option>
            </select>
            <select className="input-eu">
              <option value="">Default sort</option>
              <option value="name">Name A-Z</option>
              <option value="last-activity">Last activity</option>
              <option value="last-visit">Last visit</option>
            </select>
          </div>
        )}
      </form>
    </Card>
  )
}

// Patient status variants
const statusVariants: Record<string, 'success' | 'warn' | 'info' | 'urgent'> = {
  'active': 'success',
  'pending': 'warn',
  'inactive': 'info'
}

export default function PatientsPage() {
  const { orgId } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFilters, setSearchFilters] = useState({})

  // Mock patient data - replace with actual API call
  const { data: patients, isLoading, error } = useQuery({
    queryKey: ['provider-patients', orgId, searchQuery, searchFilters],
    queryFn: () => Promise.resolve([
      {
        id: '1',
        name: 'Jane Doe',
        dob: '1985-03-15',
        mrn: 'MRN12345',
        phone: '(555) 123-4567',
        status: 'active' as const,
        lastActivity: '2 hours ago',
        nextAction: 'Review lab results',
      },
      {
        id: '2',
        name: 'John Smith',
        dob: '1978-11-22',
        mrn: 'MRN67890',
        phone: '(555) 987-6543',
        status: 'pending' as const,
        lastActivity: '1 day ago',
        nextAction: 'Sign prescription',
      },
      {
        id: '3',
        name: 'Mary Johnson',
        dob: '1992-07-08',
        mrn: 'MRN11111',
        phone: '(555) 456-7890',
        status: 'inactive' as const,
        lastActivity: '3 days ago',
        nextAction: 'Schedule follow-up',
      },
    ]),
    refetchInterval: 30000,
  })

  const handleSearch = (query: string, filters: any) => {
    setSearchQuery(query)
    setSearchFilters(filters)
  }

  const columns: TableColumn<Patient>[] = [
    {
      key: 'name',
      title: 'Patient',
      render: (value, record) => (
        <div>
          <div className="flex items-center">
            <div className="flex-shrink-0 h-8 w-8">
              <div className="h-8 w-8 rounded-full bg-[rgba(85,107,79,0.12)] flex items-center justify-center">
                <span className="text-sm font-medium text-olive">
                  {value.split(' ').map((n: string) => n[0]).join('')}
                </span>
              </div>
            </div>
            <div className="ml-3">
              <Link href={`/patients/${record.id}`} className="link font-medium">
                {value}
              </Link>
              <div className="meta text-xs">DOB: {new Date(record.dob).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'mrn',
      title: 'Contact',
      render: (value, record) => (
        <div>
          <div className="text-sm font-medium text-foreground cell-mono">{value}</div>
          <div className="meta text-sm">{record.phone}</div>
        </div>
      )
    },
    {
      key: 'status',
      title: 'Status',
      align: 'center',
      render: (value) => (
        <Badge variant={statusVariants[value] || 'info'}>
          {value}
        </Badge>
      )
    },
    {
      key: 'lastActivity',
      title: 'Last Activity',
      render: (value) => <span className="meta">{value}</span>
    },
    {
      key: 'nextAction',
      title: 'Next Action',
      render: (value) => <span className="meta">{value}</span>
    },
    {
      key: 'id',
      title: 'Actions',
      width: '100px',
      align: 'center',
      render: (value) => (
        <Link href={`/patients/${value}`} className="btn-premium text-sm focus-gold">
          View Profile
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

  if (error || !patients) {
    return (
      <div className="min-h-screen bg-background">
        <Topbar>Signed in as dr@demo.health (DOCTOR)</Topbar>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ErrorBanner
            title="Failed to load patients"
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="h1 mb-2">My Patients</h1>
            <p className="meta">Patients you have served or are assigned to</p>
          </div>
          <Link href="/patients/new" className="btn-primary">
            Add Patient
          </Link>
        </div>

        {/* Search */}
        <div className="mb-6">
          <PatientSearchBar onSearch={handleSearch} />
        </div>

        {/* Table */}
        <Card className="card-pad">
          <table className="table-eu">
            <thead>
              <tr>
                <th className="th-eu">PATIENT</th>
                <th className="th-eu">CONTACT</th>
                <th className="th-eu text-center">STATUS</th>
                <th className="th-eu">LAST ACTIVITY</th>
                <th className="th-eu">NEXT ACTION</th>
                <th className="th-eu text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id} className="tr-eu">
                  <td className="td-eu">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8">
                        <div className="h-8 w-8 rounded-full bg-[rgba(85,107,79,0.12)] flex items-center justify-center">
                          <span className="text-sm font-medium text-olive">
                            {patient.name.split(' ').map((n: string) => n[0]).join('')}
                          </span>
                        </div>
                      </div>
                      <div className="ml-3">
                        <Link href={`/patients/${patient.id}`} className="link font-medium">
                          {patient.name}
                        </Link>
                        <div className="meta text-xs">DOB: {new Date(patient.dob).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </td>
                  <td className="td-eu">
                    <div className="text-sm font-medium text-foreground id-mono">{patient.mrn}</div>
                    <div className="meta text-sm">{patient.phone}</div>
                  </td>
                  <td className="td-eu text-center">
                    <span className={`badge badge-${statusVariants[patient.status] || 'info'}`}>
                      {patient.status}
                    </span>
                  </td>
                  <td className="td-eu meta">{patient.lastActivity}</td>
                  <td className="td-eu meta">{patient.nextAction}</td>
                  <td className="td-eu text-right">
                    <Link href={`/patients/${patient.id}`} className="btn-pill">
                      View Profile
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {patients.length === 0 && (
          <div className="text-center py-12">
            <p className="meta mb-4">No patients found</p>
            <Link href="/patients/new" className="btn-primary">
              Add First Patient
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

// Parse search tokens from query string
function parseSearchTokens(query: string): Record<string, string> {
  const tokens: Record<string, string> = {}
  
  // Match patterns like name:"Jane D" dob:1990 phone:555-1234
  const tokenRegex = /(\w+):(?:"([^"]+)"|(\S+))/g
  let match

  while ((match = tokenRegex.exec(query)) !== null) {
    const [, key, quotedValue, unquotedValue] = match
    if (key) {
      tokens[key] = quotedValue || unquotedValue || ''
    }
  }

  // If no tokens found, treat entire query as name search
  if (Object.keys(tokens).length === 0 && query.trim()) {
    tokens.name = query.trim()
  }

  return tokens
}
