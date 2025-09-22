"use client"
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth, RequireRole } from '../../../lib/auth'
import { request } from '../../../lib/http'
import { z } from 'zod'

// Schema for signature events
const SignatureEventSchema = z.object({
  id: z.string(),
  actorUserId: z.string(),
  actorOrgId: z.string(),
  role: z.string(),
  entity: z.enum(['RX', 'LAB_ORDER', 'DOCUMENT']),
  entityId: z.string(),
  docSha256: z.string(),
  docS3Key: z.string(),
  signatureType: z.enum(['WEBAUTHN_KMS', 'TOTP_KMS', 'PASSWORD_KMS']),
  stepUpUsed: z.boolean(),
  mfaUsed: z.boolean(),
  ipAddress: z.string(),
  userAgent: z.string(),
  geoCountry: z.string().nullable(),
  createdAtUtc: z.string(),
})

const VerificationResultSchema = z.object({
  valid: z.boolean(),
  checks: z.object({
    hashMatch: z.boolean(),
    kmsSignatureValid: z.boolean(),
    tsaTokenValid: z.boolean(),
    chainValid: z.boolean(),
  }),
  errors: z.array(z.string()),
})

// Signature event row component
function SignatureEventRow({ 
  event, 
  onVerify, 
  onExport 
}: { 
  event: z.infer<typeof SignatureEventSchema>
  onVerify: (id: string) => void
  onExport: (id: string) => void
}) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getEntityIcon = (entity: string) => {
    switch (entity) {
      case 'RX': return '💊'
      case 'LAB_ORDER': return '🧪'
      case 'DOCUMENT': return '📄'
      default: return '📋'
    }
  }

  const getSignatureTypeColor = (type: string) => {
    switch (type) {
      case 'WEBAUTHN_KMS': return 'bg-green-100 text-green-800'
      case 'TOTP_KMS': return 'bg-brand-100 text-brand-800'
      case 'PASSWORD_KMS': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-slate-100 text-slate-800'
    }
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <span className="text-lg mr-2">{getEntityIcon(event.entity)}</span>
          <div>
            <div className="text-sm font-medium text-slate-900">{event.entity}</div>
            <div className="text-sm text-slate-500">{event.entityId.slice(0, 8)}...</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-slate-900">{event.actorUserId.slice(0, 8)}...</div>
        <div className="text-sm text-slate-500">{event.role}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSignatureTypeColor(event.signatureType)}`}>
          {event.signatureType.replace('_', ' ')}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center space-x-2">
          {event.stepUpUsed && (
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
              Step-up
            </span>
          )}
          {event.mfaUsed && (
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-brand-100 text-brand-800">
              MFA
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-slate-900">{event.ipAddress}</div>
        <div className="text-sm text-slate-500">{event.geoCountry || 'Unknown'}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
        {formatDate(event.createdAtUtc)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
        <button
          onClick={() => onVerify(event.id)}
          className="text-brand-600 hover:text-brand-900"
        >
          Verify
        </button>
        <button
          onClick={() => onExport(event.id)}
          className="text-slate-600 hover:text-slate-900"
        >
          Export
        </button>
      </td>
    </tr>
  )
}

// Verification modal
function VerificationModal({ 
  signatureEventId, 
  onClose 
}: { 
  signatureEventId: string | null
  onClose: () => void 
}) {
  const { data: verification, isLoading } = useQuery({
    queryKey: ['signature-verification', signatureEventId],
    queryFn: () => signatureEventId ? request(`/api/signatures/${signatureEventId}/verify`, VerificationResultSchema) : null,
    enabled: !!signatureEventId,
  })

  if (!signatureEventId) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-slate-900">Signature Verification</h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
            </div>
          ) : verification ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${verification.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${verification.valid ? 'bg-green-500' : 'bg-red-500'}`}>
                    {verification.valid ? (
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm font-medium ${verification.valid ? 'text-green-800' : 'text-red-800'}`}>
                      {verification.valid ? 'Signature Valid' : 'Signature Invalid'}
                    </p>
                    <p className={`text-sm ${verification.valid ? 'text-green-600' : 'text-red-600'}`}>
                      {verification.valid 
                        ? 'All cryptographic checks passed'
                        : `${verification.errors.length} verification errors`
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Verification Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-3 rounded ${verification.checks.hashMatch ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-center">
                    <span className={`w-4 h-4 mr-2 ${verification.checks.hashMatch ? 'text-green-600' : 'text-red-600'}`}>
                      {verification.checks.hashMatch ? '✓' : '✗'}
                    </span>
                    <span className="text-sm font-medium">Document Hash</span>
                  </div>
                </div>

                <div className={`p-3 rounded ${verification.checks.kmsSignatureValid ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-center">
                    <span className={`w-4 h-4 mr-2 ${verification.checks.kmsSignatureValid ? 'text-green-600' : 'text-red-600'}`}>
                      {verification.checks.kmsSignatureValid ? '✓' : '✗'}
                    </span>
                    <span className="text-sm font-medium">KMS Signature</span>
                  </div>
                </div>

                <div className={`p-3 rounded ${verification.checks.tsaTokenValid ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-center">
                    <span className={`w-4 h-4 mr-2 ${verification.checks.tsaTokenValid ? 'text-green-600' : 'text-red-600'}`}>
                      {verification.checks.tsaTokenValid ? '✓' : '✗'}
                    </span>
                    <span className="text-sm font-medium">Timestamp Token</span>
                  </div>
                </div>

                <div className={`p-3 rounded ${verification.checks.chainValid ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-center">
                    <span className={`w-4 h-4 mr-2 ${verification.checks.chainValid ? 'text-green-600' : 'text-red-600'}`}>
                      {verification.checks.chainValid ? '✓' : '✗'}
                    </span>
                    <span className="text-sm font-medium">Chain Hash</span>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {verification.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-red-800 mb-2">Verification Errors:</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    {verification.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-500">Failed to load verification results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SignatureAuditPage() {
  const { token } = useAuth()
  const [filters, setFilters] = useState({
    orgId: '',
    userId: '',
    entity: '',
    fromDate: '',
    toDate: '',
  })
  const [verifyingEventId, setVerifyingEventId] = useState<string | null>(null)

  // Fetch signature events
  const { data: events, isLoading, refetch } = useQuery({
    queryKey: ['signature-events', filters],
    queryFn: () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      
      return request(
        `/api/signatures/events?${params.toString()}`,
        z.object({ items: z.array(SignatureEventSchema) })
      )
    },
    refetchInterval: 30000,
  })

  const handleVerify = (signatureEventId: string) => {
    setVerifyingEventId(signatureEventId)
  }

  const handleExport = async (signatureEventId: string) => {
    try {
      const response = await fetch(`/api/signatures/${signatureEventId}/export`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `signature-evidence-${signatureEventId}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  return (
    <RequireRole allow={['SUPER_ADMIN']}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate">
              Signature Audit
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Cryptographic verification of all e-signatures for compliance
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button
              onClick={() => refetch()}
              className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-slate-900 mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label htmlFor="org-filter" className="block text-sm font-medium text-slate-700">Organization</label>
              <input
                id="org-filter"
                type="text"
                value={filters.orgId}
                onChange={(e) => setFilters(prev => ({ ...prev, orgId: e.target.value }))}
                placeholder="Organization ID"
                className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="user-filter" className="block text-sm font-medium text-slate-700">User</label>
              <input
                id="user-filter"
                type="text"
                value={filters.userId}
                onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value }))}
                placeholder="User ID"
                className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="entity-filter" className="block text-sm font-medium text-slate-700">Entity Type</label>
              <select
                id="entity-filter"
                value={filters.entity}
                onChange={(e) => setFilters(prev => ({ ...prev, entity: e.target.value }))}
                className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500 sm:text-sm"
              >
                <option value="">All types</option>
                <option value="RX">Prescriptions</option>
                <option value="LAB_ORDER">Lab Orders</option>
                <option value="DOCUMENT">Documents</option>
              </select>
            </div>
            <div>
              <label htmlFor="from-date" className="block text-sm font-medium text-slate-700">From Date</label>
              <input
                id="from-date"
                type="date"
                value={filters.fromDate}
                onChange={(e) => setFilters(prev => ({ ...prev, fromDate: e.target.value }))}
                className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="to-date" className="block text-sm font-medium text-slate-700">To Date</label>
              <input
                id="to-date"
                type="date"
                value={filters.toDate}
                onChange={(e) => setFilters(prev => ({ ...prev, toDate: e.target.value }))}
                className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500 sm:text-sm"
              />
            </div>
          </div>
        </div>

        {/* Signature Events Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-medium text-slate-900">
              Signature Events ({events?.items?.length || 0})
            </h3>
          </div>
          
          {isLoading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto"></div>
              <p className="mt-2 text-sm text-slate-500">Loading signature events...</p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Entity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Actor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Signature Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Auth Methods
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Signed At
                    </th>
                    <th className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {events?.items?.map((event) => (
                    <SignatureEventRow
                      key={event.id}
                      event={event}
                      onVerify={handleVerify}
                      onExport={handleExport}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Verification Modal */}
        <VerificationModal
          signatureEventId={verifyingEventId}
          onClose={() => setVerifyingEventId(null)}
        />
      </div>
    </RequireRole>
  )
}
