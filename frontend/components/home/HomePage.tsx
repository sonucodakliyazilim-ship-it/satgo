'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Bike,
  ChevronRight,
  Coffee,
  Gamepad2,
  Heart,
  Laptop,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trophy,
} from 'lucide-react'
import { bannersApi, listingsApi } from '@/lib/api'
import { mediaUrl } from '@/lib/media'
import ListingCard from '@/components/listings/ListingCard'

const fallbackBanners = [
  {
    id: 'fallback-main',
    title: 'Aracını kolayca sat',
    subtitle: 'Net fotoğraf, doğru kategori ve hızlı alıcı.',
    href: '/ilanlar?kategori=arac',
    image_url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=82',
  },
  {
    id: 'fallback-electronics',
    title: 'Elektronik ilanları',
    subtitle: 'Telefon, bilgisayar ve aksesuarlar.',
    href: '/ilanlar?kategori=elektronik',
    image_url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=82',
  },
  {
    id: 'fallback-home',
    title: 'Ev ve yaşam',
    subtitle: 'Mobilya, beyaz eşya ve günlük ihtiyaçlar.',
    href: '/ilanlar?kategori=ev-esyasi',
    image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=82',
  },
]

const trendCategories = [
  { label: 'Güvenli Alışveriş', href: '/ilanlar?sortBy=favorites', icon: ShieldCheck, tint: 'from-sky-500 to-cyan-300' },
  { label: 'Araç Vitrini', href: '/ilanlar?kategori=arac', icon: Trophy, tint: 'from-orange-500 to-amber-300' },
  { label: 'Telefon', href: '/ilanlar?search=telefon', icon: Smartphone, tint: 'from-blue-500 to-sky-300' },
  { label: 'Bilgisayar', href: '/ilanlar?search=bilgisayar', icon: Laptop, tint: 'from-indigo-500 to-blue-300' },
  { label: 'Oyun & Konsol', href: '/ilanlar?search=oyun', icon: Gamepad2, tint: 'from-purple-500 to-fuchsia-300' },
  { label: 'Ev Elektroniği', href: '/ilanlar?search=kahve makinesi', icon: Coffee, tint: 'from-stone-700 to-orange-300' },
  { label: 'Favoriler', href: '/ilanlar?sortBy=favorites', icon: Heart, tint: 'from-rose-500 to-pink-300' },
  { label: 'Spor & Outdoor', href: '/ilanlar?search=fitness', icon: Bike, tint: 'from-emerald-500 to-lime-300' },
]

const listingSectionConfigs = [
  {
    key: 'popular',
    title: 'Popüler ikinci el ilanlar',
    subtitle: 'Satgo’da en çok incelenen fırsatlar',
    href: '/ilanlar?sortBy=popular',
    params: { sortBy: 'popular' },
  },
  {
    key: 'favorites',
    title: 'Favoriler',
    subtitle: 'En çok favoriye eklenen ilanlar',
    href: '/ilanlar?sortBy=favorites',
    params: { sortBy: 'favorites' },
  },
  {
    key: 'best-sellers',
    title: 'Hızlı satılanlar',
    subtitle: 'Alıcıların hızlı karar verdiği seçimler',
    href: '/ilanlar?sortBy=boosted',
    params: { sortBy: 'boosted' },
    fallbackParams: { sortBy: 'newest' },
  },
  {
    key: 'weekly-stars',
    title: 'Haftanın yıldızları',
    subtitle: 'Öne çıkan ve vitrindeki ilanlar',
    href: '/ilanlar?sortBy=boosted',
    params: { sortBy: 'boosted', featured: true },
    fallbackParams: { sortBy: 'newest' },
  },
]

