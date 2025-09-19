"use client"
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Api } from '../lib/api'

interface NewConsultModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function NewConsultModal({ isOpen, onClose }: NewConsultModalProps) {
  const [patientName, setPatientName] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [patientDob, setPatientDob] = useState('')
  const [reason, setReason] = useState('')
  const [service, setService] = useState<'RX' | 'LABS' | 'BOTH'>('RX')
  const [errors, setErrors] = useState('')
  
  const qc = useQueryClient()

  const createConsult = useMutation({
    mutationFn: async (data: any) => {
      // Demo: create consult locally
      const consultId = `c_${Date.now()}`
      const consult = {
        id: consultId,
        status: 'PENDING',
        patient: {
          name: data.patientName,
          phone: data.patientPhone,
          dob: data.patientDob
        },
        reason: data.reason,
        service: data.service,
        createdFrom: 'PROVIDER',
        createdAt: new Date().toISOString()
      }
      
      if (typeof window !== 'undefined') {
        const existing = JSON.parse(window.localStorage.getItem('consults_demo') || '[]')
        existing.unshift(consult)
        window.localStorage.setItem('consults_demo', JSON.stringify(existing))
      }
      
      return consult
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['consults'] })
      onClose()
      // Reset form
      setPatientName('')
      setPatientPhone('')
      setPatientDob('')
      setReason('')
      setService('RX')
      setErrors('')
    },
    onError: (error) => {
      setErrors((error as Error).message)
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors('')
    
    if (!patientName || !patientPhone || !reason) {
      setErrors('Patient name, phone, and reason are required')
      return
    }
    
    createConsult.mutate({
      patientName,
      patientPhone,
      patientDob,
      reason,
      service
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Create New Consult</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {errors && (
            <div className="p-2 bg-red-50 text-red-700 text-sm rounded">{errors}</div>
          )}
          
          <label className="block text-sm">
            Patient Name
            <input 
              className="mt-1 w-full border rounded px-3 py-2" 
              value={patientName} 
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Full name"
            />
          </label>
          
          <label className="block text-sm">
            Phone Number
            <input 
              className="mt-1 w-full border rounded px-3 py-2" 
              value={patientPhone} 
              onChange={(e) => setPatientPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />
          </label>
          
          <label className="block text-sm">
            Date of Birth (optional)
            <input 
              type="date"
              className="mt-1 w-full border rounded px-3 py-2" 
              value={patientDob} 
              onChange={(e) => setPatientDob(e.target.value)}
            />
          </label>
          
          <label className="block text-sm">
            Service Type
            <select 
              className="mt-1 w-full border rounded px-3 py-2" 
              value={service} 
              onChange={(e) => setService(e.target.value as any)}
            >
              <option value="RX">Prescription</option>
              <option value="LABS">Lab Order</option>
              <option value="BOTH">Both</option>
            </select>
          </label>
          
          <label className="block text-sm">
            Reason for Consult
            <textarea 
              className="mt-1 w-full border rounded px-3 py-2" 
              rows={3}
              value={reason} 
              onChange={(e) => setReason(e.target.value)}
              placeholder="Chief complaint or reason for visit..."
            />
          </label>
          
          <div className="flex justify-end gap-3 mt-6">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 border rounded text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={createConsult.isPending}
              className="px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50"
            >
              {createConsult.isPending ? 'Creating...' : 'Create Consult'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
