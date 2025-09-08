"use client"
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../lib/auth'

interface ShipmentDrawerProps {
  shipment: any
  onClose: () => void
}

export default function ShipmentDrawer({ shipment, onClose }: ShipmentDrawerProps) {
  const { role } = useAuth()
  const qc = useQueryClient()
  const isAdmin = role === 'MARKETER_ADMIN' || role === 'SUPER_ADMIN'
  
  const [isEditing, setIsEditing] = useState(false)
  const [reference, setReference] = useState(shipment.reference || '')
  
  const refreshMutation = useMutation({
    mutationFn: async () => {
      // In real app, call API.refreshShipment(shipment.id)
      return new Promise(resolve => setTimeout(resolve, 1000))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shipments'] })
      alert('Shipment refreshed from carrier')
    }
  })
  
  const updateMutation = useMutation({
    mutationFn: async () => {
      // In real app, call API.updateShipment(shipment.id, { reference })
      return new Promise(resolve => setTimeout(resolve, 500))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shipments'] })
      setIsEditing(false)
    }
  })
  
  // Mock timeline events
  const events = [
    { at: new Date().toISOString(), location: 'Louisville, KY', desc: 'Departed Facility' },
    { at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(), location: 'Nashville, TN', desc: 'Arrival Scan' },
    { at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), location: 'Memphis, TN', desc: 'Origin Scan' },
  ]
  
  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-xl z-50 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="font-semibold">Shipment Details</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-slate-600">Tracking #</span>
              <span className="font-mono font-medium">{shipment.tracking_number}</span>
            </div>
            <div className="flex items-center gap-2">
              <img 
                src={`/images/${shipment.carrier.toLowerCase()}-logo.png`} 
                alt={shipment.carrier}
                className="h-6"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
              <span className="text-sm font-medium">{shipment.carrier}</span>
            </div>
          </div>
          
          {/* Status */}
          <div className="bg-slate-50 rounded p-3">
            <div className="text-sm text-slate-600 mb-1">Current Status</div>
            <div className="font-medium">{shipment.status.replace(/_/g, ' ')}</div>
            {shipment.eta && (
              <div className="text-sm text-slate-600 mt-1">
                ETA: {new Date(shipment.eta).toLocaleDateString()}
              </div>
            )}
          </div>
          
          {/* Reference */}
          <div>
            <div className="text-sm text-slate-600 mb-1">Reference</div>
            {isEditing ? (
              <div className="flex gap-2">
                <input
                  className="flex-1 border rounded px-2 py-1"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Client name, case ID (no PHI)"
                />
                <button
                  className="px-3 py-1 text-sm bg-brand-600 text-white rounded"
                  onClick={() => updateMutation.mutate()}
                >
                  Save
                </button>
                <button
                  className="px-3 py-1 text-sm border rounded"
                  onClick={() => {
                    setReference(shipment.reference || '')
                    setIsEditing(false)
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span>{shipment.reference || '-'}</span>
                {isAdmin && (
                  <button
                    className="text-sm text-brand-600 hover:underline"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Timeline */}
          <div>
            <div className="text-sm text-slate-600 mb-3">Tracking Timeline</div>
            <div className="space-y-3">
              {events.map((event, i) => (
                <div key={i} className="flex gap-3">
                  <div className="relative">
                    <div className="w-2 h-2 bg-brand-600 rounded-full" />
                    {i < events.length - 1 && (
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-0.5 h-full bg-slate-200" />
                    )}
                  </div>
                  <div className="flex-1 -mt-1">
                    <div className="text-sm font-medium">{event.desc}</div>
                    <div className="text-xs text-slate-600">
                      {event.location} • {new Date(event.at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Metadata */}
          <div className="pt-4 border-t space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Created</span>
              <span>{new Date(shipment.created_at || shipment.last_event_at).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Last Updated</span>
              <span>{new Date(shipment.last_event_at).toLocaleString()}</span>
            </div>
            {shipment.lastCarrierPollAt && (
              <div className="flex justify-between">
                <span className="text-slate-600">Last Carrier Poll</span>
                <span>{new Date(shipment.lastCarrierPollAt).toLocaleString()}</span>
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div className="pt-4 space-y-2">
            <button
              className="w-full py-2 border rounded hover:bg-slate-50 flex items-center justify-center gap-2"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
            >
              {refreshMutation.isPending ? 'Refreshing...' : 'Refresh from Carrier'}
            </button>
            
            {isAdmin && (
              <>
                <button className="w-full py-2 border rounded hover:bg-slate-50">
                  Reassign
                </button>
                <button className="w-full py-2 border border-red-300 text-red-700 rounded hover:bg-red-50">
                  Delete Shipment
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
