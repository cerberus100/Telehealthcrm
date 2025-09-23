'use client'

import { useQuery } from '@tanstack/react-query'
import { Api } from '../../lib/api'
import { Protected, useAuth } from '../../lib/auth'
import Link from 'next/link'

export default function LabOrdersPage() {
  const { role } = useAuth()
  const { data, isLoading, error } = useQuery({
    queryKey: ['lab-orders'],
    queryFn: Api.labOrders,
  })

  // Role guard: Only Lab and Doctor can view
  const canView = role === 'LAB_TECH' || role === 'DOCTOR'
  
  if (!canView) {
    return (
      <Protected>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 text-red-800 p-4 rounded">
            Access denied. Only Lab and Provider personnel can view lab orders.
          </div>
        </div>
      </Protected>
    )
  }

  return (
    <Protected>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Lab Orders</h1>
        
        {isLoading && <div className="text-gray-500">Loading lab orders...</div>}
        {error && <div className="text-red-600">Error loading lab orders</div>}
        
        {data && (
          <div className="space-y-4">
            {data.items.map((order) => (
              <Link key={order.id} href={`/lab-orders/${order.id}`}>
                <div className="bg-white p-4 rounded shadow hover:shadow-md cursor-pointer">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">Order #{order.id}</p>
                      <p className="text-sm text-gray-600">Tests: {order.tests.join(', ')}</p>
                      <p className="text-sm text-gray-500">Created: {new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded ${
                      order.status === 'RESULTS_READY' ? 'bg-green-100 text-green-800' :
                      order.status === 'IN_TRANSIT' ? 'bg-brand-100 text-brand-800' :
                      order.status === 'RECEIVED' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
            
            {data.items.length === 0 && (
              <p className="text-gray-500">No lab orders found</p>
            )}
          </div>
        )}
      </div>
    </Protected>
  )
}