export default function HomePage() {
  const [banners, setBanners] = useState<any[]>([])
  const [listingSections, setListingSections] = useState<any[]>([])
  const [loadingSections, setLoadingSections] = useState(true)

  useEffect(() => {
    bannersApi
      .getAll({ placement: 'home_hero' })
      .then(({ data }) => setBanners(data.data?.length ? data.data : fallbackBanners))
      .catch(() => setBanners(fallbackBanners))
  }, [])

  useEffect(() => {
    let mounted = true
    setLoadingSections(true)

    listingsApi
      .getHomeSections()
      .then(({ data }) => {
        if (mounted && data.data?.length) setListingSections(data.data)
      })
      .catch(() =>
        Promise.all(
          listingSectionConfigs.map(async (section) => {
            try {
              const { data } = await listingsApi.getAll({ ...section.params, page: 1 })
              let listings = data.data?.listings || []

              if (!listings.length && section.fallbackParams) {
                const fallback = await listingsApi.getAll({ ...section.fallbackParams, page: 1 })
                listings = fallback.data.data?.listings || []
              }

              return { ...section, listings: listings.slice(0, 4) }
            } catch {
              return { ...section, listings: [] }
            }
          }),
        ).then((sections) => {
          if (mounted) setListingSections(sections)
        }),
      )
      .finally(() => {
        if (mounted) setLoadingSections(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const hero = banners[0] || fallbackBanners[0]
  const heroImage = mediaUrl(hero.image_url)
  const secondaryBanners = banners.length > 1 ? banners.slice(1, 3) : fallbackBanners.slice(1, 3)
  const visibleSections = useMemo(
    () => listingSections.filter((section) => Array.isArray(section.listings) && section.listings.length),
    [listingSections],
  )

  return (
    <main className="bg-white pb-24 md:pb-10">
      <section className="mx-auto max-w-6xl px-3 pt-4 sm:px-4 sm:pt-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]">
          <Link
            href={hero.href || '/ilanlar'}
            className="group relative block min-h-[220px] overflow-hidden rounded-lg bg-gray-900 text-white shadow-sm sm:min-h-[286px]"
          >
            {heroImage && (
              <img
                src={heroImage}
                alt={hero.title}
                className="absolute inset-0 h-full w-full object-cover opacity-95 transition-transform duration-500 group-hover:scale-[1.02]"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />
            <div className="relative flex min-h-[220px] max-w-xl flex-col justify-end p-5 sm:min-h-[286px] sm:p-7">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/75">Satgo</p>
              <h1 className="text-3xl font-black leading-tight sm:text-4xl">{hero.title}</h1>
              {hero.subtitle && <p className="mt-2 max-w-md text-sm font-semibold text-white/85 sm:text-base">{hero.subtitle}</p>}
              <span className="mt-5 inline-flex h-10 w-36 items-center justify-center rounded-full bg-white text-sm font-black text-brand-dark">
                İlanları keşfet
              </span>
            </div>
          </Link>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {secondaryBanners.map((banner, index) => {
              const bannerImage = mediaUrl(banner.image_url)
              return (
                <Link
                  key={banner.id}
                  href={banner.href || '/ilanlar'}
                  className="group relative min-h-[132px] overflow-hidden rounded-lg bg-gray-900 text-white shadow-sm"
                >
                  {bannerImage && (
                    <img
                      src={bannerImage}
                      alt={banner.title}
                      className="absolute inset-0 h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />
                  <div className="relative flex min-h-[132px] flex-col justify-end p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/70">
                      {index === 0 ? 'Kategori' : 'Vitrin'}
                    </p>
                    <h2 className="mt-1 text-lg font-black leading-tight">{banner.title}</h2>
                    {banner.subtitle && <p className="mt-1 line-clamp-1 text-xs font-semibold text-white/75">{banner.subtitle}</p>}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-3 pt-4 sm:px-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-black text-gray-900">Trend Kategoriler</h2>
          <Link href="/ilanlar" className="text-sm font-black text-brand hover:text-brand-dark">
            Tümünü gör
          </Link>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {trendCategories.map((category) => {
            const Icon = category.icon
            return (
              <Link
                key={category.label}
                href={category.href}
                className={`relative h-16 w-36 shrink-0 overflow-hidden rounded-lg bg-gradient-to-r ${category.tint} p-2 text-white shadow-sm sm:w-40`}
              >
                <Icon className="absolute right-3 top-2 h-10 w-10 text-white/75" />
                <span className="absolute bottom-2 left-2 right-2 text-xs font-black leading-tight">{category.label}</span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-3 pt-3 sm:px-4">
        <Link
          href="/ilan-ver"
          className="flex min-h-[72px] items-center justify-between gap-4 overflow-hidden rounded-lg bg-gray-950 px-4 py-3 text-white shadow-sm"
        >
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">Satıcı paneli</p>
            <h2 className="truncate text-lg font-black sm:text-2xl">İlanını hızlıca yayınla</h2>
            <p className="hidden text-sm font-semibold text-white/70 sm:block">Kategori, detay ve fotoğraf yükleme tek akışta.</p>
          </div>
          <span className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full bg-white px-4 text-sm font-black text-gray-950">
            İlan Ver <ChevronRight className="h-4 w-4" />
          </span>
        </Link>
      </section>

      <section className="mx-auto max-w-6xl px-3 pt-5 sm:px-4 sm:pt-7">
        {loadingSections && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
                <div className="aspect-[4/3] animate-pulse bg-gray-100" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100" />
                  <div className="h-3 animate-pulse rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-8">
          {visibleSections.map((section) => (
            <div key={section.key}>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-gray-900 sm:text-xl">{section.title}</h2>
                  <p className="mt-0.5 text-xs font-semibold text-gray-500 sm:text-sm">{section.subtitle}</p>
                </div>
                <Link href={section.href} className="shrink-0 text-sm font-black text-brand hover:text-brand-dark">
                  Tümünü gör
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {section.listings.map((listing: any) => (
                  <ListingCard key={`${section.key}-${listing.id}`} listing={listing} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {!loadingSections && !visibleSections.length && (
          <div className="rounded-lg border border-dashed border-gray-200 p-10 text-center">
            <Sparkles className="mx-auto mb-3 h-8 w-8 text-brand" />
            <h2 className="text-lg font-black text-gray-900">Vitrin ilanları hazırlanıyor</h2>
            <p className="mt-1 text-sm font-semibold text-gray-500">İlk ilanlar yayına alındığında burada görünecek.</p>
            <Link href="/ilan-ver" className="btn-brand mt-5 inline-flex px-5 py-2 text-sm">
              İlk ilanı sen ver
            </Link>
          </div>
        )}
      </section>
    </main>
  )
}
