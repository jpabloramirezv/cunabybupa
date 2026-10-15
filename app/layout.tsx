import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Montserrat } from 'next/font/google'
import { SmartZoom } from '@/components/cuna/smart-zoom'
import './globals.css'

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'CUNA by Bupa Reñaca',
  description:
    'Captura Unificada de Neonatos Admitidos: registro interno de recién nacidos hospitalizados en la UPC Neonatología de Clínica Bupa Reñaca.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#0f1c55',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es-CL" className={`${montserrat.variable} bg-background`}>
      <body className="min-h-dvh antialiased">
        {children}
        <SmartZoom />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
