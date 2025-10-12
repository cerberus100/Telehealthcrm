/**
 * Click-to-Call Button Component
 * For Physician Patient Profiles
 * 
 * Features:
 * - One-click calling from patient record
 * - Shows call status (connecting, connected)
 * - Fallback to manual dialer if needed
 * - HIPAA compliant (no PHI in logs)
 */

'use client'

import { useState } from 'react'
import { Phone, PhoneCall, PhoneOff, Loader } from 'lucide-react'

interface ClickToCallButtonProps {
  patientId: string
  patientPhone: string
  patientName?: string
  consultId?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary'
}

export function ClickToCallButton({
  patientId,
  patientPhone,
  patientName,
  consultId,
  size = 'md',
  variant = 'primary'
}: ClickToCallButtonProps) {
  const [calling, setCalling] = useState(false)
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle')
  const [contactId, setContactId] = useState<string>('')

  async function handleCall() {
    setCalling(true)
    setCallStatus('connecting')

    try {
      // Get auth token
      const authToken = localStorage.getItem('auth')
      const token = authToken ? JSON.parse(authToken).token : null

      if (!token) {
        throw new Error('Not authenticated')
      }

      // Call backend API to initiate outbound call
      const response = await fetch('/api/calls/outbound', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          patientId,
          consultId,
          reason: 'physician-click-to-call'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to initiate call')
      }

      const result = await response.json()
      setContactId(result.contactId)
      setCallStatus('connected')

      // Show success message
      alert(`Calling ${patientName || 'patient'}...\n\nThe call will appear in your CCP.\nAccept the call to connect.`)

    } catch (error: any) {
      console.error('Call failed:', error)
      setCallStatus('failed')
      alert(`Failed to initiate call: ${error.message}\n\nPlease try again or use the manual dialer.`)
    } finally {
      setCalling(false)
      // Reset after 5 seconds
      setTimeout(() => setCallStatus('idle'), 5000)
    }
  }

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  }

  const variantClasses = {
    primary: 'bg-green-600 hover:bg-green-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-700'
  }

  const iconSize = size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-5 h-5' : 'w-6 h-6'

  if (callStatus === 'connecting') {
    return (
      <button
        disabled
        className={`${sizeClasses[size]} ${variantClasses[variant]} rounded-lg font-medium flex items-center gap-2 opacity-75 cursor-not-allowed`}
      >
        <Loader className={`${iconSize} animate-spin`} />
        Connecting...
      </button>
    )
  }

  if (callStatus === 'connected') {
    return (
      <button
        disabled
        className={`${sizeClasses[size]} bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2 opacity-75`}
      >
        <PhoneCall className={`${iconSize} animate-pulse`} />
        Call Active
      </button>
    )
  }

  if (callStatus === 'failed') {
    return (
      <button
        onClick={handleCall}
        className={`${sizeClasses[size]} bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center gap-2`}
      >
        <PhoneOff className={iconSize} />
        Retry Call
      </button>
    )
  }

  return (
    <button
      onClick={handleCall}
      disabled={calling}
      className={`${sizeClasses[size]} ${variantClasses[variant]} rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
      title={`Call ${patientName || 'patient'} at ${patientPhone}`}
    >
      <Phone className={iconSize} />
      {size === 'sm' ? 'Call' : 'Call Patient'}
    </button>
  )
}

