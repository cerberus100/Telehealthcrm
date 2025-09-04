'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Protected, useAuth } from '../../../lib/auth'

// Mock user schema for admin view
const mockUsers = [
  { id: 'u1', email: 'dr@acme.com', role: 'DOCTOR', org_id: 'org_provider', status: 'ACTIVE', last_login_at: new Date().toISOString() },
  { id: 'u2', email: 'lab@testcorp.com', role: 'LAB_TECH', org_id: 'org_lab', status: 'ACTIVE', last_login_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 'u3', email: 'marketer@leadgen.com', role: 'MARKETER', org_id: 'org_marketing', status: 'LOCKED', last_login_at: null },
]

export default function AdminUsersPage() {
  const { role } = useAuth()
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)

  // Role guard: Only admins can manage users
  const canManage = role === 'ORG_ADMIN' || role === 'MASTER_ADMIN'
  
  if (!canManage) {
    return (
      <Protected>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 text-red-800 p-4 rounded">
            Access denied. Only Administrators can manage users.
          </div>
        </div>
      </Protected>
    )
  }

  const handleInviteUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    console.log('Inviting user:', {
      email: formData.get('email'),
      role: formData.get('role'),
      org_id: formData.get('org_id'),
    })
    setShowInviteForm(false)
    // TODO: Implement actual user invitation
  }

  const handleUserAction = (userId: string, action: string) => {
    console.log(`Action ${action} on user ${userId}`)
    // TODO: Implement user actions (disable, reset MFA, etc.)
  }

  return (
    <Protected>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">User Management</h1>
          <button
            onClick={() => setShowInviteForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Invite User
          </button>
        </div>
        
        {showInviteForm && (
          <div className="bg-white p-6 rounded shadow mb-6">
            <h2 className="text-xl font-semibold mb-4">Invite New User</h2>
            <form onSubmit={handleInviteUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full border rounded px-3 py-2"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select name="role" required className="w-full border rounded px-3 py-2">
                  <option value="">Select Role</option>
                  <option value="DOCTOR">Doctor</option>
                  <option value="PHARMACIST">Pharmacist</option>
                  <option value="LAB_TECH">Lab Tech</option>
                  <option value="MARKETER">Marketer</option>
                  <option value="ORG_ADMIN">Org Admin</option>
                  <option value="SUPPORT">Support</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Organization</label>
                <select name="org_id" required className="w-full border rounded px-3 py-2">
                  <option value="">Select Organization</option>
                  <option value="org_provider">Acme Provider</option>
                  <option value="org_lab">Test Corp Lab</option>
                  <option value="org_pharmacy">Quick Pharmacy</option>
                  <option value="org_marketing">Lead Gen Marketing</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Send Invite
                </button>
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
        
        <div className="bg-white rounded shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Users</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-4">Email</th>
                  <th className="text-left p-4">Role</th>
                  <th className="text-left p-4">Organization</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Last Login</th>
                  <th className="text-left p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockUsers.map((user) => (
                  <tr key={user.id} className="border-b">
                    <td className="p-4">{user.email}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-600">{user.org_id}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs rounded ${
                        user.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                        user.status === 'LOCKED' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                      {user.last_login_at 
                        ? new Date(user.last_login_at).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        {user.status === 'ACTIVE' ? (
                          <button
                            onClick={() => handleUserAction(user.id, 'disable')}
                            className="text-red-600 text-sm hover:underline"
                          >
                            Disable
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUserAction(user.id, 'enable')}
                            className="text-green-600 text-sm hover:underline"
                          >
                            Enable
                          </button>
                        )}
                        <button
                          onClick={() => handleUserAction(user.id, 'reset-mfa')}
                          className="text-blue-600 text-sm hover:underline"
                        >
                          Reset MFA
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Protected>
  )
}
