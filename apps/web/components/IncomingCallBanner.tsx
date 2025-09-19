"use client"
import Link from 'next/link'
import { useScreenPop } from '../lib/realtime'

export default function IncomingCallBanner() {
  const { activeCall, dismissCall } = useScreenPop()

  if (!activeCall) return null

  return (
    <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 bg-blue-600 text-white p-4 rounded-lg shadow-lg border-2 border-blue-500 min-w-96">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <div>
            <div className="font-semibold">Incoming Call</div>
            <div className="text-sm opacity-90">
              {activeCall.callerName || 'Unknown Caller'} • {activeCall.callerPhone} • {activeCall.serviceMode}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link 
            href={`/consults/${activeCall.consultId}`}
            className="px-3 py-2 bg-white text-blue-600 rounded font-medium hover:bg-blue-50 transition-colors"
          >
            Open Consult
          </Link>
          <button 
            onClick={() => dismissCall(activeCall.consultId)}
            className="px-3 py-2 bg-blue-700 rounded hover:bg-blue-800 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
