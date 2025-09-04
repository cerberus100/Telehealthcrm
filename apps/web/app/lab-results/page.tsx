'use client'

import { useQuery } from '@tanstack/react-query'
import { Api } from '../../lib/api'
import { Protected, useAuth } from '../../lib/auth'
import Link from 'next/link'

export default function LabResultsPage() {
  const { role } = useAuth()
  const { data, isLoading, error } = useQuery({
    queryKey: ['lab-results'],
    queryFn: Api.labResults,
  })

  // Role guard: Only Lab and Doctor can view
  const canView = role === 'LAB_TECH' || role === 'DOCTOR'
  
  if (!canView) {
    return (
      <Protected>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 text-red-800 p-4 rounded">
            Access denied. Only Lab and Provider personnel can view lab results.
          </div>
        </div>
      </Protected>
    )
  }

  return (
    <Protected>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Lab Results</h1>
        
        {isLoading && <div className="text-gray-500">Loading lab results...</div>}
        {error && <div className="text-red-600">Error loading lab results</div>}
        
        {data && (
          <div className="space-y-4">
            {data.items.map((result) => (
              <Link key={result.id} href={`/lab-results/${result.id}`}>
                <div className="bg-white p-4 rounded shadow hover:shadow-md cursor-pointer">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">Result #{result.id}</p>
                      <p className="text-sm text-gray-600">Lab Order: {result.lab_order_id}</p>
                      {result.released_to_provider_at && (
                        <p className="text-sm text-gray-500">
                          Released: {new Date(result.released_to_provider_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {result.flagged_abnormal && (
                        <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-800">
                          Abnormal
                        </span>
                      )}
                      <span className={`px-2 py-1 text-xs rounded ${
                        result.released_to_provider_at ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {result.released_to_provider_at ? 'Released' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            
            {data.items.length === 0 && (
              <p className="text-gray-500">No lab results found</p>
            )}
          </div>
        )}
      </div>
    </Protected>
  )
}
