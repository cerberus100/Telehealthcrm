import { RequireRole } from '../../lib/auth'
import Link from 'next/link'
import IncomingCallBanner from '../../components/IncomingCallBanner'

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole allow={['DOCTOR', 'SUPER_ADMIN']}>
      <div className="min-h-screen bg-slate-50">
        {/* Provider Navigation */}
        <nav className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="text-lg font-semibold text-brand-600">
                Provider Portal
              </Link>
              <div className="flex space-x-6">
                <Link 
                  href="/dashboard" 
                  className="text-slate-600 hover:text-slate-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Dashboard
                </Link>
                <Link 
                  href="/patients" 
                  className="text-slate-600 hover:text-slate-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Patients
                </Link>
                <Link 
                  href="/consults" 
                  className="text-slate-600 hover:text-slate-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Consults
                </Link>
                <Link 
                  href="/rx" 
                  className="text-slate-600 hover:text-slate-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Prescriptions
                </Link>
                <Link 
                  href="/lab-results" 
                  className="text-slate-600 hover:text-slate-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Lab Results
                </Link>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="flex items-center space-x-4">
              <button className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-md text-sm font-medium">
                New Consult
              </button>
              <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium">
                Compose Rx
              </button>
            </div>
          </div>
        </nav>

        {/* Incoming Call Banner */}
        <IncomingCallBanner />

        {/* Main Content */}
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </RequireRole>
  )
}
