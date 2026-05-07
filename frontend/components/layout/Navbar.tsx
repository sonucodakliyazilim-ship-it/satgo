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
  Gem,
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
  Sparkles,
  Trophy,
  Truck,
  User,
} from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { findNearestCity, getDistricts, LOCATIONS } from '@/lib/locations'

type CategoryColumn = {
  title: string
  items?: string[]
  href?: string
}

type MegaCategory = {
  label: string
  href: string
  icon: any
  color: string
  columns: CategoryColumn[]
}

const searchHref = (term: string) => `/ilanlar?search=${encodeURIComponent(term)}`

const MEGA_CATEGORIES: MegaCategory[] = [
  {
    label: 'Araba',
    href: '/ilanlar?kategori=arac',
    icon: Car,
    color: 'bg-blue-600',
    columns: [
      { title: 'Otomobil', items: ['BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Renault', 'Fiat', 'Toyota', 'Honda', 'Hyundai', 'Ford'] },
      { title: 'Arazi & SUV', items: ['SUV & 4x4', 'Pickup', 'Crossover', 'Jeep'] },
      { title: 'Ticari Araç', items: ['Panelvan', 'Kamyonet', 'Minibüs', 'Otobüs'] },
    ],
  },
  {
    label: 'Telefon',
    href: searchHref('telefon'),
    icon: Smartphone,
    color: 'bg-violet-500',
    columns: [
      { title: 'iPhone iOS Telefon', items: ['iPhone 17 Pro Max', 'iPhone 17 Pro', 'iPhone 11', 'iPhone 13', 'iPhone 16 Pro Max', 'iPhone 15 Pro Max', 'iPhone 14 Pro Max', 'iPhone 12', 'iPhone 16 Pro', 'iPhone 15 Pro', 'iPhone 15', 'iPhone 13 Pro Max', 'iPhone 16'] },
      { title: 'Android Telefon', items: ['Samsung', 'Xiaomi', 'Huawei', 'Oppo', 'Poco', 'Infinix', 'Tecno', 'Realme', 'Vivo'] },
      { title: 'Telefon Aksesuarları', items: ['Şarj Cihazı', 'Bluetooth Kulaklık', 'Kablolu Kulaklık', 'Telefon Kılıfı', 'Ekran Koruyucu', 'Selfie Çubuğu & Stand'] },
      { title: 'Telefon Yedek Parçaları', items: ['Batarya', 'Ekran', 'Anakart', 'Kasa & Kapak', 'Diğer'] },
      { title: 'Diğer Cep Telefonları', href: searchHref('cep telefonu') },
      { title: 'Telsiz & Masaüstü Telefon', href: searchHref('masaüstü telefon') },
    ],
  },
  {
    label: 'Elektronik',
    href: '/ilanlar?kategori=elektronik',
    icon: Home,
    color: 'bg-teal-400',
    columns: [
      { title: 'Bilgisayar', items: ['Laptop', 'Masaüstü', 'Monitör', 'Tablet', 'Yazıcı'] },
      { title: 'TV & Ses', items: ['Televizyon', 'Hoparlör', 'Kulaklık', 'Ev Sinema Sistemi'] },
      { title: 'Oyun & Konsol', items: ['PlayStation', 'Xbox', 'Nintendo', 'Oyun Aksesuarı'] },
    ],
  },
  {
    label: 'Ev & Yaşam',
    href: '/ilanlar?kategori=ev-esyasi',
    icon: Home,
    color: 'bg-yellow-400',
    columns: [
      { title: 'Mobilya', items: ['Koltuk', 'Masa', 'Sandalye', 'Dolap', 'Yatak'] },
      { title: 'Beyaz Eşya', items: ['Buzdolabı', 'Çamaşır Makinesi', 'Bulaşık Makinesi', 'Fırın'] },
      { title: 'Dekorasyon', items: ['Halı', 'Aydınlatma', 'Perde', 'Tablo'] },
    ],
  },
  {
    label: 'Motosiklet',
    href: '/ilanlar?kategori=motor',
    icon: Bike,
    color: 'bg-orange-500',
    columns: [
      { title: 'Motosiklet', items: ['Scooter', 'Naked', 'Touring', 'Enduro', 'Chopper'] },
      { title: 'Ekipman', items: ['Kask', 'Mont', 'Eldiven', 'Çanta'] },
      { title: 'Yedek Parça', items: ['Lastik', 'Akü', 'Egzoz', 'Ayna'] },
    ],
  },
  {
    label: 'Giyim & Aksesuar',
    href: '/ilanlar?kategori=giyim',
    icon: Shirt,
    color: 'bg-rose-400',
    columns: [
      { title: 'Kadın', items: ['Elbise', 'Ayakkabı', 'Çanta', 'Takı'] },
      { title: 'Erkek', items: ['Ceket', 'Pantolon', 'Ayakkabı', 'Saat'] },
      { title: 'Aksesuar', items: ['Gözlük', 'Kemer', 'Cüzdan', 'Şapka'] },
    ],
  },
  {
    label: 'Kişisel Bakım & Kozmetik',
    href: searchHref('kozmetik'),
    icon: Sparkles,
    color: 'bg-purple-500',
    columns: [
      { title: 'Kozmetik', items: ['Parfüm', 'Makyaj', 'Cilt Bakımı', 'Saç Bakımı'] },
      { title: 'Kişisel Bakım', items: ['Tıraş Makinesi', 'Saç Kurutma', 'Epilasyon'] },
    ],
  },
  {
    label: 'Anne & Bebek & Oyuncak',
    href: searchHref('bebek oyuncak'),
    icon: Baby,
    color: 'bg-sky-400',
    columns: [
      { title: 'Bebek', items: ['Bebek Arabası', 'Mama Sandalyesi', 'Beşik', 'Oto Koltuğu'] },
      { title: 'Oyuncak', items: ['Eğitici Oyuncak', 'Lego', 'Puzzle', 'Figür'] },
      { title: 'Çocuk Giyim', items: ['Ayakkabı', 'Mont', 'Takım', 'Çanta'] },
    ],
  },
  {
    label: 'Hobi & Kitap & Müzik',
    href: searchHref('hobi kitap müzik'),
    icon: BookOpen,
    color: 'bg-pink-400',
    columns: [
      { title: 'Kitap', items: ['Roman', 'Ders Kitabı', 'Çocuk Kitabı', 'Çizgi Roman'] },
      { title: 'Müzik', items: ['Gitar', 'Piyano', 'Plak', 'Ses Kartı'] },
      { title: 'Hobi', items: ['Koleksiyon', 'Model', 'El İşi'] },
    ],
  },
  {
    label: 'Ofis & Kırtasiye',
    href: searchHref('ofis kırtasiye'),
    icon: BriefcaseBusiness,
    color: 'bg-yellow-500',
    columns: [
      { title: 'Ofis', items: ['Ofis Masası', 'Ofis Koltuğu', 'Dosya Dolabı'] },
      { title: 'Kırtasiye', items: ['Kalem', 'Defter', 'Yazıcı Sarf', 'Çanta'] },
    ],
  },
  {
    label: 'Spor & Outdoor',
    href: searchHref('spor outdoor'),
    icon: Trophy,
    color: 'bg-lime-500',
    columns: [
      { title: 'Spor', items: ['Bisiklet', 'Fitness', 'Futbol', 'Basketbol'] },
      { title: 'Outdoor', items: ['Kamp', 'Çadır', 'Matara', 'Balıkçılık'] },
    ],
  },
  {
    label: 'Diğer Araçlar',
    href: '/ilanlar?search=araç',
    icon: Truck,
    color: 'bg-sky-600',
    columns: [
      { title: 'Araçlar', items: ['Karavan', 'Tekne', 'Tarım Aracı', 'Römork'] },
      { title: 'Parça', items: ['Lastik', 'Jant', 'Far', 'Akü'] },
    ],
  },
  {
    label: 'Antika',
    href: searchHref('antika'),
    icon: Gem,
    color: 'bg-amber-600',
    columns: [
      { title: 'Antika', items: ['Mobilya', 'Tablo', 'Saat', 'Para', 'Obje'] },
      { title: 'Koleksiyon', items: ['Pul', 'Plak', 'Kartpostal', 'Figür'] },
    ],
  },
  {
    label: 'Pet Shop',
    href: searchHref('pet shop'),
    icon: PawPrint,
    color: 'bg-emerald-500',
    columns: [
      { title: 'Ürünler', items: ['Mama', 'Taşıma Çantası', 'Tasma', 'Akvaryum'] },
      { title: 'Bakım', items: ['Kedi Ürünleri', 'Köpek Ürünleri', 'Kuş Ürünleri'] },
    ],
  },
]

