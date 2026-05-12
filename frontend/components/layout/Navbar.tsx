'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Baby,
  Bike,
  BookOpen,
  BriefcaseBusiness,
  Camera,
  Car,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Grid3X3,
  Heart,
  Home,
  LocateFixed,
  LogOut,
  MapPin,
  MessageCircle,
  PawPrint,
  Search,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Smartphone,
  Gem,
  Sparkles,
  Trophy,
  Truck,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { categoriesApi, hierarchyApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { findNearestCity, getDistricts, LOCATIONS } from '@/lib/locations'

type CategoryColumn = {
  title: string
  items?: string[]
  href?: string
}

type NavCategory = {
  id?: string | number
  name: string
  slug: string
  icon?: string
  sub_categories?: NavCategory[]
}

type HierarchyNode = {
  id: string
  label: string
  children?: HierarchyNode[]
}

const USER_PANEL_LINKS = [
  { href: '/profil', icon: ShoppingBag, label: 'Aldıklarım & Sattıklarım' },
  { href: '/mesajlar', icon: CircleDollarSign, label: 'Tekliflerim' },
  { href: '/profil', icon: Grid3X3, label: 'İlanlarım' },
  { href: '/mesajlar', icon: MessageCircle, label: 'Mesajlarım' },
  { href: '/favoriler', icon: Heart, label: 'Favorilerim' },
]

const CATEGORY_META: Record<string, { icon: any; color: string }> = {
  arac: { icon: Car, color: 'bg-blue-600' },
  motor: { icon: Bike, color: 'bg-orange-500' },
  emlak: { icon: Home, color: 'bg-emerald-500' },
  elektronik: { icon: Smartphone, color: 'bg-teal-500' },
  telefon: { icon: Smartphone, color: 'bg-violet-500' },
  'ev-esyasi': { icon: Home, color: 'bg-yellow-400' },
  giyim: { icon: Shirt, color: 'bg-rose-400' },
  hizmet: { icon: BriefcaseBusiness, color: 'bg-sky-500' },
  'is-ilanlari': { icon: BriefcaseBusiness, color: 'bg-indigo-500' },
  spor: { icon: Trophy, color: 'bg-lime-500' },
  'spor-outdoor': { icon: Bike, color: 'bg-lime-500' },
  'kisisel-bakim-kozmetik': { icon: Sparkles, color: 'bg-purple-500' },
  'anne-bebek-oyuncak': { icon: Baby, color: 'bg-sky-400' },
  'hobi-kitap-muzik': { icon: BookOpen, color: 'bg-pink-400' },
  'ofis-kirtasiye': { icon: BriefcaseBusiness, color: 'bg-yellow-500' },
  'diger-araclar': { icon: Truck, color: 'bg-sky-600' },
  antika: { icon: Gem, color: 'bg-amber-600' },
  'pet-shop': { icon: PawPrint, color: 'bg-emerald-500' },
  diger: { icon: Grid3X3, color: 'bg-gray-600' },
}

const groupFromCategory = (category?: NavCategory) => {
  if (!category?.slug) return ''
  if (category.slug === 'arac') return 'vehicle'
  if (category.slug === 'motor') return 'motor'
  return category.slug
}

const initialFromName = (name?: string | null) => {
  const t = (name || '').trim()
  return (t[0] || '?').toUpperCase()
}

const categoryHref = (category: NavCategory) => `/ilanlar?kategori=${encodeURIComponent(category.slug)}`
const categorySearchHref = (category: NavCategory, term: string) =>
  `${categoryHref(category)}&search=${encodeURIComponent(term)}`

const fallbackColumnsForCategory = (category?: NavCategory): CategoryColumn[] => {
  if (!category) return []
  return (category.sub_categories || []).map((item) => ({ title: item.name, href: categorySearchHref(category, item.name) }))
}

const columnsFromHierarchy = (category: NavCategory | undefined, nodes: HierarchyNode[]): CategoryColumn[] => {
  if (!category || !nodes.length) return fallbackColumnsForCategory(category)
  return nodes.slice(0, 36).map((node) => ({
    title: node.label,
    href: categorySearchHref(category, node.label),
    items: (node.children || []).slice(0, 12).map((child) => child.label),
  }))
}

export default function Navbar() {
  const { user, logout, selectedCity, selectedDistrict, setSelectedLocation } = useAuthStore()
  const router = useRouter()
  const [categories, setCategories] = useState<NavCategory[]>([])
  const [hierarchyByGroup, setHierarchyByGroup] = useState<Record<string, HierarchyNode[]>>({})
  const [hierarchyLoading, setHierarchyLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const [locationCityDraft, setLocationCityDraft] = useState(selectedCity)
  const [locationDistrictDraft, setLocationDistrictDraft] = useState(selectedDistrict)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState(0)

  const menuCategories = categories
  const activeMenuCategory = menuCategories[activeCategory] || menuCategories[0]
  const activeGroup = groupFromCategory(activeMenuCategory)
  const activeHierarchy = hierarchyByGroup[activeGroup] || []
  const activeColumns = useMemo(
    () => columnsFromHierarchy(activeMenuCategory, activeHierarchy),
    [activeMenuCategory, activeHierarchy],
  )
  const activeMeta = CATEGORY_META[activeMenuCategory?.slug || ''] || CATEGORY_META.diger
  const ActiveIcon = activeMeta.icon
  const locationLabel = selectedCity
    ? selectedDistrict
      ? `${selectedCity}, ${selectedDistrict}`
      : selectedCity
    : 'Her Yer'

  useEffect(() => {
    categoriesApi
      .getAll()
      .then(({ data }) => setCategories(data.data || []))
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    if (!categoryOpen || !activeGroup || hierarchyByGroup[activeGroup]) return

    setHierarchyLoading(true)
    hierarchyApi
      .getTree(activeGroup)
      .then(({ data }) => {
        setHierarchyByGroup((current) => ({ ...current, [activeGroup]: data.data || [] }))
      })
      .catch(() => {
        setHierarchyByGroup((current) => ({ ...current, [activeGroup]: [] }))
      })
      .finally(() => setHierarchyLoading(false))
  }, [activeGroup, categoryOpen, hierarchyByGroup])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) router.push(`/ilanlar?search=${encodeURIComponent(search)}`)
  }

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  const applyLocation = (city = locationCityDraft, district = locationDistrictDraft) => {
    setSelectedLocation(city, city ? district : '')
    setLocationOpen(false)
    router.push('/ilanlar')
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationOpen(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const city = findNearestCity(pos.coords.latitude, pos.coords.longitude)
        setLocationCityDraft(city)
        setLocationDistrictDraft('')
        setSelectedLocation(city)
        setLocationOpen(false)
        router.push('/ilanlar')
      },
      () => {
        setLocationOpen(false)
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      {menuOpen && <button aria-label="Menüyü kapat" className="fixed inset-0 bg-black/65 z-40 cursor-default" onClick={() => setMenuOpen(false)} />}
      {categoryOpen && <button aria-label="Kategorileri kapat" className="fixed inset-0 bg-black/25 z-40 cursor-default md:hidden" onClick={() => setCategoryOpen(false)} />}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-wrap items-center gap-2 py-2 md:h-14 md:flex-nowrap md:gap-3 md:py-0">
          <Link href="/" className="order-1 flex items-center gap-2 shrink-0 md:order-none" aria-label="SATGO Ana Sayfa">
            <img src="/satgo-logo.jpeg" alt="SATGO.TR" className="h-10 w-[132px] rounded-md object-cover object-center" />
          </Link>

          <form onSubmit={handleSearch} className="order-3 relative w-full flex-none md:order-none md:flex-1 md:max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="İlan, marka, kategori ara..."
              className="w-full h-11 pl-9 pr-4 bg-gray-50 border border-gray-200 rounded-full text-base focus:outline-none focus:border-brand transition-colors md:h-10 md:text-sm"
            />
          </form>

          <div className="relative hidden md:block">
            <button
              type="button"
              onClick={() => {
                setLocationCityDraft(selectedCity)
                setLocationDistrictDraft(selectedDistrict)
                setLocationOpen((open) => !open)
              }}
              className="flex items-center gap-1.5 text-sm text-gray-600 font-medium border border-gray-200 rounded-full px-3 h-10 hover:border-brand transition-colors max-w-[160px]"
            >
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">{locationLabel}</span>
              <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${locationOpen ? 'rotate-180' : ''}`} />
            </button>
            {locationOpen && (
              <div className="absolute right-0 top-12 w-72 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden z-50 p-3 space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setLocationCityDraft('')
                    setLocationDistrictDraft('')
                    applyLocation('', '')
                  }}
                  className={`w-full rounded-lg text-left px-3 py-2.5 text-sm font-bold hover:bg-gray-50 ${!selectedCity ? 'text-brand bg-brand-light' : 'text-gray-700'}`}
                >
                  Her Yer
                </button>
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-left text-sm font-bold text-gray-700 hover:border-brand hover:text-brand flex items-center gap-2"
                >
                  <LocateFixed className="w-4 h-4" />
                  Mevcut konumu kullan
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={locationCityDraft}
                    onChange={(e) => {
                      setLocationCityDraft(e.target.value)
                      setLocationDistrictDraft('')
                    }}
                    className="input"
                  >
                    <option value="">İl seç</option>
                    {LOCATIONS.map((location) => (
                      <option key={location.city} value={location.city}>{location.city}</option>
                    ))}
                  </select>
                  <select
                    value={locationDistrictDraft}
                    onChange={(e) => setLocationDistrictDraft(e.target.value)}
                    disabled={!locationCityDraft}
                    className="input"
                  >
                    <option value="">İlçe seç</option>
                    {getDistricts(locationCityDraft).map((district) => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={() => applyLocation()} className="btn-brand w-full py-2 text-sm">
                  Konumu Uygula
                </button>
              </div>
            )}
          </div>

          {user ? (
            <div className="relative z-50 order-2 ml-auto md:order-none md:ml-0">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 border border-gray-200 rounded-full px-2 h-10 hover:border-brand transition-colors bg-white"
              >
                <div className="w-7 h-7 rounded-full bg-brand-light text-brand font-bold text-xs flex items-center justify-center">
                  {initialFromName(user.name)}
                </div>
                <span className="hidden md:block text-sm font-semibold max-w-[100px] truncate">{user.name}</span>
                <ChevronDown className={`w-4 h-4 text-brand transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>
              {menuOpen && (
                <div className="fixed right-4 top-14 w-[min(92vw,330px)] max-h-[calc(100vh-72px)] overflow-y-auto rounded-b-2xl rounded-t-md bg-white shadow-2xl z-50">
                  <div className="flex items-center justify-between bg-yellow-300 px-4 py-2 text-sm font-black text-gray-900">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      Satıcı Doğrulama
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-xs">3</span>
                    </span>
                    <button type="button" onClick={() => setMenuOpen(false)} className="text-lg leading-none">×</button>
                  </div>

                  <div className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand-light text-brand font-black flex items-center justify-center">
                        {initialFromName(user.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-gray-900">{user.name}</p>
                        <p className="text-xs font-semibold text-gray-500">0 Takip · 1 Takipçi</p>
                      </div>
                      <Link href="/profil" onClick={() => setMenuOpen(false)} className="text-xs font-black text-brand">
                        Düzenle
                      </Link>
                    </div>
                  </div>

                  <div className="px-3 pb-3 space-y-1.5">
                    {USER_PANEL_LINKS.map((item) => (
                      <MenuLink
                        key={`${item.href}-${item.label}`}
                        href={item.href}
                        icon={item.icon}
                        label={item.label}
                        onClick={() => setMenuOpen(false)}
                      />
                    ))}
                  {user.role === 'admin' && (
                    <Link
                      href="/admin"
                      className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-purple-600 hover:bg-purple-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Sparkles className="w-4 h-4" /> Admin Panel
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                  >
                    <LogOut className="w-4 h-4" /> Çıkış
                  </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link href="/giris" className="hidden md:block btn-outline text-sm py-2 px-4">
              Giriş
            </Link>
          )}

          <Link href="/ilan-ver" className={`btn-brand order-2 text-sm flex items-center gap-1.5 shrink-0 md:order-none ${user ? '' : 'ml-auto md:ml-0'}`}>
            <Camera className="w-4 h-4" />
            <span>Sat</span>
          </Link>
        </div>

        {!!menuCategories.length && (
        <div className="relative">
          <nav className="flex gap-2 h-11 items-center overflow-x-auto scrollbar-hide md:hidden">
            <button
              type="button"
              onClick={() => setCategoryOpen((open) => !open)}
              className={`shrink-0 h-8 px-3 rounded-full text-sm font-black flex items-center gap-2 transition-colors ${
                categoryOpen ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-800 border border-gray-200'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
              Kategoriler
            </button>

            {menuCategories.slice(0, 6).map((category, index) => {
              return (
                <button
                  key={category.slug}
                  type="button"
                  className="shrink-0 h-8 rounded-full border border-gray-200 bg-white px-3 text-sm font-bold text-gray-800"
                  onClick={() => {
                    setActiveCategory(index)
                    setCategoryOpen(true)
                  }}
                >
                  {category.name}
                </button>
              )
            })}
          </nav>

          <nav className="hidden gap-5 h-11 items-center overflow-x-auto scrollbar-hide md:flex">
            <button
              type="button"
              onClick={() => setCategoryOpen((open) => !open)}
              className={`shrink-0 h-9 px-4 rounded-full text-sm font-semibold flex items-center gap-2 transition-colors ${
                categoryOpen ? 'bg-gray-100 text-gray-900' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
              Tüm Kategoriler
              <ChevronDown className={`w-4 h-4 transition-transform ${categoryOpen ? 'rotate-180' : ''}`} />
            </button>

            {menuCategories.map((category, index) => {
              return (
                <button
                  key={category.slug}
                  type="button"
                  className="shrink-0 text-sm font-medium text-gray-800 hover:text-brand whitespace-nowrap"
                  onClick={() => {
                    setActiveCategory(index)
                    setCategoryOpen(true)
                  }}
                  onMouseEnter={() => {
                    setActiveCategory(index)
                  }}
                >
                  {category.name}
                </button>
              )
            })}
          </nav>

          {categoryOpen && (
            <div className="fixed inset-x-3 top-[105px] z-50 max-h-[72vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl md:absolute md:inset-auto md:left-0 md:top-11 md:h-[520px] md:w-[min(96vw,1240px)] md:max-h-none md:overflow-hidden md:rounded-b-xl md:rounded-t-none md:grid md:grid-cols-[310px_1fr]">
              <div className="grid grid-cols-2 gap-2 p-3 md:hidden">
                {menuCategories.map((category, index) => {
                  const meta = CATEGORY_META[category.slug] || CATEGORY_META.diger
                  const Icon = meta.icon
                  return (
                    <Link
                      href={categoryHref(category)}
                      key={category.slug}
                      onClick={() => {
                        setActiveCategory(index)
                        setCategoryOpen(false)
                      }}
                      className="flex min-h-[68px] items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-black text-gray-900"
                    >
                      <span className={`w-9 h-9 rounded-full ${meta.color} text-white flex items-center justify-center shrink-0`}>
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="min-w-0 flex-1 leading-snug">{category.name}</span>
                    </Link>
                  )
                })}
              </div>

              <div className="hidden bg-gray-50 py-5 overflow-y-auto md:block">
                {menuCategories.map((category, index) => {
                  const meta = CATEGORY_META[category.slug] || CATEGORY_META.diger
                  const Icon = meta.icon
                  const active = index === activeCategory
                  return (
                    <Link
                      href={categoryHref(category)}
                      key={category.slug}
                      onMouseEnter={() => setActiveCategory(index)}
                      onClick={() => setCategoryOpen(false)}
                      className={`mx-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-black transition-colors ${
                        active ? 'bg-white text-black shadow-sm' : 'text-black hover:bg-white'
                      }`}
                    >
                      <span className={`w-9 h-9 rounded-full ${meta.color} text-white flex items-center justify-center shrink-0`}>
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="truncate">{category.name}</span>
                    </Link>
                  )
                })}
              </div>

              <div className="hidden p-8 overflow-y-auto md:block">
                <div className="mb-6 flex items-center gap-3">
                  <span className={`grid h-11 w-11 place-items-center rounded-full ${activeMeta.color} text-white`}>
                    <ActiveIcon className="h-6 w-6" />
                  </span>
                  <div>
                    <h3 className="text-lg font-black text-gray-950">{activeMenuCategory?.name}</h3>
                    <p className="text-xs font-semibold text-gray-500">
                      {hierarchyLoading ? 'Dinamik hiyerarşi yükleniyor...' : 'Bağımlı kategori seçenekleri'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-x-12 gap-y-7">
                  {activeColumns.map((column) => (
                    <div key={column.title} className="min-w-0">
                      <Link
                        href={column.href || categorySearchHref(activeMenuCategory, column.title)}
                        onClick={() => setCategoryOpen(false)}
                        className="inline-flex items-center gap-1 text-brand font-black hover:text-brand-dark"
                      >
                        {column.title}
                        {column.href && <ChevronRight className="w-4 h-4" />}
                      </Link>
                      {!!column.items?.length && (
                        <div className="mt-2 space-y-2">
                          {column.items.map((item) => (
                            <Link
                              key={item}
                              href={categorySearchHref(activeMenuCategory, item)}
                              onClick={() => setCategoryOpen(false)}
                              className="block text-sm font-medium text-gray-900 hover:text-brand truncate"
                            >
                              {item}
                            </Link>
                          ))}
                          <Link
                            href={column.href || categorySearchHref(activeMenuCategory, column.title)}
                            onClick={() => setCategoryOpen(false)}
                            className="inline-flex items-center gap-1 text-sm font-black text-black hover:text-brand pt-1"
                          >
                            Tümünü Gör
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                      )}
                    </div>
                  ))}
                  {!hierarchyLoading && !activeColumns.length && (
                    <div className="col-span-3 rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm font-semibold text-gray-500">
                      Bu kategori için hiyerarşi verisi admin panelinden eklenebilir.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </header>
  )
}

function MenuLink({
  href,
  icon: Icon,
  label,
  badge,
  onClick,
}: {
  href: string
  icon: any
  label: string
  badge?: string
  onClick: () => void
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:border-brand/50 hover:bg-brand-light"
      onClick={onClick}
    >
      <Icon className="w-4 h-4 text-gray-800" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-yellow-300 px-1 text-xs font-black text-gray-900">{badge}</span>}
    </Link>
  )
}

