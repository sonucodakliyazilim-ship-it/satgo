'use client'

import './globals.css'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import Navbar from '@/components/layout/Navbar'
import BottomNav from '@/components/layout/BottomNav'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fetchMe = useAuthStore((s) => s.fetchMe)
  const pathname = usePathname()

  useEffect(() => {
    if (pathname === '/') return
    fetchMe()
  }, [fetchMe, pathname])

  return (
    <html lang="tr">
      <head>
        <title>ilanGO - Türkiye&apos;nin İlan Platformu</title>
        <meta name="description" content="İlan ver, ara, bul. Araç, emlak, elektronik ve daha fazlası." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#F5F4F0] font-sans min-h-screen">
        <Navbar />
        <main className="pb-20 md:pb-0">{children}</main>
        <BottomNav />
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      </body>
    </html>
  )
}
