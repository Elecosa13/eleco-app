import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Eleco SA',
  description: 'Gestion de chantiers — Eleco SA',
  manifest: '/manifest.json',
  themeColor: '#185FA5',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
