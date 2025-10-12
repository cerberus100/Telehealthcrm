/**
 * Patient Detail Page (Provider View)
 * 
 * Features:
 * - Patient demographics and medical history
 * - Click-to-call button (audio-only consultation)
 * - Schedule video visit button
 * - View past visits and consultations
 * - Quick actions (Rx, Labs, Notes)
 */

'use client'

import { use, useEffect, useState } from 'react'
import { useAuth } from '../../../../lib/auth'
import { ClickToCallButton } from '../../../../components/ClickToCallButton'
import { Video, Phone, FileText, Pill, FlaskConical, Calendar, User, Mail, MapPin, CreditCard } from 'lucide-react'

interface Patient {
  id: string
  legalName: string
  dob: string
  emails: string[]
  phones: string[]
  address: any
  insurancePolicy: any
}

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const { id: patientId } = resolvedParams
  const { token } = useAuth()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDialer, setShowDialer] = useState(false)

  useEffect(() => {
    async function loadPatient() {
      try {
        const response = await fetch(`/api/patients/${patientId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })

        if (!response.ok) {
          throw new Error('Failed to load patient')
        }

        const data = await response.json()
        setPatient(data)
      } catch (error) {
        console.error('Failed to load patient', error)
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      loadPatient()
    }
  }, [token, patientId])

  async function handleScheduleVideoVisit() {
    // TODO: Open video visit scheduling modal
    alert('Video visit scheduling - coming soon!')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">Patient not found</p>
      </div>
    )
  }

  const primaryPhone = patient.phones[0] || ''
  const primaryEmail = patient.emails[0] || ''

  return (
    <div className="max-w-6xl mx-auto p-6">
      
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between">
          
          {/* Patient Info */}
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{patient.legalName}</h1>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  DOB: {new Date(patient.dob).toLocaleDateString()}
                </div>
                {primaryPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {primaryPhone}
                  </div>
                )}
                {primaryEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {primaryEmail}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col gap-2">
            
            {/* Click-to-Call (Audio-Only) */}
            {primaryPhone && (
              <ClickToCallButton
                patientId={patient.id}
                patientPhone={primaryPhone}
                patientName={patient.legalName}
                size="md"
                variant="primary"
              />
            )}

            {/* Schedule Video Visit */}
            <button
              onClick={handleScheduleVideoVisit}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition"
            >
              <Video className="w-5 h-5" />
              Schedule Video Visit
            </button>

          </div>

        </div>
      </div>

      {/* Patient Details Grid */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        
        {/* Demographics */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Demographics
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Date of Birth</dt>
              <dd className="text-gray-900 font-medium">
                {new Date(patient.dob).toLocaleDateString()} 
                ({Math.floor((Date.now() - new Date(patient.dob).getTime()) / 31557600000)} years old)
              </dd>
            </div>
            {patient.address && (
              <div>
                <dt className="text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  Address
                </dt>
                <dd className="text-gray-900">
                  {patient.address.street}<br />
                  {patient.address.city}, {patient.address.state} {patient.address.zipCode}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Insurance */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Insurance
          </h2>
          {patient.insurancePolicy ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Plan Name</dt>
                <dd className="text-gray-900 font-medium">{patient.insurancePolicy.planName || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Payer</dt>
                <dd className="text-gray-900">{patient.insurancePolicy.payerCode || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Status</dt>
                <dd className={`font-medium ${patient.insurancePolicy.coverageActive ? 'text-green-600' : 'text-red-600'}`}>
                  {patient.insurancePolicy.coverageActive ? 'Active' : 'Inactive'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-gray-500 text-sm">No insurance information on file</p>
          )}
        </div>

      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        
        <button className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition border border-gray-200 flex flex-col items-center gap-2">
          <Pill className="w-6 h-6 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">Write Rx</span>
        </button>

        <button className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition border border-gray-200 flex flex-col items-center gap-2">
          <FlaskConical className="w-6 h-6 text-purple-600" />
          <span className="text-sm font-medium text-gray-700">Order Labs</span>
        </button>

        <button className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition border border-gray-200 flex flex-col items-center gap-2">
          <FileText className="w-6 h-6 text-green-600" />
          <span className="text-sm font-medium text-gray-700">Add Note</span>
        </button>

        <button 
          onClick={() => setShowDialer(!showDialer)}
          className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition border border-gray-200 flex flex-col items-center gap-2"
        >
          <Phone className="w-6 h-6 text-orange-600" />
          <span className="text-sm font-medium text-gray-700">Phone Dialer</span>
        </button>

      </div>

      {/* Phone Dialer (if opened) */}
      {showDialer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDialer(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <PhoneDialer onClose={() => setShowDialer(false)} />
          </div>
        </div>
      )}

      {/* Visit History */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Visit History</h2>
        <p className="text-gray-500 text-sm">No previous visits</p>
      </div>

    </div>
  )
}

// Import PhoneDialer component
import { PhoneDialer } from '../../../../components/PhoneDialer'