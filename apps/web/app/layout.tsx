import './globals.css'
import Providers from './providers'

export const metadata = {
  title: 'Teleplatform',
  description: 'HIPAA-eligible telehealth platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-900">
        <Providers>
          <header className="p-4 border-b">Teleplatform</header>
          <main className="p-4">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
