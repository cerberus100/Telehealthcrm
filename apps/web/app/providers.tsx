"use client"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { AuthProvider } from '../lib/auth'

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || ''
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true'

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient())

  useEffect(() => {
    if (USE_MOCKS) {
      import('../mocks/browser').then(({ worker }) => worker.start())
    }
  }, [])

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
}
