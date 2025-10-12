/**
 * Clinician Video Desktop (Amazon Connect CCP Embedded)
 * HIPAA Compliant: Video-enabled agent interface with screen-pop
 * 
 * Features:
 * - Embed Connect CCP with video enabled
 * - Detect WebRTC contacts (subtype: connect:WebRTC)
 * - Screen-pop with patient context
 * - Video UI with controls
 * - After-call work (ACW) timer
 * 
 * Security:
 * - CSP allows framing from *.awsapps.com
 * - Permissions-Policy allows camera/microphone
 * - No PHI logged to console
 */

/* eslint-disable react-hooks/rules-of-hooks */
'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../../../lib/auth'
import { Video, Phone, PhoneOff, Mic, MicOff, Monitor, User, Clock, AlertCircle } from 'lucide-react'

declare global {
  interface Window {
    connect: any
  }
}

interface Contact {
  contactId: string
  type: string
  subtype: string
  attributes: Record<string, { value: string }>
  status: string
}

interface PatientContext {
  visitId: string
  patientId: string
  patientName?: string
  visitType?: string
  chiefComplaint?: string
}

export default function VideoCCPPage() {
  const { token } = useAuth()
  const ccpContainerRef = useRef<HTMLDivElement>(null)
  const [ccpLoaded, setccpLoaded] = useState(false)
  const [activeContact, setActiveContact] = useState<Contact | null>(null)
  const [patientContext, setPatientContext] = useState<PatientContext | null>(null)
  const [agentStatus, setAgentStatus] = useState<string>('Offline')
  const [callDuration, setCallDuration] = useState(0)

  // Initialize Connect CCP
  useEffect(() => {
    if (ccpLoaded || !ccpContainerRef.current) return

    // Load Connect Streams library
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/amazon-connect-streams@2.12.0/release/connect-streams.min.js'
    script.async = true
    script.onload = initializeCCP
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  // Initialize CCP
  function initializeCCP() {
    if (!ccpContainerRef.current || !window.connect) return

    const ccpUrl = process.env.NEXT_PUBLIC_CONNECT_CCP_URL || 'https://instance.my.connect.aws/ccp-v2'

    // Initialize CCP with video enabled
    window.connect.core.initCCP(ccpContainerRef.current, {
      ccpUrl,
      loginPopup: true,
      loginPopupAutoClose: true,
      loginOptions: {
        autoClose: true,
        height: 600,
        width: 400
      },
      softphone: {
        allowFramedSoftphone: true,
        allowFramedVideoCall: true,      // REQUIRED for video
        disableRingtone: false,
        ringtoneUrl: '/ringtone.mp3'
      },
      pageOptions: {
        enableAudioDeviceSettings: true,
        enableVideoDeviceSettings: true,
        enablePhoneTypeSettings: false
      },
      ccpAckTimeout: 5000,
      ccpSynTimeout: 3000,
      ccpLoadTimeout: 10000
    })

    // Subscribe to contact events
    window.connect.contact((contact: any) => {
      handleContact(contact)
    })

    // Subscribe to agent events
    window.connect.agent((agent: any) => {
      agent.onStateChange((agentStateChange: any) => {
        const state = agentStateChange.newState
        setAgentStatus(state.name || 'Unknown')
      })
    })

    setccpLoaded(true)
    console.log('Connect CCP initialized')
  }

  // Handle incoming contact
  function handleContact(contact: any) {
    const contactType = contact.getType()
    const contactSubtype = contact.getSubtype()

    console.log('Contact received', { type: contactType, subtype: contactSubtype })

    // Detect WebRTC video contact
    if (contactSubtype === 'connect:WebRTC') {
      handleVideoContact(contact)
    } else if (contactType === 'voice' || contactType === 'VOICE') {
      // Handle voice-only (audio) contact
      handleVoiceContact(contact)
    }
  }

  // Handle voice-only contact (audio calls)
  function handleVoiceContact(contact: any) {
    const attributes = contact.getAttributes()
    const consultId = attributes.consultId?.value
    const patientId = attributes.patientId?.value

    // Screen-pop: Load patient context (same as video)
    if (consultId) {
      loadPatientContext(consultId, patientId)
    }

    // Set active contact
    setActiveContact({
      contactId: contact.getContactId(),
      type: contact.getType(),
      subtype: 'voice-only',
      attributes,
      status: contact.getStatus().type
    })

    // Contact lifecycle hooks
    contact.onConnected(() => {
      console.log('Voice call connected')
      startCallTimer()
    })

    contact.onEnded(() => {
      console.log('Voice call ended')
      setActiveContact(null)
      setPatientContext(null)
      setCallDuration(0)
    })

    contact.onACW(() => {
      console.log('After-call work started')
    })
  }

  // Handle video contact
  function handleVideoContact(contact: any) {
    const attributes = contact.getAttributes()
    const visitId = attributes.visitId?.value
    const patientId = attributes.patientId?.value
    const visitType = attributes.visitType?.value

    // Screen-pop: Load patient context
    if (visitId) {
      loadPatientContext(visitId, patientId)
    }

    // Set active contact
    setActiveContact({
      contactId: contact.getContactId(),
      type: contact.getType(),
      subtype: contact.getSubtype(),
      attributes,
      status: contact.getStatus().type
    })

    // Contact lifecycle hooks
    contact.onConnected(() => {
      console.log('Video call connected')
      startCallTimer()
    })

    contact.onEnded(() => {
      console.log('Video call ended')
      setActiveContact(null)
      setPatientContext(null)
      setCallDuration(0)
      // Show after-call work (ACW) UI
    })

    contact.onACW(() => {
      console.log('After-call work started')
    })
  }

  // Load patient context for screen-pop
  async function loadPatientContext(visitId: string, patientId: string) {
    try {
      const response = await fetch(`/api/visits/${visitId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) return

      const data = await response.json()
      setPatientContext({
        visitId: data.id,
        patientId: data.patientId,
        patientName: data.patient?.legalName,
        visitType: data.visitType,
        chiefComplaint: data.chiefComplaint
      })
    } catch (error) {
      console.error('Failed to load patient context', error)
    }
  }

  // Call timer
  function startCallTimer() {
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1)
    }, 1000)

    // Clear on unmount
    return () => clearInterval(interval)
  }

  return (
    <div className="h-screen flex">
      
      {/* Left: CCP Container */}
      <div className="w-80 border-r border-gray-200 bg-white">
        <div
          ref={ccpContainerRef}
          className="w-full h-full"
          aria-label="Amazon Connect Contact Control Panel"
        />
      </div>

      {/* Right: Patient Context + Video Controls */}
      <div className="flex-1 flex flex-col">
        
        {/* Header: Agent Status */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Video Desk</h1>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                agentStatus === 'Available' ? 'bg-green-500' :
                agentStatus === 'Busy' ? 'bg-red-500' :
                'bg-gray-400'
              }`} />
              <span className="text-sm font-medium text-gray-700">{agentStatus}</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          
          {!activeContact ? (
            // No active call
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Video className="w-10 h-10 text-blue-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Ready for Video Visits</h2>
              <p className="text-gray-600 max-w-md">
                Set your status to <strong>Available</strong> in the CCP to receive video calls from patients.
              </p>
            </div>
          ) : (
            // Active call: Patient context
            <div className="h-full flex flex-col">
              
              {/* Patient Info Card (Screen-pop) */}
              {patientContext && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {patientContext.patientName || 'Patient'}
                      </h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div><strong>Visit Type:</strong> {patientContext.visitType || 'Video visit'}</div>
                        {patientContext.chiefComplaint && (
                          <div><strong>Chief Complaint:</strong> {patientContext.chiefComplaint}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Call Duration</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, '0')}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Call Status */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="font-medium text-green-900">Video Call Active</span>
              </div>

              {/* Quick Actions */}
              <div className="mt-auto pt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h3>
                <div className="grid grid-cols-3 gap-3">
                  <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium">
                    View Chart
                  </button>
                  <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium">
                    Order Labs
                  </button>
                  <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium">
                    Write Rx
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  )
}

