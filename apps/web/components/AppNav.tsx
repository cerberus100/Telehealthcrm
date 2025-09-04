"use client"
import Link from 'next/link'
import { useAuth } from '../lib/auth'
import { useState } from 'react'

export default function AppNav() {
  const { role, email, isAuthenticated, logout } = useAuth()
  const [showMenu, setShowMenu] = useState(false)
  
  return (
    <>
      <nav className="flex items-center gap-4 text-sm flex-1">
        {(role === 'MARKETER' || role === 'MARKETER_ADMIN') && (
          <Link href="/shipments" className="hover:text-brand-600">Specimen Shipments</Link>
        )}
        {/* Consults hidden for marketers; keep for SUPER_ADMIN only for now */}
        {role === 'SUPER_ADMIN' && (
          <Link href="/consults" className="hover:text-brand-600">Consults</Link>
        )}
        {(role === 'MARKETER_ADMIN' || role === 'SUPER_ADMIN') && (
          <Link href="/admin" className="hover:text-brand-600">Admin</Link>
        )}
      </nav>
      
      {/* User menu - replaces Login link when authenticated */}
      {isAuthenticated ? (
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 p-2 rounded hover:bg-slate-50"
          >
            <div className="w-8 h-8 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-sm font-medium">
              {email?.charAt(0).toUpperCase()}
            </div>
            <div className="text-left">
              <div className="text-xs text-slate-600">{role}</div>
              <div className="text-xs truncate max-w-[150px]">{email}</div>
            </div>
          </button>
          
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-20">
                <div className="p-3 border-b">
                  <div className="text-sm font-medium truncate">{email}</div>
                  <div className="text-xs text-slate-600">{role}</div>
                </div>
                <button
                  onClick={() => {
                    logout()
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                >
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <Link href="/login" className="text-sm hover:text-brand-600">Sign In</Link>
      )}
    </>
  )
}
