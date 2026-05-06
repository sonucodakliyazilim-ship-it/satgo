'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { bannersApi, listingsApi } from '@/lib/api'
import { API_BASE_URL } from '@/lib/config'
import ListingCard from '@/components/listings/ListingCard'
import { ArrowRight, ChevronLeft, ChevronRight, Zap } from 'lucide-react'

const API = API_BASE_URL
const img = (name: string) => `${API}/uploads/listings/${name}`

const HERO_SLIDES = [
  {
    title: 'Araç ve motor ilanlarını yakından incele',
    text: 'Gerçek fotoğraflı ilanlar, konuma göre sonuçlar ve hızlı teklif seçenekleri.',
    href: '/ilanlar?kategori=arac',
    image: img('demo-02-car-bmw.jpg'),
  },
  {
    title: 'Ev, eşya ve elektronik fırsatları',
    text: 'Telefon, bilgisayar, mobilya ve daha fazlası tek ekranda.',
    href: '/ilanlar?kategori=elektronik',
    image: img('demo-08-laptop-macbook.jpg'),
  },
  {
    title: 'Spor, hobi ve günlük ihtiyaçlar',
    text: 'Bisikletten kamp ekipmanına kadar yeni ilanları keşfet.',
    href: '/ilanlar?sortBy=newest',
    image: img('demo-18-bike.jpg'),
  },
]

const IMAGE_RAILS = [
  { label: 'Araç vitrinleri', href: '/ilanlar?kategori=arac', image: img('demo-01-car-golf.jpg') },
  { label: 'Motor sezonu', href: '/ilanlar?kategori=motor', image: img('demo-03-motor-pcx.jpg') },
  { label: 'Ev yenileme', href: '/ilanlar?kategori=ev-esyasi', image: img('demo-09-sofa.jpg') },
  { label: 'Telefon & laptop', href: '/ilanlar?kategori=elektronik', image: img('demo-07-phone-iphone.jpg') },
  { label: 'Spor outdoor', href: '/ilanlar?kategori=spor', image: img('demo-20-tent.jpg') },
  { label: 'Hobi ürünleri', href: '/ilanlar?search=hobi', image: img('demo-19-record-player.jpg') },
]

const MID_SLIDES = [
  { title: 'Popüler ikinci el ürünler', href: '/ilanlar?sortBy=popular', image: img('demo-12-sneaker.jpg') },
  { title: 'Ev için yeni fırsatlar', href: '/ilanlar?kategori=ev-esyasi', image: img('demo-10-dining-table.jpg') },
  { title: 'İş ve ofis ekipmanları', href: '/ilanlar?search=ofis', image: img('demo-15-office.jpg') },
]

const CATS = [
  { label: 'Araç', slug: 'arac', icon: '🚗', bg: 'bg-yellow-50' },
  { label: 'Telefon', slug: 'telefon', icon: '📱', bg: 'bg-violet-50' },
  { label: 'Motor', slug: 'motor', icon: '🏍', bg: 'bg-blue-50' },
  { label: 'Emlak', slug: 'emlak', icon: '🏠', bg: 'bg-green-50' },
  { label: 'Elektronik', slug: 'elektronik', icon: '💻', bg: 'bg-purple-50' },
  { label: 'Ev & Yaşam', slug: 'ev-esyasi', icon: '🛋', bg: 'bg-orange-50' },
  { label: 'Giyim', slug: 'giyim', icon: '👕', bg: 'bg-pink-50' },
  { label: 'Hizmet', slug: 'hizmet', icon: '🔧', bg: 'bg-teal-50' },
  { label: 'Spor', slug: 'spor', icon: '⚽', bg: 'bg-lime-50' },
  { label: 'Diğer', slug: 'diger', icon: '📦', bg: 'bg-gray-50' },
]

