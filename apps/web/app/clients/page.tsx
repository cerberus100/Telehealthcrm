'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Api } from '../../lib/api'
import { Protected, useAuth } from '../../lib/auth'
import Link from 'next/link'

export default function ClientsPage() {
  const { role } = useAuth()
  const [showNewClientForm, setShowNewClientForm] = useState(false)
  const { data, isLoading, error } = useQuery({
    queryKey: ['clients'],
    queryFn: Api.clients,
  })

  // Role guard: Only Marketers and Admins can manage clients
  const canManage = role === 'MARKETER' || role === 'MARKETER_ADMIN' || role === 'SUPER_ADMIN'
  
  if (!canManage) {
    return (
      <Protected>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 text-red-800 p-4 rounded">
            Access denied. Only Marketers and Administrators can manage clients.
          </div>
        </div>
      </Protected>
    )
  }

  const handleNewClient = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    console.log('Creating client:', {
      name: formData.get('name'),
      email: formData.get('email'),
    })
    setShowNewClientForm(false)
    // TODO: Implement actual client creation
  }

  return (
    <Protected>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Clients</h1>
          <button
            onClick={() => setShowNewClientForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Add Client
          </button>
        </div>
        
        {showNewClientForm && (
          <div className="bg-white p-6 rounded shadow mb-6">
            <h2 className="text-xl font-semibold mb-4">Add New Client</h2>
            <form onSubmit={handleNewClient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Client Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g., Acme Medical Center"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Contact Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full border rounded px-3 py-2"
                  placeholder="contact@acme.com"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Create Client
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewClientForm(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
        
        {isLoading && <div className="text-gray-500">Loading clients...</div>}
        {error && <div className="text-red-600">Error loading clients</div>}
        
        {data && (
          <div className="space-y-4">
            {data.items.map((client) => (
              <Link key={client.id} href={`/clients/${client.id}`}>
                <div className="bg-white p-4 rounded shadow hover:shadow-md cursor-pointer">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{client.name}</p>
                      <p className="text-sm text-gray-600">{client.contact_email}</p>
                      <p className="text-sm text-gray-500">Added: {new Date(client.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded ${
                      client.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                      client.status === 'INACTIVE' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {client.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
            
            {data.items.length === 0 && (
              <p className="text-gray-500">No clients found. Add your first client to get started.</p>
            )}
          </div>
        )}
      </div>
    </Protected>
  )
}
