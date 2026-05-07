'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { bannersApi } from '@/lib/api'
import { mediaUrl } from '@/lib/media'
import ListingsPage from '@/app/ilanlar/page'

const fallbackBanners = [
  {
    id: 'fallback-sell',
    title: 'Satgo vitrininde ilanini one cikar',
    subtitle: 'Arac, telefon, elektronik ve daha fazlasi icin hizli ilan yayini.',
    href: '/ilan-ver',
    image_url: '/satgo-logo.jpeg',
  },
  {
    id: 'fallback-promote',
    title: 'Kampanyali one cikarma paketleri',
    subtitle: 'Haftalik, acil ve vitrin paketleriyle daha fazla gorunurluk al.',
    href: '/ilanlar',
    image_url: '/satgo-logo.jpeg',
  },
]

export default function HomePage() {
  const [banners, setBanners] = useState<any[]>([])

  useEffect(() => {
    bannersApi
      .getAll({ placement: 'home_hero' })
      .then(({ data }) => setBanners(data.data?.length ? data.data : fallbackBanners))
      .catch(() => setBanners(fallbackBanners))
  }, [])

  const visibleBanners = banners.length ? banners : fallbackBanners

  return (
    <>
      <section className="mx-auto max-w-7xl px-3 pt-4 sm:px-4 sm:pt-6">
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
          {visibleBanners.slice(0, 2).map((banner, index) => (
            <Link
              key={banner.id || banner.title}
              href={banner.href || '/ilanlar'}
              className={`group relative min-h-[156px] overflow-hidden rounded-lg border border-gray-100 bg-gray-950 text-white shadow-sm ${
                index === 0 ? 'md:min-h-[230px]' : 'md:min-h-[230px]'
              }`}
            >
              {mediaUrl(banner.image_url) && (
                <img
                  src={mediaUrl(banner.image_url) || ''}
                  alt={banner.title}
                  className="absolute inset-0 h-full w-full object-cover opacity-45 transition-transform duration-300 group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/10" />
              <div className="relative flex h-full max-w-xl flex-col justify-end p-5 sm:p-6">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-brand">Satgo Kampanya</p>
                <h1 className="text-2xl font-black leading-tight sm:text-3xl">{banner.title}</h1>
                {banner.subtitle && <p className="mt-2 max-w-md text-sm font-semibold text-white/80">{banner.subtitle}</p>}
              </div>
            </Link>
          ))}
        </div>
      </section>
      <ListingsPage />
    </>
  )
}
