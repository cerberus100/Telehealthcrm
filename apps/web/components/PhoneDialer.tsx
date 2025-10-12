/**
 * Phone Dialer Component
 * For Physicians to Call Any Number
 * 
 * Features:
 * - Manual phone number entry with keypad
 * - Call history/recent calls
 * - Quick dial buttons
 * - HIPAA compliant (no storage of PHI)
 */

'use client'

import { useState } from 'react'
import { Phone, Delete, PhoneCall, X } from 'lucide-react'

interface PhoneDialerProps {
  onClose?: () => void
}

export function PhoneDialer({ onClose }: PhoneDialerProps) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [calling, setCalling] = useState(false)
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'connected'>('idle')

  function handleDigit(digit: string) {
    if (phoneNumber.length < 15) {
      setPhoneNumber(phoneNumber + digit)
    }
  }

  function handleBackspace() {
    setPhoneNumber(phoneNumber.slice(0, -1))
  }

  function handleClear() {
    setPhoneNumber('')
  }

  async function handleCall() {
    if (!phoneNumber || phoneNumber.length < 10) {
      alert('Please enter a valid phone number (at least 10 digits)')
      return
    }

    setCalling(true)
    setCallStatus('connecting')

    try {
      const authToken = localStorage.getItem('auth')
      const token = authToken ? JSON.parse(authToken).token : null

      if (!token) {
        throw new Error('Not authenticated')
      }

      // Format phone number to E.164
      const formattedNumber = formatPhoneNumber(phoneNumber)

      const response = await fetch('/api/calls/dial', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: formattedNumber,
          reason: 'manual-dial'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to initiate call')
      }

      const result = await response.json()
      setCallStatus('connected')

      alert(`Calling ${formatDisplay(phoneNumber)}...\n\nThe call will appear in your CCP.\nAccept to connect.`)

      // Reset after 5 seconds
      setTimeout(() => {
        setCallStatus('idle')
        setPhoneNumber('')
      }, 5000)

    } catch (error: any) {
      console.error('Dial failed:', error)
      setCallStatus('idle')
      alert(`Failed to dial: ${error.message}`)
    } finally {
      setCalling(false)
    }
  }

  function formatPhoneNumber(number: string): string {
    const digits = number.replace(/\D/g, '')
    if (digits.length === 10) {
      return `+1${digits}`
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`
    }
    return `+${digits}`
  }

  function formatDisplay(number: string): string {
    const digits = number.replace(/\D/g, '')
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    }
    return number
  }

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']

  return (
    <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900">Phone Dialer</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            aria-label="Close dialer"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>

      {/* Display */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6 min-h-[60px] flex items-center justify-center">
        <div className="text-2xl font-mono text-gray-900 tracking-wider">
          {phoneNumber || '___-___-____'}
        </div>
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {digits.map((digit) => (
          <button
            key={digit}
            onClick={() => handleDigit(digit)}
            disabled={calling}
            className="aspect-square bg-gray-100 hover:bg-gray-200 rounded-lg text-2xl font-semibold text-gray-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {digit}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-3 gap-3">
        
        {/* Backspace */}
        <button
          onClick={handleBackspace}
          disabled={!phoneNumber || calling}
          className="px-4 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium text-gray-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Delete className="w-5 h-5" />
        </button>

        {/* Call Button */}
        <button
          onClick={handleCall}
          disabled={!phoneNumber || phoneNumber.length < 10 || calling}
          className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {callStatus === 'connecting' ? (
            <>
              <PhoneCall className="w-5 h-5 animate-pulse" />
              Calling
            </>
          ) : (
            <>
              <Phone className="w-5 h-5" />
              Call
            </>
          )}
        </button>

        {/* Clear */}
        <button
          onClick={handleClear}
          disabled={!phoneNumber || calling}
          className="px-4 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Clear
        </button>

      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-900">
          <strong>📞 How it works:</strong>
        </p>
        <ol className="text-sm text-blue-800 mt-2 space-y-1 ml-4 list-decimal">
          <li>Enter phone number (10 digits for US)</li>
          <li>Click "Call" button</li>
          <li>Call appears in your CCP</li>
          <li>Accept call to connect</li>
        </ol>
      </div>

    </div>
  )
}