const TOP_LINKS = ['Araba', 'Telefon', 'Elektronik', 'Ev & Yaşam', 'Motosiklet', 'Giyim & Aksesuar', 'Anne & Bebek & Oyuncak', 'Antika', 'Pet Shop']

const USER_PANEL_LINKS = [
  { href: '/profil', icon: ShoppingBag, label: 'Aldıklarım & Sattıklarım' },
  { href: '/mesajlar', icon: CircleDollarSign, label: 'Tekliflerim' },
  { href: '/profil', icon: Grid3X3, label: 'İlanlarım' },
  { href: '/mesajlar', icon: MessageCircle, label: 'Mesajlarım' },
  { href: '/favoriler', icon: Heart, label: 'Favorilerim' },
]

export default function Navbar() {
  const { user, logout, selectedCity, selectedDistrict, setSelectedLocation } = useAuthStore()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const [locationCityDraft, setLocationCityDraft] = useState(selectedCity)
  const [locationDistrictDraft, setLocationDistrictDraft] = useState(selectedDistrict)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState(1)

  const activeMega = MEGA_CATEGORIES[activeCategory] || MEGA_CATEGORIES[0]
  const locationLabel = selectedCity
    ? selectedDistrict
      ? `${selectedCity}, ${selectedDistrict}`
      : selectedCity
    : 'Her Yer'

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
                  {user.name[0].toUpperCase()}
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
                        {user.name[0].toUpperCase()}
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

            {TOP_LINKS.slice(0, 5).map((label) => {
              const index = MEGA_CATEGORIES.findIndex((category) => category.label === label)
              return (
                <button
                  key={label}
                  type="button"
                  className="shrink-0 h-8 rounded-full border border-gray-200 bg-white px-3 text-sm font-bold text-gray-800"
                  onClick={() => {
                    if (index >= 0) setActiveCategory(index)
                    setCategoryOpen(true)
                  }}
                >
                  {label}
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

            {TOP_LINKS.map((label) => {
              const index = MEGA_CATEGORIES.findIndex((category) => category.label === label)
              return (
                <button
                  key={label}
                  type="button"
                  className="shrink-0 text-sm font-medium text-gray-800 hover:text-brand whitespace-nowrap"
                  onClick={() => {
                    if (index >= 0) setActiveCategory(index)
                    setCategoryOpen(true)
                  }}
                  onMouseEnter={() => {
                    if (index >= 0) setActiveCategory(index)
                  }}
                >
                  {label}
                </button>
              )
            })}
          </nav>

          {categoryOpen && (
            <div className="fixed inset-x-3 top-[105px] z-50 max-h-[72vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl md:absolute md:inset-auto md:left-0 md:top-11 md:h-[520px] md:w-[min(96vw,1240px)] md:max-h-none md:overflow-hidden md:rounded-b-xl md:rounded-t-none md:grid md:grid-cols-[310px_1fr]">
              <div className="grid grid-cols-2 gap-2 p-3 md:hidden">
                {MEGA_CATEGORIES.map((category, index) => {
                  const Icon = category.icon
                  return (
                    <Link
                      href={category.href}
                      key={category.label}
                      onClick={() => {
                        setActiveCategory(index)
                        setCategoryOpen(false)
                      }}
                      className="flex min-h-[68px] items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-black text-gray-900"
                    >
                      <span className={`w-9 h-9 rounded-full ${category.color} text-white flex items-center justify-center shrink-0`}>
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="min-w-0 flex-1 leading-snug">{category.label}</span>
                    </Link>
                  )
                })}
              </div>

              <div className="hidden bg-gray-50 py-5 overflow-y-auto md:block">
                {MEGA_CATEGORIES.map((category, index) => {
                  const Icon = category.icon
                  const active = index === activeCategory
                  return (
                    <Link
                      href={category.href}
                      key={category.label}
                      onMouseEnter={() => setActiveCategory(index)}
                      onClick={() => setCategoryOpen(false)}
                      className={`mx-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-black transition-colors ${
                        active ? 'bg-white text-black shadow-sm' : 'text-black hover:bg-white'
                      }`}
                    >
                      <span className={`w-9 h-9 rounded-full ${category.color} text-white flex items-center justify-center shrink-0`}>
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="truncate">{category.label}</span>
                    </Link>
                  )
                })}
              </div>

              <div className="hidden p-8 overflow-y-auto md:block">
                <div className="grid grid-cols-3 gap-x-12 gap-y-7">
                  {activeMega.columns.map((column) => (
                    <div key={column.title} className="min-w-0">
                      <Link
                        href={column.href || searchHref(column.title)}
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
                              href={searchHref(item)}
                              onClick={() => setCategoryOpen(false)}
                              className="block text-sm font-medium text-gray-900 hover:text-brand truncate"
                            >
                              {item}
                            </Link>
                          ))}
                          <Link
                            href={column.href || searchHref(column.title)}
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
                </div>
              </div>
            </div>
          )}
        </div>
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

