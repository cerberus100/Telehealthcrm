"use client"
import { useState } from 'react'
import { useWebAuthn } from '../lib/webauthn'
import { useAuth } from '../lib/auth'

interface WebAuthnEnrollmentProps {
  onEnrolled?: (credentialId: string) => void
  onCancel?: () => void
}

export default function WebAuthnEnrollment({ onEnrolled, onCancel }: WebAuthnEnrollmentProps) {
  const { enrollCredential, isEnrolling } = useWebAuthn()
  const { email } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'intro' | 'enrolling' | 'success' | 'error'>('intro')

  const handleEnroll = async () => {
    setError(null)
    setStep('enrolling')

    try {
      const result = await enrollCredential(
        email || 'user@example.com',
        'Healthcare Provider'
      )

      if (result.success) {
        setStep('success')
        onEnrolled?.(result.credentialId!)
      } else {
        setStep('error')
        setError(result.error || 'Enrollment failed')
      }
    } catch (err) {
      setStep('error')
      setError(err instanceof Error ? err.message : 'Enrollment failed')
    }
  }

  const getStepContent = () => {
    switch (step) {
      case 'intro':
        return (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-brand-100 mb-4">
              <svg className="h-6 w-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">Set Up Secure Signing</h3>
            <p className="text-sm text-slate-600 mb-6">
              Use TouchID, FaceID, or a security key to sign prescriptions and lab orders securely. 
              This provides the highest level of security and meets regulatory requirements.
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-4 text-sm text-slate-500">
                <span className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  TouchID/FaceID
                </span>
                <span className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  Security Keys
                </span>
                <span className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  Windows Hello
                </span>
              </div>
            </div>
          </div>
        )

      case 'enrolling':
        return (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">Setting Up...</h3>
            <p className="text-sm text-slate-600">
              Please follow the prompts from your device to complete setup.
            </p>
          </div>
        )

      case 'success':
        return (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">Setup Complete!</h3>
            <p className="text-sm text-slate-600">
              Your secure signing method is now active. You can sign prescriptions and lab orders securely.
            </p>
          </div>
        )

      case 'error':
        return (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">Setup Failed</h3>
            <p className="text-sm text-slate-600 mb-4">{error}</p>
            <button
              onClick={() => setStep('intro')}
              className="text-sm text-brand-600 hover:text-brand-700"
            >
              Try Again
            </button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          {getStepContent()}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end space-x-3">
          {step === 'intro' && (
            <>
              <button
                onClick={onCancel}
                className="bg-white py-2 px-4 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Skip for Now
              </button>
              <button
                onClick={handleEnroll}
                disabled={isEnrolling}
                className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white py-2 px-4 rounded-md shadow-sm text-sm font-medium"
              >
                Set Up Secure Signing
              </button>
            </>
          )}

          {step === 'success' && (
            <button
              onClick={onCancel}
              className="bg-brand-600 hover:bg-brand-700 text-white py-2 px-4 rounded-md shadow-sm text-sm font-medium"
            >
              Done
            </button>
          )}

          {step === 'error' && (
            <button
              onClick={onCancel}
              className="bg-slate-600 hover:bg-slate-700 text-white py-2 px-4 rounded-md shadow-sm text-sm font-medium"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
