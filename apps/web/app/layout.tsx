import './globals.css'
import Providers from './providers'
import Link from 'next/link'
import NotificationsBell from '../components/NotificationsBell'

export const metadata = {
  title: 'Teleplatform',
  description: 'HIPAA-eligible telehealth platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-900">
        <Providers>
          <header className="p-4 border-b flex items-center gap-4">
            <Link href="/" className="font-semibold">Teleplatform</Link>
            <nav className="flex items-center gap-3 text-sm">
              <Link href="/consults" className="underline">Consults</Link>
              <Link href="/shipments" className="underline">Shipments</Link>
            </nav>
            <div className="ml-auto flex items-center gap-4">
              <NotificationsBell />
              <Link href="/login" className="underline">Login</Link>
            </div>
          </header>
          <main className="p-4">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
