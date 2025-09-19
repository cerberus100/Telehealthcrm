"use client"
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Api } from '../lib/api'

export default function ProviderAvailability() {
  const [available, setAvailable] = useState(true)
  const qc = useQueryClient()

  const toggleAvailability = useMutation({
    mutationFn: async (available: boolean) => {
      return await Api.postJson('/providers/availability', { available })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provider-availability'] })
    }
  })

  const handleToggle = () => {
    const next = !available
    setAvailable(next)
    toggleAvailability.mutate(next)
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded border">
      <div className="flex items-center gap-2">
        <div 
          className={`w-3 h-3 rounded-full ${available ? 'bg-green-500' : 'bg-red-500'}`}
          aria-label={available ? 'Available' : 'Offline'}
        />
        <span className="text-sm font-medium">
          {available ? 'Available for calls' : 'Offline'}
        </span>
      </div>
      <button
        onClick={handleToggle}
        disabled={toggleAvailability.isPending}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          available 
            ? 'bg-red-100 text-red-700 hover:bg-red-200' 
            : 'bg-green-100 text-green-700 hover:bg-green-200'
        } disabled:opacity-50`}
      >
        {toggleAvailability.isPending 
          ? 'Updating...' 
          : available 
            ? 'Go Offline' 
            : 'Go Available'
        }
      </button>
    </div>
  )
}
