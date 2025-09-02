import './globals.css'

export const metadata = {
  title: 'Teleplatform',
  description: 'HIPAA-eligible telehealth platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-900">{children}</body>
    </html>
  )
}
