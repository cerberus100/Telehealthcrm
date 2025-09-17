"use client"
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { useAuth } from '../../../../lib/auth'
import { useDocumentSigning } from '../../../../lib/webauthn'

// Patient profile tabs
type TabType = 'summary' | 'orders' | 'meds' | 'results' | 'notes' | 'docs'

function PatientHeader({ patient }: { patient: any }) {
  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="h-16 w-16 rounded-full bg-slate-300 flex items-center justify-center">
            <span className="text-xl font-medium text-slate-700">
              {patient?.name?.split(' ').map((n: string) => n[0]).join('') || 'P'}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {patient?.name || 'Loading...'}
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                PHI
              </span>
            </h1>
            <p className="text-sm text-slate-500">
              DOB: {patient?.dob ? new Date(patient.dob).toLocaleDateString() : 'N/A'} • 
              MRN: {patient?.mrn || 'N/A'} • 
              Phone: {patient?.phone || 'N/A'}
            </p>
            <div className="flex items-center space-x-2 mt-2">
              {patient?.hasActiveRx && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active Rx
                </span>
              )}
              {patient?.hasPendingLabs && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Pending Labs
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Next Best Action */}
        <div className="text-right">
          <div className="text-sm text-slate-500 mb-2">Next Best Action</div>
          {patient?.nextAction === 'review-results' && (
            <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium">
              Review Lab Results
            </button>
          )}
          {patient?.nextAction === 'sign-rx' && (
            <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium">
              Sign Prescription
            </button>
          )}
          {patient?.nextAction === 'approve-consult' && (
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium">
              Approve Consult
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function QuickActions({ patientId }: { patientId: string }) {
  const { signDocument, isSigning } = useDocumentSigning()
  const [showPortal, setShowPortal] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [saved, setSaved] = useState(false)

  const handleComposeRx = async () => {
    // TODO: Open Rx composer modal
    console.log('Compose Rx for patient:', patientId)
  }

  const handleOrderLabs = async () => {
    // TODO: Open lab order modal
    console.log('Order labs for patient:', patientId)
  }

  const handleAddNote = async () => {
    // TODO: Open note composer
    console.log('Add note for patient:', patientId)
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-slate-900 mb-4">Quick Actions</h3>
      <div className="space-y-3">
        <button
          onClick={handleComposeRx}
          className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Compose Rx
        </button>

        <button
          onClick={handleOrderLabs}
          className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          Request Labs
        </button>

        <button
          onClick={handleAddNote}
          className="w-full flex items-center justify-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Add Note
        </button>

        <button className="w-full flex items-center justify-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500" onClick={()=>setShowPortal(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Create Portal Login
        </button>
      </div>
      {showPortal && (
        <div role="dialog" aria-modal className="fixed inset-0 bg-black/30 flex items-center justify-center p-4" onClick={()=>setShowPortal(false)}>
          <div className="bg-white rounded shadow max-w-sm w-full p-4" onClick={(e)=>e.stopPropagation()}>
            <h2 className="font-semibold mb-2">Create Patient Portal Login</h2>
            <p className="text-xs text-slate-600 mb-3">HIPAA minimum necessary: do not include sensitive identifiers in usernames. Provide credentials securely to the patient.</p>
            <label className="text-sm">Username
              <input className="mt-1 w-full border rounded px-2 py-1" value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="e.g., jane.doe.1985" />
            </label>
            <label className="text-sm mt-2">Temporary password
              <input className="mt-1 w-full border rounded px-2 py-1" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Auto-generate or set" />
            </label>
            <div className="flex justify-end gap-2 mt-3">
              <button className="px-3 py-2 rounded border" onClick={()=>setShowPortal(false)}>Cancel</button>
              <button className="px-3 py-2 rounded text-white" style={{ backgroundColor: '#007DB8' }} onClick={()=>{ if (typeof window !== 'undefined') { const key = `portal_demo_${patientId}`; window.localStorage.setItem(key, JSON.stringify({ username, password, createdAt: new Date().toISOString() })); setSaved(true) } }}>Save</button>
            </div>
            {saved && <div className="text-xs text-green-700 mt-2">Saved. Share credentials with patient to log in at the Patient Portal.</div>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function PatientProfilePage() {
  const params = useParams()
  const patientId = params.id as string
  const [activeTab, setActiveTab] = useState<TabType>('summary')

  // Mock patient data - replace with actual API call
  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient-profile', patientId],
    queryFn: () => Promise.resolve({
      id: patientId,
      name: 'Jane Doe',
      dob: '1985-03-15',
      mrn: 'MRN12345',
      phone: '(555) 123-4567',
      email: 'jane.doe@email.com',
      address: '123 Main St, Austin, TX 78701',
      insurance: 'Blue Cross Blue Shield - Member ID: ABC123456',
      hasActiveRx: true,
      hasPendingLabs: true,
      nextAction: 'review-results',
      lastActivity: '2 hours ago',
    }),
  })

  const tabs = [
    { id: 'summary', name: 'Summary', icon: '📋' },
    { id: 'orders', name: 'Orders', icon: '🧪' },
    { id: 'meds', name: 'Medications', icon: '💊' },
    { id: 'results', name: 'Results', icon: '📊' },
    { id: 'notes', name: 'Notes', icon: '📝' },
    { id: 'docs', name: 'Documents', icon: '📁' },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Patient Header */}
      <PatientHeader patient={patient} />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Tabs */}
          <div className="bg-white shadow rounded-lg">
            <div className="border-b border-slate-200">
              <nav className="-mb-px flex space-x-8 px-6">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-brand-500 text-brand-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className="mr-2">{tab.icon}</span>
                    {tab.name}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'summary' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-slate-900">Patient Timeline</h3>
                  <div className="flow-root">
                    <ul className="-mb-8">
                      <li className="relative pb-8">
                        <div className="relative flex space-x-3">
                          <div className="flex-shrink-0">
                            <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center">
                              <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div>
                              <p className="text-sm text-slate-900">Lab results received</p>
                              <p className="text-sm text-slate-500">COVID-19 Panel - Negative</p>
                            </div>
                            <div className="mt-2 text-sm text-slate-700">
                              <p>Results show negative for COVID-19. Patient can return to normal activities.</p>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-sm text-slate-500">
                            2h ago
                          </div>
                        </div>
                      </li>
                      <li className="relative pb-8">
                        <div className="relative flex space-x-3">
                          <div className="flex-shrink-0">
                            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                              <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div>
                              <p className="text-sm text-slate-900">Prescription signed</p>
                              <p className="text-sm text-slate-500">Amoxicillin 500mg - 10 days</p>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-sm text-slate-500">
                            1d ago
                          </div>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-slate-900">Lab Orders</h3>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-600">No lab orders found for this patient.</p>
                  </div>
                </div>
              )}

              {activeTab === 'meds' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-slate-900">Medications</h3>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-600">No active medications found for this patient.</p>
                  </div>
                </div>
              )}

              {activeTab === 'results' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-slate-900">Lab Results</h3>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-600">No lab results found for this patient.</p>
                  </div>
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-slate-900">Provider Notes</h3>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-600">No notes found for this patient.</p>
                  </div>
                </div>
              )}

              {activeTab === 'docs' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-slate-900">Patient Folder</h3>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-600">No documents found for this patient.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Rail - Quick Actions */}
        <div className="lg:col-span-1">
          <QuickActions patientId={patientId} />
        </div>
      </div>
    </div>
  )
}
