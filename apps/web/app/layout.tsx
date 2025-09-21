import './globals.css'
import Providers from './providers'
import Link from 'next/link'
import NotificationsBell from '../components/NotificationsBell'
import SessionBanner from '../components/SessionBanner'
import AppNav from '../components/AppNav'
import { useAuth } from '../lib/auth'
import { PWAInstallBanner } from '../lib/pwa'
import OfflineIndicator from '../components/OfflineIndicator'

export const metadata = {
  title: 'Eudaura - Healthcare Platform',
  description: 'HIPAA-compliant healthcare platform for providers, marketers, and patients',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    apple: '/icons/icon-192x192.png'
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Eudaura'
  },
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
  themeColor: '#007DB8'
}

const buildInfo = {
  env: process.env.NEXT_PUBLIC_ENV || 'dev',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Client-only bits are inside components; keep header minimal
  return (
    <html lang="en">
      <body className="bg-white text-slate-900">
        <Providers>
          <OfflineIndicator />
          <SessionBanner />
          <header className="p-4 border-b flex items-center gap-4">
            <Link href="/" className="font-semibold text-brand-600">Eudaura</Link>
            <AppNav />
            <div className="ml-auto flex items-center gap-4">
              <NotificationsBell />
            </div>
          </header>
          <main id="main-content" className="p-4 min-h-[70vh]" role="main">{children}</main>
          <footer className="p-4 border-t text-xs text-slate-600">Eudaura Healthcare Platform • Env: {buildInfo.env}</footer>
          <PWAInstallBanner />
        </Providers>
      </body>
    </html>
  )
}
