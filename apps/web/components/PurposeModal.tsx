'use client'

import { useState } from 'react'
import { useAuth } from '../lib/auth'

interface PurposeModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (purpose: string) => void
  entityType: string
}

export default function PurposeModal({ isOpen, onClose, onConfirm, entityType }: PurposeModalProps) {
  const [purpose, setPurpose] = useState('')
  const { setPurposeOfUse } = useAuth()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (purpose.trim()) {
      setPurposeOfUse(purpose)
      onConfirm(purpose)
      setPurpose('')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">Purpose of Use Required</h2>
        <p className="text-gray-600 mb-4">
          You are about to access {entityType}. Please provide a purpose for accessing this protected health information.
        </p>
        <form onSubmit={handleSubmit}>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full border rounded px-3 py-2 mb-4"
            rows={3}
            placeholder="e.g., Clinical review for patient care"
            required
            minLength={10}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Confirm Access
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
