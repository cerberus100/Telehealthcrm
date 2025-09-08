"use client"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { AuthProvider } from '../lib/auth'
import { AccessibilityProvider } from '../components/AccessibilityProvider'
import ErrorBoundary from '../components/ErrorBoundary'
import { OfflineIndicator } from '../lib/offline'

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || ''
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true'

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: USE_MOCKS ? false : 3,
      },
    },
  }))

  useEffect(() => {
    if (USE_MOCKS) {
      import('../mocks/browser').then(({ worker }) => worker.start())
    }
  }, [])

  return (
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <AccessibilityProvider>
          <AuthProvider>
            {children}
            <OfflineIndicator />
          </AuthProvider>
        </AccessibilityProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
