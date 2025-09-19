"use client"
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../lib/auth'
import Link from 'next/link'

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
    <div className="bg-white rounded-lg shadow p-6">
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex space-x-4">
          <div className="flex-1">
            <label htmlFor="patient-search" className="sr-only">Search patients</label>
            <input
              id="patient-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Search: name:"Jane D" dob:1990 phone:555-1234 mrn:MRN123'
              className="block w-full border-slate-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
          <button
            type="submit"
            className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-md text-sm font-medium"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md text-sm font-medium"
          >
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200">
            <select className="border-slate-300 rounded-md text-sm">
              <option value="">All patients</option>
              <option value="seen-by-me">Seen by me</option>
              <option value="assigned-to-me">Assigned to me</option>
            </select>
            <select className="border-slate-300 rounded-md text-sm">
              <option value="">All time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
            <select className="border-slate-300 rounded-md text-sm">
              <option value="">Any status</option>
              <option value="open-consult">Has open consult</option>
              <option value="active-rx">Has active Rx</option>
              <option value="pending-results">Pending results</option>
            </select>
            <select className="border-slate-300 rounded-md text-sm">
              <option value="">Default sort</option>
              <option value="name">Name A-Z</option>
              <option value="last-activity">Last activity</option>
              <option value="last-visit">Last visit</option>
            </select>
          </div>
        )}
      </form>
    </div>
  )
}

// Patient table row
function PatientRow({ patient }: { patient: any }) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'inactive': return 'bg-slate-100 text-slate-800'
      default: return 'bg-slate-100 text-slate-800'
    }
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            <div className="h-10 w-10 rounded-full bg-slate-300 flex items-center justify-center">
              <span className="text-sm font-medium text-slate-700">
                {patient.name.split(' ').map((n: string) => n[0]).join('')}
              </span>
            </div>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-slate-900">{patient.name}</div>
            <div className="text-sm text-slate-500">DOB: {formatDate(patient.dob)}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-slate-900">{patient.mrn}</div>
        <div className="text-sm text-slate-500">{patient.phone}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(patient.status)}`}>
          {patient.status}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
        {patient.lastActivity}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
        {patient.nextAction}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <Link
          href={`/patients/${patient.id}`}
          className="text-brand-600 hover:text-brand-900"
        >
          View Profile
        </Link>
      </td>
    </tr>
  )
}

export default function PatientsPage() {
  const { orgId } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFilters, setSearchFilters] = useState({})

  // Mock patient data - replace with actual API call
  const { data: patients, isLoading } = useQuery({
    queryKey: ['provider-patients', orgId, searchQuery, searchFilters],
    queryFn: () => Promise.resolve([
      {
        id: '1',
        name: 'Jane Doe',
        dob: '1985-03-15',
        mrn: 'MRN12345',
        phone: '(555) 123-4567',
        status: 'active',
        lastActivity: '2 hours ago',
        nextAction: 'Review lab results',
      },
      {
        id: '2',
        name: 'John Smith',
        dob: '1978-11-22',
        mrn: 'MRN67890',
        phone: '(555) 987-6543',
        status: 'pending',
        lastActivity: '1 day ago',
        nextAction: 'Sign prescription',
      },
      {
        id: '3',
        name: 'Mary Johnson',
        dob: '1992-07-08',
        mrn: 'MRN11111',
        phone: '(555) 456-7890',
        status: 'active',
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate">
            My Patients
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Patients you have served or are assigned to
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <Link
            href="/patients/new"
            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Add Patient
          </Link>
        </div>
      </div>

      {/* Search */}
      <PatientSearchBar onSearch={handleSearch} />

      {/* Results */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-medium text-slate-900">
            {patients?.length || 0} patients found
          </h3>
        </div>
        
        {isLoading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto"></div>
            <p className="mt-2 text-sm text-slate-500">Loading patients...</p>
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Last Activity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Next Action
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {patients?.map((patient) => (
                  <PatientRow key={patient.id} patient={patient} />
                ))}
              </tbody>
            </table>
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
