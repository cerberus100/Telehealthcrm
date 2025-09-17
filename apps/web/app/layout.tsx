import './globals.css'
import Providers from './providers'
import Link from 'next/link'
import NotificationsBell from '../components/NotificationsBell'
import SessionBanner from '../components/SessionBanner'
import AppNav from '../components/AppNav'
import { useAuth } from '../lib/auth'

export const metadata = {
  title: 'Teleplatform',
  description: 'HIPAA-eligible telehealth platform',
  icons: {
    icon: '/favicon.svg',
  },
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
          <SessionBanner />
          <header className="p-4 border-b flex items-center gap-4">
            <Link href="/" className="font-semibold text-brand-600">Teleplatform</Link>
            <AppNav />
            <div className="ml-auto flex items-center gap-4">
              <NotificationsBell />
            </div>
          </header>
          <main id="main-content" className="p-4 min-h-[70vh]" role="main">{children}</main>
          <footer className="p-4 border-t text-xs text-slate-600">Env: {buildInfo.env}</footer>
        </Providers>
      </body>
    </html>
  )
}
