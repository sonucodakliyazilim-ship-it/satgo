import './globals.css'
import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import Navbar from '@/components/layout/Navbar'
import BottomNav from '@/components/layout/BottomNav'
import ClientBootstrap from '@/components/layout/ClientBootstrap'
import MessageNotifications from '@/components/layout/MessageNotifications'

export const metadata: Metadata = {
  title: 'Satgo - Turkiye ilan platformu',
  description: 'Ilan ver, ara, bul. Arac, emlak, elektronik ve daha fazlasi.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <meta name="satgo-build" content={process.env.NEXT_PUBLIC_APP_BUILD || ''} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#F5F4F0] font-sans">
        <ClientBootstrap />
        <MessageNotifications />
        <Navbar />
        <main className="pb-20 md:pb-0">{children}</main>
        <BottomNav />
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      </body>
    </html>
  )
}
