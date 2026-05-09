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
    title: 'Satgo’da temiz ilan, hızlı alıcı.',
    subtitle: 'Araçtan elektroniğe, güven veren ilanları şehir ve kategoriye göre keşfet.',
    href: '/ilanlar',
    image_url: '/satgo-logo.jpeg',
  },
  {
    id: 'fallback-vehicle',
    title: 'Araç ilanlarında marka, model, paket seçimi hazır.',
    subtitle: 'BMW X5 xDrive gibi net filtrelerle doğru alıcıya daha hızlı ulaş.',
    href: '/ilanlar?kategori=arac',
    image_url: '/satgo-logo.jpeg',
  },
  {
    id: 'fallback-sell',
    title: 'İlanını dakikalar içinde yayına hazırla.',
    subtitle: 'Fotoğrafını ekle, kategorini seç, ilanını vitrine taşı.',
    href: '/ilan-ver',
    image_url: '/satgo-logo.jpeg',
  },
]

const trendCategories = [
  { label: 'Cüzdanım Güvende', href: '/ilanlar?sortBy=favorites', icon: ShieldCheck, tint: 'from-sky-500 to-cyan-300' },
  { label: 'Yerinde İncele', href: '/ilanlar?search=araç', icon: Trophy, tint: 'from-orange-500 to-amber-300' },
  { label: 'Telefon', href: '/ilanlar?search=telefon', icon: Smartphone, tint: 'from-blue-500 to-sky-300' },
  { label: 'Bilgisayar', href: '/ilanlar?search=bilgisayar', icon: Laptop, tint: 'from-indigo-500 to-blue-300' },
  { label: 'Oyunculara Özel', href: '/ilanlar?search=oyun', icon: Gamepad2, tint: 'from-purple-500 to-fuchsia-300' },
  { label: 'Kahve Makinesi', href: '/ilanlar?search=kahve makinesi', icon: Coffee, tint: 'from-stone-700 to-orange-300' },
  { label: 'En Çok Beğenilenler', href: '/ilanlar?sortBy=favorites', icon: Heart, tint: 'from-rose-500 to-pink-300' },
  { label: 'Fitness Sporları', href: '/ilanlar?search=fitness', icon: Bike, tint: 'from-emerald-500 to-lime-300' },
]

const listingSectionConfigs = [
  {
    key: 'popular',
    title: 'Popüler İkinci El İlanlar',
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
    title: 'Çok Satanlar',
    subtitle: 'Hızlı karar verilen kategorilerden seçtiklerimiz',
    href: '/ilanlar?sortBy=boosted',
    params: { sortBy: 'boosted' },
    fallbackParams: { sortBy: 'newest' },
  },
  {
    key: 'weekly-stars',
    title: 'Haftanın Yıldızları',
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
    )
      .then((sections) => {
        if (mounted) setListingSections(sections)
      })
      .finally(() => {
        if (mounted) setLoadingSections(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const hero = banners[0] || fallbackBanners[0]
  const heroImage = mediaUrl(hero.image_url)
  const secondaryBanners = banners.slice(1, 3)
  const visibleSections = useMemo(
    () => listingSections.filter((section) => section.listings.length),
    [listingSections],
  )

  return (
    <main className="bg-white pb-10">
      <section className="mx-auto max-w-6xl px-3 pt-4 sm:px-4 sm:pt-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
        <Link
          href={hero.href || '/ilanlar'}
          className="group relative block min-h-[210px] overflow-hidden rounded-lg bg-[#8f35e5] text-white shadow-sm sm:min-h-[280px]"
        >
          {heroImage && (
            <img
              src={heroImage}
              alt={hero.title}
              className="absolute inset-0 h-full w-full object-cover opacity-30 transition-transform duration-500 group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-700/95 via-purple-600/85 to-fuchsia-500/70" />
          <div className="absolute right-5 top-1/2 hidden -translate-y-1/2 items-end gap-4 md:flex">
            <div className="grid h-28 w-28 place-items-center rounded-lg bg-white/15 backdrop-blur">
              <Smartphone className="h-16 w-16 text-white" />
            </div>
            <div className="grid h-40 w-48 place-items-center rounded-lg bg-white/15 backdrop-blur">
              <Gamepad2 className="h-24 w-24 text-white" />
            </div>
            <div className="grid h-32 w-32 place-items-center rounded-lg bg-white/15 backdrop-blur">
              <Laptop className="h-20 w-20 text-white" />
            </div>
          </div>
          <div className="relative flex min-h-[210px] max-w-2xl flex-col justify-center p-6 sm:min-h-[280px] sm:p-8">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-white/80">Satgo Kampanya</p>
            <h1 className="text-3xl font-black leading-tight sm:text-5xl">{hero.title}</h1>
            {hero.subtitle && <p className="mt-3 max-w-lg text-sm font-semibold text-white/85 sm:text-base">{hero.subtitle}</p>}
            <span className="mt-6 inline-flex h-11 w-44 items-center justify-center rounded-full bg-white text-sm font-black text-[#7b2bd4]">
              Keşfet
            </span>
          </div>
        </Link>
        {!!secondaryBanners.length && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {secondaryBanners.map((banner, index) => {
              const bannerImage = mediaUrl(banner.image_url)
              return (
                <Link
                  key={banner.id}
                  href={banner.href || '/ilanlar'}
                  className={`group relative min-h-[132px] overflow-hidden rounded-lg text-white shadow-sm ${
                    index === 0 ? 'bg-gray-950' : 'bg-brand-dark'
                  }`}
                >
                  {bannerImage && (
                    <img
                      src={bannerImage}
                      alt={banner.title}
                      className="absolute inset-0 h-full w-full object-cover opacity-25 transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/75 to-black/25" />
                  <div className="relative flex min-h-[132px] flex-col justify-center p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/70">
                      {index === 0 ? 'Araç vitrini' : 'Hızlı satış'}
                    </p>
                    <h2 className="mt-2 text-lg font-black leading-tight">{banner.title}</h2>
                    {banner.subtitle && <p className="mt-2 line-clamp-2 text-xs font-semibold text-white/75">{banner.subtitle}</p>}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-3 pt-4 sm:px-4">
        <h2 className="mb-2 text-sm font-black text-gray-900">Trend Kategoriler</h2>
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
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">Vitrin fırsatı</p>
            <h2 className="truncate text-lg font-black sm:text-2xl">İlanını dakikalar içinde yayına hazırla</h2>
            <p className="hidden text-sm font-semibold text-white/70 sm:block">Sat, öne çıkar, daha hızlı alıcı bul.</p>
          </div>
          <span className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full bg-white px-4 text-sm font-black text-gray-950">
            Sat <ChevronRight className="h-4 w-4" />
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
          </div>
        )}
      </section>
    </main>
  )
}
