'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  Bell,
  Bike,
  Car,
  ChevronDown,
  ChevronRight,
  Coffee,
  Gamepad2,
  Heart,
  Laptop,
  MapPin,
  Monitor,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sofa,
  Smartphone,
  Sparkles,
  Trophy,
  Truck,
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

const mobileCategories = [
  { label: 'Araba', href: '/ilanlar?kategori=arac', icon: Car, color: 'bg-blue-600' },
  { label: 'Telefon', href: '/ilanlar?search=telefon', icon: Smartphone, color: 'bg-violet-500' },
  { label: 'Elektronik', href: '/ilanlar?kategori=elektronik', icon: Monitor, color: 'bg-teal-400' },
  { label: 'Ev & Yaşam', href: '/ilanlar?kategori=ev-esyasi', icon: Sofa, color: 'bg-yellow-400' },
  { label: 'Motosiklet', href: '/ilanlar?kategori=motor', icon: Truck, color: 'bg-orange-500' },
  { label: 'Aksesuar', href: '/ilanlar?kategori=giyim', icon: Sparkles, color: 'bg-rose-500' },
]

const mobileTrendCards = [
  { label: 'Cüzdanım Güvende', icon: ShieldCheck, href: '/ilanlar?sortBy=favorites' },
  { label: 'Yerinde İncele, Kartla Öde', icon: Trophy, href: '/ilanlar?sortBy=popular' },
  { label: 'Telefon Fırsatları', icon: Smartphone, href: '/ilanlar?search=telefon' },
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
  const mobileListings = useMemo(
    () => visibleSections.flatMap((section) => section.listings).slice(0, 8),
    [visibleSections],
  )

  return (
    <main className="bg-white pb-10">
      <div className="md:hidden bg-[#303030] pb-28 text-white">
        <MobileHero />

        <section className="border-t border-black/20 bg-[#242424] px-4 pb-4 pt-5">
          <div className="flex gap-5 overflow-x-auto pb-1 scrollbar-hide">
            {mobileCategories.map((category) => {
              const Icon = category.icon
              return (
                <Link key={category.label} href={category.href} className="flex w-[74px] shrink-0 flex-col items-center gap-2">
                  <span className={`grid h-14 w-14 place-items-center rounded-full ${category.color}`}>
                    <Icon className="h-7 w-7 text-white" />
                  </span>
                  <span className="text-center text-xs font-black leading-tight text-white/75">{category.label}</span>
                </Link>
              )
            })}
          </div>
        </section>

        <section className="px-4 pb-4 pt-3">
          <Link href={hero.href || '/ilanlar'} className="relative block min-h-[116px] overflow-hidden rounded-lg bg-[#ff3458]">
            {heroImage && <img src={heroImage} alt={hero.title} className="absolute inset-0 h-full w-full object-cover opacity-35" />}
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/25 to-transparent" />
            <div className="relative flex min-h-[116px] max-w-[76%] flex-col justify-center p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/70">Satgo</p>
              <h1 className="mt-1 line-clamp-2 text-lg font-black leading-tight">{hero.title}</h1>
              <span className="mt-3 inline-flex h-9 w-36 items-center justify-center rounded-full bg-[#ff3458] text-sm font-black text-white">
                Ürünleri Keşfet
              </span>
            </div>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/45 px-2 py-1 text-xs font-black">1/{Math.max(banners.length, 1)}</span>
          </Link>
        </section>

        <section className="px-4 pb-4">
          <h2 className="mb-3 text-xl font-black text-white/85">Trend Kategoriler</h2>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {mobileTrendCards.map((card) => {
              const Icon = card.icon
              return (
                <Link key={card.label} href={card.href} className="w-[190px] shrink-0">
                  <div className="grid aspect-[16/8] place-items-center rounded-lg bg-[#21aeea]">
                    <Icon className="h-14 w-14 text-white" />
                  </div>
                  <p className="mt-2 text-sm font-black text-white/70">{card.label}</p>
                </Link>
              )
            })}
          </div>
        </section>

        <section className="border-t border-black/25 px-4 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-white/85">Sepete Ekle, Güvenle Kapına Gelsin!</h2>
            <Link href="/ilanlar" className="shrink-0 rounded-full bg-black px-4 py-2 text-sm font-black text-white">
              Tümünü Gör
            </Link>
          </div>
          {mobileListings.length ? (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {mobileListings.map((listing: any) => (
                <MobileListingTile key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-white/10 bg-[#202020] p-5 text-sm font-semibold text-white/65">
              İlk vitrin ilanları eklendiğinde burada kart olarak görünecek.
            </div>
          )}
        </section>

        <section className="px-4 pb-4">
          <Link href="/ilanlar?sortBy=popular" className="relative flex min-h-[112px] items-center gap-4 overflow-hidden rounded-lg bg-[#3b3b3b] p-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-[#21aeea]">
              <ShieldCheck className="h-10 w-10 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black leading-tight">Ürünü yerinde incele, kartla ödeme ve taksit seçeneğiyle satın al.</h2>
              <span className="mt-3 inline-flex rounded-full bg-black px-4 py-2 text-sm font-black">İlanları Gör</span>
            </div>
          </Link>
        </section>
      </div>

      <div className="hidden md:block">
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
      </div>
    </main>
  )
}

function MobileHero() {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const term = search.trim()
    if (term) router.push(`/ilanlar?search=${encodeURIComponent(term)}`)
  }

  return (
    <section className="bg-[#202020] px-4 pb-5 pt-5">
      <div className="flex items-center gap-3">
        <Link href="/" className="mr-auto text-[34px] font-black italic leading-none tracking-tight text-white">
          satgo
        </Link>
        <Link
          href="/ilanlar?city=Antalya"
          className="flex h-11 max-w-[170px] items-center gap-2 rounded-full bg-[#303030] px-3 text-sm font-black text-white"
        >
          <MapPin className="h-5 w-5 shrink-0 text-[#ff3458]" />
          <span className="truncate">Antalya, Ala...</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[#ff3458]" />
        </Link>
        <Link href="/ilanlar?sortBy=popular" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#303030]">
          <ShoppingCart className="h-6 w-6 text-white" />
        </Link>
        <Link href="/mesajlar" className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#303030]">
          <Bell className="h-6 w-6 text-white" />
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#ff3458] px-1 text-xs font-black text-white">
            4
          </span>
        </Link>
      </div>

      <form onSubmit={handleSearch} className="relative mt-5">
        <Search className="absolute left-4 top-1/2 h-7 w-7 -translate-y-1/2 text-white/60" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Ürün, marka, kategori, satıcı ara"
          className="h-[58px] w-full rounded-full border-0 bg-[#3d3d3d] pl-14 pr-5 text-base font-black text-white placeholder:text-white/55 focus:outline-none focus:ring-2 focus:ring-[#ff3458]"
        />
      </form>
    </section>
  )
}

function MobileListingTile({ listing }: { listing: any }) {
  const [imageFailed, setImageFailed] = useState(false)
  const imgSrc = mediaUrl(listing.primary_image)
  const price = Number(listing.price || 0).toLocaleString('tr-TR')

  return (
    <article className="w-[190px] shrink-0 overflow-hidden rounded-lg bg-black text-white">
      <Link href={`/ilan/${listing.id}`} className="relative block aspect-[4/5] overflow-hidden bg-[#4a4a4a]">
        {imgSrc && !imageFailed ? (
          <img
            src={imgSrc}
            alt={listing.title}
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[#21aeea] text-4xl font-black text-white">
            {listing.category_icon || 'SATGO'}
          </div>
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-yellow-300 px-3 py-1.5 text-xs font-black text-black">
          <Sparkles className="h-3.5 w-3.5 fill-black" />
          Öne Çıkan
        </span>
        <span className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-[#252525]/90">
          <Heart className="h-6 w-6 text-white" />
        </span>
        <span className="absolute bottom-3 left-3 inline-flex max-w-[136px] items-center gap-1 rounded-lg bg-[#252525]/90 px-2 py-1.5 text-[11px] font-black leading-tight">
          <ShieldCheck className="h-5 w-5 shrink-0 fill-lime-500 text-lime-500" />
          Cüzdanım Güvende
        </span>
      </Link>
      <div className="p-3">
        <Link href={`/ilan/${listing.id}`} className="block">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-2xl font-black">{price} TL</p>
            <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-black text-[#222]">12 taksit!</span>
          </div>
          <p className="mt-2 line-clamp-1 text-base font-medium text-white/70">{listing.title}</p>
        </Link>
        <Link
          href={`/ilan/${listing.id}`}
          className="mt-4 flex h-11 items-center justify-center gap-2 rounded-full bg-[#ff3458] text-base font-black text-white"
        >
          <ShoppingCart className="h-5 w-5" />
          Sepete Ekle
        </Link>
      </div>
    </article>
  )
}
