"use client"
import Link from 'next/link'
import { useAuth } from '../../lib/auth'
import { RequireRole } from '../../lib/auth'

export default function AdminPage() {
  const { role } = useAuth()
  
  return (
    <RequireRole allow={['MARKETER_ADMIN', 'SUPER_ADMIN']}>
      <div className="max-w-4xl">
        <h1 className="text-2xl font-semibold mb-6">Admin Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin/users"
            className="p-6 border rounded-lg hover:shadow-md hover:border-brand-300 transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-medium">Users</h2>
            </div>
            <p className="text-sm text-slate-600">
              Manage users, invite new members, and control access
            </p>
          </Link>
          
          {role === 'SUPER_ADMIN' && (
            <Link
              href="/admin/orgs"
              className="p-6 border rounded-lg hover:shadow-md hover:border-brand-300 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h2 className="text-lg font-medium">Organizations</h2>
              </div>
              <p className="text-sm text-slate-600">
                Create and manage marketer organizations
              </p>
            </Link>
          )}
          
          {role === 'SUPER_ADMIN' && (
            <Link
              href="/admin/shipments"
              className="p-6 border rounded-lg hover:shadow-md hover:border-brand-300 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <h2 className="text-lg font-medium">All Shipments</h2>
              </div>
              <p className="text-sm text-slate-600">
                Cross-org shipment search and maintenance
              </p>
            </Link>
          )}
          
          <Link
            href="/admin/audit"
            className="p-6 border rounded-lg hover:shadow-md hover:border-brand-300 transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-medium">Audit Logs</h2>
            </div>
            <p className="text-sm text-slate-600">
              View system activity and compliance logs
            </p>
          </Link>
          
          <Link
            href="/admin/settings"
            className="p-6 border rounded-lg hover:shadow-md hover:border-brand-300 transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-medium">Settings</h2>
            </div>
            <p className="text-sm text-slate-600">
              System configuration and feature flags
            </p>
          </Link>
        </div>
        
        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="text-2xl font-bold">12</div>
            <div className="text-sm text-slate-600">Active Users</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="text-2xl font-bold">3</div>
            <div className="text-sm text-slate-600">Organizations</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="text-2xl font-bold">156</div>
            <div className="text-sm text-slate-600">Shipments Today</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="text-2xl font-bold">99.9%</div>
            <div className="text-sm text-slate-600">Uptime</div>
          </div>
        </div>
      </div>
    </RequireRole>
  )
}
