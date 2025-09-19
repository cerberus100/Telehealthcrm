"use client"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { AuthProvider } from '../lib/auth'
import { AccessibilityProvider } from '../components/AccessibilityProvider'
import ErrorBoundary from '../components/ErrorBoundary'
import { OfflineIndicator } from '../lib/offline'

// Ensure consistent values and match the current hostname (localhost vs 127.0.0.1)
export const API_BASE_URL = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://telehealth-alb-prod-422934810.us-east-1.elb.amazonaws.com')
  : (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://telehealth-alb-prod-422934810.us-east-1.elb.amazonaws.com')
export const USE_MOCKS = false // Disabled for production API

// Production Cognito Configuration
export const COGNITO_CONFIG = {
  userPoolId: 'us-east-1_yBMYJzyA1',
  clientId: 'crsnkji5f4i7f7v739tf6ef0u',
  region: 'us-east-1',
  domain: 'telehealth-auth-prod'
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: USE_MOCKS ? false : 3,
      },
    },
  }))
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Mock service worker disabled since we're using real backend
  // useEffect(() => {
  //   if (USE_MOCKS) {
  //     import('../mocks/browser').then(({ worker }) => worker.start())
  //   }
  // }, [])

  if (!mounted) {
    return null
  }

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