export default function HomePage() {
  const [featured, setFeatured] = useState<any[]>([])
  const [newest, setNewest] = useState<any[]>([])
  const [adminBanners, setAdminBanners] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [heroIndex, setHeroIndex] = useState(0)
  const [midIndex, setMidIndex] = useState(0)

  useEffect(() => {
    Promise.all([
      listingsApi.getAll({ featured: true, page: 1 }),
      listingsApi.getAll({ sortBy: 'newest', page: 1 }),
      bannersApi.getAll({ placement: 'home_hero' }),
    ])
      .then(([f, n, b]) => {
        setFeatured(f.data.data.listings.slice(0, 6))
        setNewest(n.data.data.listings.slice(0, 6))
        setAdminBanners(b.data.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % Math.max(adminBanners.length || HERO_SLIDES.length, 1))
      setMidIndex((current) => (current + 1) % MID_SLIDES.length)
    }, 4500)
    return () => window.clearInterval(timer)
  }, [adminBanners.length])

  const heroSlides = adminBanners.length
    ? adminBanners.map((banner) => ({
        title: banner.title,
        text: banner.subtitle || '',
        href: banner.href || '/ilanlar',
        image: banner.image_url?.startsWith('http') ? banner.image_url : `${API}${banner.image_url}`,
      }))
    : HERO_SLIDES
  const hero = heroSlides[heroIndex] || heroSlides[0]
  const mid = MID_SLIDES[midIndex]
  const visibleRail = useMemo(() => IMAGE_RAILS, [])

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-8">
      <section className="relative min-h-60 overflow-hidden rounded-lg bg-gray-900 md:min-h-72">
        <img src={hero.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/10" />
        <div className="relative z-10 flex min-h-60 max-w-2xl flex-col justify-center px-6 py-8 md:min-h-72 md:px-10">
          <h1 className="text-2xl md:text-4xl font-black text-white leading-tight">{hero.title}</h1>
          <p className="mt-3 max-w-lg text-sm md:text-base font-medium text-white/80">{hero.text}</p>
          <Link href={hero.href} className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-black text-white hover:bg-brand-dark">
            Ürünleri keşfet <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <SliderButton direction="left" onClick={() => setHeroIndex((heroIndex + heroSlides.length - 1) % heroSlides.length)} />
        <SliderButton direction="right" onClick={() => setHeroIndex((heroIndex + 1) % heroSlides.length)} />
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {heroSlides.map((slide, index) => (
            <button
              key={slide.title}
              aria-label={slide.title}
              onClick={() => setHeroIndex(index)}
              className={`h-2 rounded-full transition-all ${index === heroIndex ? 'w-7 bg-brand' : 'w-2 bg-white/70'}`}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Kategoriler</h2>
          <Link href="/ilanlar" className="text-sm text-brand font-semibold flex items-center gap-1 hover:underline">
            Tümü <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
          {CATS.map((c) => (
            <Link
              key={c.slug}
              href={`/ilanlar?kategori=${c.slug}`}
              className={`${c.bg} rounded-lg p-3 flex flex-col items-center gap-1.5 hover:scale-105 transition-transform border border-transparent hover:border-brand/20`}
            >
              <span className="text-2xl">{c.icon}</span>
              <span className="text-[11px] font-semibold text-gray-700 text-center leading-tight">{c.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Trend vitrinler</h2>
          <Link href="/ilanlar" className="text-sm text-brand font-semibold hover:underline">Tümü</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {visibleRail.map((item) => (
            <Link key={item.label} href={item.href} className="group overflow-hidden rounded-lg bg-white shadow-sm">
              <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                <img src={item.image} alt={item.label} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              </div>
              <p className="truncate px-3 py-2 text-xs font-black text-gray-700">{item.label}</p>
            </Link>
          ))}
        </div>
      </section>

      {(loading || featured.length > 0) && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" /> Öne Çıkan İlanlar
            </h2>
            <Link href="/ilanlar?featured=true" className="text-sm text-brand font-semibold hover:underline">
              Tümü
            </Link>
          </div>
          {loading ? <ListingSkeleton /> : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {featured.map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
          )}
        </section>
      )}

      <section className="relative overflow-hidden rounded-lg bg-gray-900">
        <img src={mid.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative z-10 flex min-h-40 items-center justify-between gap-4 px-5 py-6 md:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-brand-light">SATGO seçkisi</p>
            <h2 className="mt-1 max-w-xl text-2xl font-black text-white">{mid.title}</h2>
          </div>
          <Link href={mid.href} className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-black text-gray-900 hover:text-brand">
            İncele
          </Link>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">En Yeni İlanlar</h2>
          <Link href="/ilanlar?sortBy=newest" className="text-sm text-brand font-semibold hover:underline">
            Tümü
          </Link>
        </div>
        {loading ? <ListingSkeleton /> : newest.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {newest.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        ) : (
          <div className="card p-12 text-center text-gray-400">
            <p className="font-medium">Henüz ilan yok</p>
            <Link href="/ilan-ver" className="btn-brand inline-block mt-4 text-sm">
              İlk İlanı Sen Ver
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}

function SliderButton({ direction, onClick }: { direction: 'left' | 'right'; onClick: () => void }) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      aria-label={direction === 'left' ? 'Önceki görsel' : 'Sonraki görsel'}
      onClick={onClick}
      className={`absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-gray-900 shadow md:grid ${
        direction === 'left' ? 'left-4' : 'right-4'
      }`}
    >
      <Icon className="h-5 w-5" />
    </button>
  )
}

function ListingSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="card animate-pulse">
          <div className="aspect-[4/3] bg-gray-200 rounded-t-xl" />
          <div className="p-3 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-3 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
