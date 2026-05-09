'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Camera, Grid3X3, Home, MessageCircle, User } from 'lucide-react'
import { clsx } from 'clsx'

const items = [
  { href: '/', icon: Home, label: 'Ana Sayfa' },
  { href: '/mesajlar', icon: MessageCircle, label: 'Sohbet' },
  { href: '/ilan-ver', icon: Camera, label: 'Sat', primary: true },
  { href: '/profil', icon: Grid3X3, label: 'İlanlarım' },
  { href: '/profil', icon: User, label: 'Hesabım' },
]

export default function BottomNav() {
  const path = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[82px] bg-[#1f1f1f] border-t border-white/5 flex z-50 safe-area-bottom px-2">
      {items.map(({ href, icon: Icon, label, primary }) => {
        const active = path === href
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-black transition-colors',
              primary ? '-mt-7 text-white' : active ? 'text-[#ff3b5f]' : 'text-gray-400',
            )}
          >
            <span
              className={clsx(
                'grid place-items-center',
                primary
                  ? 'h-16 w-16 rounded-full border-[6px] border-[#2c2c2c] bg-[#ff3458] shadow-xl'
                  : 'h-7 w-7',
              )}
            >
              <Icon className={clsx(primary ? 'h-8 w-8 text-white' : 'h-6 w-6')} strokeWidth={primary ? 2.7 : 2.5} />
            </span>
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
