'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RequireRole, useAuth } from '../../../lib/auth'
import { useSession } from '../../../lib/session'

// Mock user schema for admin view
const mockUsers = [
  { id: 'u1', email: 'admin@teleplatform.com', role: 'SUPER_ADMIN', org_id: null, org_name: 'System', status: 'ACTIVE', last_login_at: new Date().toISOString() },
  { id: 'u2', email: 'marketer.admin@acmelab.com', role: 'MARKETER_ADMIN', org_id: 'org_acme', org_name: 'Acme Lab', status: 'ACTIVE', last_login_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 'u3', email: 'john@acmelab.com', role: 'MARKETER', org_id: 'org_acme', org_name: 'Acme Lab', status: 'ACTIVE', last_login_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 'u4', email: 'jane@acmelab.com', role: 'MARKETER', org_id: 'org_acme', org_name: 'Acme Lab', status: 'PENDING', last_login_at: null },
  { id: 'u5', email: 'marketer@betacorp.com', role: 'MARKETER', org_id: 'org_beta', org_name: 'Beta Corp', status: 'LOCKED', last_login_at: null },
]

const mockOrgs = [
  { id: 'org_acme', name: 'Acme Lab', type: 'MARKETER', user_count: 3 },
  { id: 'org_beta', name: 'Beta Corp', type: 'MARKETER', user_count: 1 },
]

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    LOCKED: 'bg-red-100 text-red-800',
    INACTIVE: 'bg-slate-100 text-slate-700',
  }
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${styles[status] || styles.INACTIVE}`}>
      {status}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    SUPER_ADMIN: 'bg-purple-100 text-purple-800',
    MARKETER_ADMIN: 'bg-blue-100 text-blue-800',
    MARKETER: 'bg-brand-100 text-brand-800',
    DOCTOR: 'bg-green-100 text-green-800',
    LAB_TECH: 'bg-amber-100 text-amber-800',
    PHARMACIST: 'bg-pink-100 text-pink-800',
  }
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${styles[role] || 'bg-slate-100 text-slate-700'}`}>
      {role.replace(/_/g, ' ')}
    </span>
  )
}

export default function AdminUsersPage() {
  const { role } = useAuth()
  const { marketerOrgId } = useSession()
  const qc = useQueryClient()
  
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterOrg, setFilterOrg] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  
  // New invite form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('')
  const [inviteOrgId, setInviteOrgId] = useState('')
  
  // Filter users based on role permissions
  const users = useMemo(() => {
    let filtered = [...mockUsers]
    
    // MARKETER_ADMIN can only see users in their org
    if (role === 'MARKETER_ADMIN' && marketerOrgId) {
      filtered = filtered.filter(u => u.org_id === marketerOrgId)
    }
    
    // Apply search
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(u => 
        u.email.toLowerCase().includes(q) ||
        u.org_name.toLowerCase().includes(q)
      )
    }
    
    // Apply org filter (SUPER_ADMIN only)
    if (filterOrg && role === 'SUPER_ADMIN') {
      filtered = filtered.filter(u => u.org_id === filterOrg)
    }
    
    // Apply status filter
    if (filterStatus) {
      filtered = filtered.filter(u => u.status === filterStatus)
    }
    
    return filtered
  }, [mockUsers, role, marketerOrgId, search, filterOrg, filterStatus])
  
  const orgs = role === 'SUPER_ADMIN' ? mockOrgs : mockOrgs.filter(o => o.id === marketerOrgId)
  
  const inviteMutation = useMutation({
    mutationFn: async () => {
      // Mock API call
      return new Promise(resolve => setTimeout(resolve, 1000))
    },
    onSuccess: () => {
      setShowInviteForm(false)
      setInviteEmail('')
      setInviteRole('')
      setInviteOrgId('')
      qc.invalidateQueries({ queryKey: ['users'] })
      alert('Invitation sent!')
    }
  })
  
  const userActionMutation = useMutation({
    mutationFn: async ({ userId, action }: { userId: string; action: string }) => {
      // Mock API call
      return new Promise(resolve => setTimeout(resolve, 500))
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      alert(`User ${variables.action}d successfully`)
    }
  })

  return (
    <RequireRole allow={['MARKETER_ADMIN', 'SUPER_ADMIN']}>
      <div className="max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">User Management</h1>
          <button
            onClick={() => setShowInviteForm(true)}
            className="px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-700"
          >
            Invite User
          </button>
        </div>
        
        {/* Filters */}
        <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="Search by email or org..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          
          {role === 'SUPER_ADMIN' && (
            <select
              className="border rounded px-3 py-2"
              value={filterOrg}
              onChange={(e) => setFilterOrg(e.target.value)}
            >
              <option value="">All Organizations</option>
              {orgs.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          )}
          
          <select
            className="border rounded px-3 py-2"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="LOCKED">Locked</option>
          </select>
        </div>
        
        {/* Users Table */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-900">User</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-900">Role</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-900">Organization</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-900">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-900">Last Login</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-sm">{user.email}</div>
                      <div className="text-xs text-slate-600">ID: {user.id}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-4 py-3 text-sm">{user.org_name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {user.last_login_at
                      ? new Date(user.last_login_at).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3 text-sm">
                      {user.status === 'ACTIVE' ? (
                        <button
                          onClick={() => userActionMutation.mutate({ userId: user.id, action: 'disable' })}
                          className="text-red-600 hover:underline"
                        >
                          Disable
                        </button>
                      ) : (
                        <button
                          onClick={() => userActionMutation.mutate({ userId: user.id, action: 'enable' })}
                          className="text-green-600 hover:underline"
                        >
                          Enable
                        </button>
                      )}
                      <button
                        onClick={() => userActionMutation.mutate({ userId: user.id, action: 'reset-mfa' })}
                        className="text-brand-600 hover:underline"
                      >
                        Reset MFA
                      </button>
                      {role === 'SUPER_ADMIN' && (
                        <button
                          onClick={() => userActionMutation.mutate({ userId: user.id, action: 'change-role' })}
                          className="text-brand-600 hover:underline"
                        >
                          Change Role
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Invite Modal */}
        {showInviteForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Invite New User</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email Address</label>
                  <input
                    type="email"
                    className="w-full border rounded px-3 py-2"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    <option value="">Select a role</option>
                    {role === 'SUPER_ADMIN' && (
                      <>
                        <option value="SUPER_ADMIN">Super Admin</option>
                        <option value="MARKETER_ADMIN">Marketer Admin</option>
                      </>
                    )}
                    <option value="MARKETER">Marketer</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Organization</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={inviteOrgId}
                    onChange={(e) => setInviteOrgId(e.target.value)}
                    disabled={role === 'MARKETER_ADMIN'}
                  >
                    <option value="">Select organization</option>
                    {orgs.map(org => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowInviteForm(false)
                    setInviteEmail('')
                    setInviteRole('')
                    setInviteOrgId('')
                  }}
                  className="px-4 py-2 border rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => inviteMutation.mutate()}
                  disabled={!inviteEmail || !inviteRole || !inviteOrgId || inviteMutation.isPending}
                  className="px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50"
                >
                  {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RequireRole>
  )
}