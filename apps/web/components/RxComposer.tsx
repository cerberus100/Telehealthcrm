"use client"
import { useState } from 'react'
import { useDocumentSigning } from '../lib/webauthn'
import { useAuth } from '../lib/auth'

interface RxComposerProps {
  patientId: string
  consultId?: string
  onSigned?: (signatureEventId: string) => void
  onCancel?: () => void
}

interface DrugSearchResult {
  id: string
  name: string
  strength: string
  form: string
  ndc: string
}

export default function RxComposer({ 
  patientId, 
  consultId, 
  onSigned, 
  onCancel 
}: RxComposerProps) {
  const { role } = useAuth()
  const { signDocument, isSigning } = useDocumentSigning()
  
  const [rxData, setRxData] = useState({
    drugName: '',
    strength: '',
    form: '',
    quantity: '',
    directions: '',
    refills: 0,
    daysSupply: 30,
    substitutionAllowed: true,
    priorAuthRequired: false,
    notes: '',
  })
  
  const [selectedDrug, setSelectedDrug] = useState<DrugSearchResult | null>(null)
  const [drugSearchResults, setDrugSearchResults] = useState<DrugSearchResult[]>([])
  const [showSafetyWarnings, setShowSafetyWarnings] = useState(false)
  const [isComposing, setIsComposing] = useState(false)

  // Mock drug search
  const searchDrugs = async (query: string) => {
    if (query.length < 3) {
      setDrugSearchResults([])
      return
    }

    // Mock search results
    const mockResults: DrugSearchResult[] = [
      { id: '1', name: 'Amoxicillin', strength: '500mg', form: 'Capsule', ndc: '12345-678-90' },
      { id: '2', name: 'Azithromycin', strength: '250mg', form: 'Tablet', ndc: '12345-678-91' },
      { id: '3', name: 'Albuterol', strength: '90mcg', form: 'Inhaler', ndc: '12345-678-92' },
    ].filter(drug => 
      drug.name.toLowerCase().includes(query.toLowerCase())
    )

    setDrugSearchResults(mockResults)
  }

  const selectDrug = (drug: DrugSearchResult) => {
    setSelectedDrug(drug)
    setRxData(prev => ({
      ...prev,
      drugName: `${drug.name} ${drug.strength} ${drug.form}`,
      strength: drug.strength,
      form: drug.form,
    }))
    setDrugSearchResults([])
  }

  // Generate prescription PDF
  const generateRxPdf = async (): Promise<Blob> => {
    // Mock PDF generation - in production, this would use a PDF library
    const pdfContent = `
PRESCRIPTION

Patient ID: ${patientId}
Drug: ${rxData.drugName}
Strength: ${rxData.strength}
Form: ${rxData.form}
Quantity: ${rxData.quantity}
Directions: ${rxData.directions}
Refills: ${rxData.refills}
Days Supply: ${rxData.daysSupply}
Substitution: ${rxData.substitutionAllowed ? 'Allowed' : 'Not Allowed'}

Provider Notes: ${rxData.notes}

Generated: ${new Date().toISOString()}
    `.trim()

    return new Blob([pdfContent], { type: 'application/pdf' })
  }

  const handleSign = async () => {
    if (!selectedDrug) {
      alert('Please select a drug first')
      return
    }

    try {
      setIsComposing(true)

      // Generate PDF
      const pdfBlob = await generateRxPdf()
      
      // Sign with step-up authentication
      const result = await signDocument(
        'RX',
        consultId || crypto.randomUUID(),
        `Prescription: ${rxData.drugName}`,
        patientId,
        pdfBlob
      )

      if (result.success) {
        onSigned?.(result.signatureEventId!)
      } else {
        alert(`Signing failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Prescription signing failed:', error)
      alert('Failed to sign prescription')
    } finally {
      setIsComposing(false)
    }
  }

  const handleSafetyCheck = () => {
    // Mock safety warnings
    setShowSafetyWarnings(true)
  }

  // Only allow doctors to compose prescriptions
  if (role !== 'DOCTOR' && role !== 'SUPER_ADMIN') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Only licensed providers can compose prescriptions.</p>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-slate-200">
        <h3 className="text-lg font-medium text-slate-900">Compose Prescription</h3>
        <p className="text-sm text-slate-500">Patient ID: {patientId}</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Drug Search */}
        <div>
          <label htmlFor="drug-search" className="block text-sm font-medium text-slate-700">
            Search Drug
          </label>
          <div className="mt-1 relative">
            <input
              id="drug-search"
              type="text"
              value={rxData.drugName}
              onChange={(e) => {
                setRxData(prev => ({ ...prev, drugName: e.target.value }))
                searchDrugs(e.target.value)
              }}
              placeholder="Start typing drug name..."
              className="block w-full border-slate-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500"
            />
            
            {drugSearchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto">
                {drugSearchResults.map((drug) => (
                  <div
                    key={drug.id}
                    onClick={() => selectDrug(drug)}
                    className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-brand-50"
                  >
                    <div className="flex items-center">
                      <span className="font-medium">{drug.name}</span>
                      <span className="ml-2 text-slate-500">{drug.strength} {drug.form}</span>
                    </div>
                    <span className="text-xs text-slate-400">NDC: {drug.ndc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Prescription Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-slate-700">
              Quantity
            </label>
            <input
              id="quantity"
              type="text"
              value={rxData.quantity}
              onChange={(e) => setRxData(prev => ({ ...prev, quantity: e.target.value }))}
              placeholder="e.g., 30 tablets"
              className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          <div>
            <label htmlFor="days-supply" className="block text-sm font-medium text-slate-700">
              Days Supply
            </label>
            <input
              id="days-supply"
              type="number"
              value={rxData.daysSupply}
              onChange={(e) => setRxData(prev => ({ ...prev, daysSupply: parseInt(e.target.value) }))}
              min="1"
              max="90"
              className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="directions" className="block text-sm font-medium text-slate-700">
            Directions for Use
          </label>
          <textarea
            id="directions"
            value={rxData.directions}
            onChange={(e) => setRxData(prev => ({ ...prev, directions: e.target.value }))}
            rows={3}
            placeholder="e.g., Take one tablet by mouth twice daily with food"
            className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500"
          />
        </div>

        <div>
          <label htmlFor="refills" className="block text-sm font-medium text-slate-700">
            Refills
          </label>
          <select
            id="refills"
            value={rxData.refills}
            onChange={(e) => setRxData(prev => ({ ...prev, refills: parseInt(e.target.value) }))}
            className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500"
          >
            <option value={0}>0 refills</option>
            <option value={1}>1 refill</option>
            <option value={2}>2 refills</option>
            <option value={3}>3 refills</option>
            <option value={5}>5 refills</option>
          </select>
        </div>

        {/* Safety Panel */}
        {showSafetyWarnings && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Safety Warnings</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Check for drug allergies before prescribing</li>
                    <li>Verify appropriate dosing for patient age/weight</li>
                    <li>Consider drug interactions with current medications</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Provider Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
            Provider Notes (Internal)
          </label>
          <textarea
            id="notes"
            value={rxData.notes}
            onChange={(e) => setRxData(prev => ({ ...prev, notes: e.target.value }))}
            rows={2}
            placeholder="Internal notes for this prescription..."
            className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-200">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleSafetyCheck}
              className="text-sm text-brand-600 hover:text-brand-700"
            >
              Run Safety Check
            </button>
            <div className="flex items-center">
              <input
                id="substitution"
                type="checkbox"
                checked={rxData.substitutionAllowed}
                onChange={(e) => setRxData(prev => ({ ...prev, substitutionAllowed: e.target.checked }))}
                className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-slate-300 rounded"
              />
              <label htmlFor="substitution" className="ml-2 text-sm text-slate-700">
                Allow generic substitution
              </label>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onCancel}
              className="bg-white py-2 px-4 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
            >
              Cancel
            </button>
            <button
              onClick={handleSign}
              disabled={!selectedDrug || isComposing || isSigning}
              className="bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white py-2 px-4 rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              {isComposing || isSigning ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                  Signing...
                </>
              ) : (
                'Sign & Submit'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
