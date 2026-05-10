'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, MessageCircle, PlusCircle, Search, User } from 'lucide-react'
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex z-50 safe-area-bottom shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
      {items.map(({ href, icon: Icon, label, primary }) => {
        const active = path === href || (href !== '/' && path.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-bold transition-colors',
              active ? 'text-brand' : 'text-gray-500',
            )}
          >
            <span
              className={clsx(
                'grid place-items-center',
                primary
                  ? 'h-10 w-10 rounded-full bg-brand text-white shadow-sm'
                  : 'h-6 w-6',
              )}
            >
              <Icon className={clsx(primary ? 'h-6 w-6' : 'h-5 w-5')} strokeWidth={primary ? 2.6 : 2.3} />
            </span>
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
