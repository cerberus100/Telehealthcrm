"use client"
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface BulkUploadModalProps {
  onClose: () => void
}

interface ShipmentRow {
  trackingNumber: string
  carrier?: string
  reference?: string
  assignToEmail?: string
  error?: string
}

export default function BulkUploadModal({ onClose }: BulkUploadModalProps) {
  const qc = useQueryClient()
  const [csvContent, setCsvContent] = useState('')
  const [preview, setPreview] = useState<ShipmentRow[]>([])
  const [showPreview, setShowPreview] = useState(false)
  
  const parseCsv = (content: string): ShipmentRow[] => {
    const lines = content.trim().split('\n')
    const rows: ShipmentRow[] = []
    
    // Skip header if present
    const startIdx = lines.length > 0 && lines[0]?.toLowerCase().includes('tracking') ? 1 : 0
    
    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i]?.trim()
      if (!line) continue
      
      const cols = line.split(',').map(col => col.trim().replace(/^["']|["']$/g, ''))
      const [trackingNumber, carrier, reference, assignToEmail] = cols
      
      if (!trackingNumber) continue
      
      const row: ShipmentRow = { trackingNumber }
      if (carrier) row.carrier = carrier.toUpperCase()
      if (reference) row.reference = reference
      if (assignToEmail) row.assignToEmail = assignToEmail
      
      // Validation
      if (!trackingNumber || trackingNumber.length < 5) {
        row.error = 'Invalid tracking number'
      } else if (carrier && !['UPS', 'FEDEX', 'USPS', 'OTHER'].includes(row.carrier || '')) {
        row.error = 'Invalid carrier (use UPS, FEDEX, USPS, or OTHER)'
      }
      
      rows.push(row)
    }
    
    return rows
  }
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (evt) => {
      const content = evt.target?.result as string
      setCsvContent(content)
      const parsed = parseCsv(content)
      setPreview(parsed)
      setShowPreview(true)
    }
    reader.readAsText(file)
  }
  
  const uploadMutation = useMutation({
    mutationFn: async () => {
      const validRows = preview.filter(r => !r.error)
      // In real app, call API.bulkCreateShipments(validRows)
      return new Promise(resolve => setTimeout(resolve, 1000))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shipments'] })
      alert(`Successfully uploaded ${preview.filter(r => !r.error).length} shipments`)
      onClose()
    }
  })
  
  const validCount = preview.filter(r => !r.error).length
  const errorCount = preview.filter(r => r.error).length
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-3xl max-h-[80vh] rounded bg-white shadow-lg overflow-hidden flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Bulk Upload Shipments</h2>
          <p className="text-sm text-slate-600 mt-1">Upload a CSV file with tracking numbers</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {!showPreview ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">CSV Template</h3>
                <div className="bg-slate-50 p-3 rounded text-sm font-mono">
                  trackingNumber,carrier,reference,assignToEmail<br/>
                  1Z12345E0205271688,UPS,Client ABC,john@yourorg.com<br/>
                  9405511899223470123456,USPS,Case 123,<br/>
                  772233445566,FEDEX,Order XYZ,jane@yourorg.com
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  * Only trackingNumber is required. Carrier defaults to UPS if not specified.
                </p>
              </div>
              
              <div>
                <label className="block">
                  <span className="text-sm font-medium">Upload CSV File</span>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="mt-1 block w-full text-sm text-slate-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded file:border-0
                      file:text-sm file:font-semibold
                      file:bg-brand-50 file:text-brand-700
                      hover:file:bg-brand-100"
                  />
                </label>
              </div>
              
              <div className="text-sm text-slate-600">
                Or paste CSV content:
                <textarea
                  className="mt-1 w-full h-32 border rounded p-2 font-mono text-xs"
                  placeholder="trackingNumber,carrier,reference,assignToEmail"
                  value={csvContent}
                  onChange={(e) => {
                    setCsvContent(e.target.value)
                    if (e.target.value.trim()) {
                      const parsed = parseCsv(e.target.value)
                      setPreview(parsed)
                      setShowPreview(true)
                    }
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Preview</h3>
                <button
                  onClick={() => {
                    setShowPreview(false)
                    setPreview([])
                    setCsvContent('')
                  }}
                  className="text-sm text-brand-600 hover:underline"
                >
                  Back to upload
                </button>
              </div>
              
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-700">✓ {validCount} valid</span>
                {errorCount > 0 && <span className="text-red-700">✗ {errorCount} errors</span>}
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="p-2 text-left">Tracking Number</th>
                      <th className="p-2 text-left">Carrier</th>
                      <th className="p-2 text-left">Reference</th>
                      <th className="p-2 text-left">Assign To</th>
                      <th className="p-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className={`border-t ${row.error ? 'bg-red-50' : ''}`}>
                        <td className="p-2">{row.trackingNumber}</td>
                        <td className="p-2">{row.carrier || 'UPS'}</td>
                        <td className="p-2">{row.reference || '-'}</td>
                        <td className="p-2">{row.assignToEmail || '-'}</td>
                        <td className="p-2">
                          {row.error ? (
                            <span className="text-red-700 text-xs">{row.error}</span>
                          ) : (
                            <span className="text-green-700">✓</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        
        <div className="p-6 border-t flex justify-end gap-2">
          <button 
            className="px-4 py-2 rounded border" 
            onClick={onClose}
          >
            Cancel
          </button>
          {showPreview && validCount > 0 && (
            <button
              className="px-4 py-2 rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? 'Uploading...' : `Upload ${validCount} Shipments`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
