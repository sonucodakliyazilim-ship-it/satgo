'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, PlusCircle, MessageCircle, User } from 'lucide-react'
import { clsx } from 'clsx'

const items = [
  { href: '/', icon: Home, label: 'Ana Sayfa' },
  { href: '/ilanlar', icon: Search, label: 'Keşfet' },
  { href: '/ilan-ver', icon: PlusCircle, label: 'Sat', primary: true },
  { href: '/mesajlar', icon: MessageCircle, label: 'Mesajlar' },
  { href: '/profil', icon: User, label: 'Profil' },
]

export default function BottomNav() {
  const path = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex z-50 safe-area-bottom">
      {items.map(({ href, icon: Icon, label, primary }) => {
        const active = path === href
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
              primary ? 'text-brand' : active ? 'text-brand' : 'text-gray-400',
            )}
          >
            <Icon className={clsx('w-5 h-5', primary && 'text-brand')} strokeWidth={primary ? 2.5 : 2} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
