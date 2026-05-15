'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronDown, Filter, LocateFixed, Search, SlidersHorizontal, X } from 'lucide-react'
import { categoriesApi, listingsApi } from '@/lib/api'
import ListingCard from '@/components/listings/ListingCard'
import { useAuthStore } from '@/lib/store'
import cities from '@/lib/cities.json'
import districts from '@/lib/districts.json'

type CityOption = {
  cityCode: string
  cityName: string
}

type DistrictOption = {
  cityCode: string
  districtCode: string
  districtName: string
}

type CategoryOption = {
  id: string | number
  slug: string
  name: string
  listing_count?: number
  sub_categories?: CategoryOption[]
}

const findCategoryBySlug = (categories: CategoryOption[], slug?: string): CategoryOption | null => {
  if (!slug) return null
  for (const category of categories) {
    if (category.slug === slug) return category
    const child = findCategoryBySlug(category.sub_categories || [], slug)
    if (child) return child
  }
  return null
}

const renderCategoryOptions = (categories: CategoryOption[], depth = 0): Array<{ category: CategoryOption; label: string }> =>
  categories.flatMap((category) => [
    { category, label: `${depth ? `${'- '.repeat(depth)}` : ''}${category.name}` },
    ...renderCategoryOptions(category.sub_categories || [], depth + 1),
  ])

const categoryContainsSlug = (category: CategoryOption, slug?: string): boolean =>
  !!slug && (category.slug === slug || (category.sub_categories || []).some((child) => categoryContainsSlug(child, slug)))

const SORTS = [
  { value: 'newest', label: 'Akıllı Sıralama' },
  { value: 'popular', label: 'En Popüler' },
  { value: 'cheapest', label: 'En Ucuz' },
  { value: 'priciest', label: 'En Pahalı' },
  { value: 'oldest', label: 'En Eski' },
]

const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  ADANA: { lat: 37.0, lon: 35.3213 },
  ADIYAMAN: { lat: 37.7648, lon: 38.2786 },
  AFYONKARAHISAR: { lat: 38.7569, lon: 30.5387 },
  AGRI: { lat: 39.7191, lon: 43.0503 },
  AMASYA: { lat: 40.6533, lon: 35.8331 },
  ANKARA: { lat: 39.9334, lon: 32.8597 },
  ANTALYA: { lat: 36.8969, lon: 30.7133 },
  ARTVIN: { lat: 41.1828, lon: 41.8183 },
  AYDIN: { lat: 37.845, lon: 27.8396 },
  BALIKESIR: { lat: 39.6484, lon: 27.8826 },
  BILECIK: { lat: 40.1506, lon: 29.9833 },
  BINGOL: { lat: 38.8847, lon: 40.4939 },
  BITLIS: { lat: 38.4011, lon: 42.1078 },
  BOLU: { lat: 40.735, lon: 31.6061 },
  BURDUR: { lat: 37.7203, lon: 30.2908 },
  BURSA: { lat: 40.1885, lon: 29.061 },
  CANAKKALE: { lat: 40.1553, lon: 26.4142 },
  CANKIRI: { lat: 40.6013, lon: 33.6134 },
  CORUM: { lat: 40.5506, lon: 34.9556 },
  DENIZLI: { lat: 37.7765, lon: 29.0864 },
  DIYARBAKIR: { lat: 37.9144, lon: 40.2306 },
  EDIRNE: { lat: 41.6771, lon: 26.5557 },
  ELAZIG: { lat: 38.6743, lon: 39.2232 },
  ERZINCAN: { lat: 39.7468, lon: 39.4911 },
  ERZURUM: { lat: 39.9043, lon: 41.2679 },
  ESKISEHIR: { lat: 39.7667, lon: 30.5256 },
  GAZIANTEP: { lat: 37.0662, lon: 37.3833 },
  GIRESUN: { lat: 40.9128, lon: 38.3895 },
  GUMUSHANE: { lat: 40.4386, lon: 39.5086 },
  HAKKARI: { lat: 37.5744, lon: 43.7408 },
  HATAY: { lat: 36.2023, lon: 36.1613 },
  ISPARTA: { lat: 37.7648, lon: 30.5566 },
  ISTANBUL: { lat: 41.0082, lon: 28.9784 },
  IZMIR: { lat: 38.4237, lon: 27.1428 },
  KAHRAMANMARAS: { lat: 37.5753, lon: 36.9228 },
  KARABUK: { lat: 41.2061, lon: 32.6204 },
  KARAMAN: { lat: 37.1811, lon: 33.215 },
  KARS: { lat: 40.6013, lon: 43.0975 },
  KASTAMONU: { lat: 41.3887, lon: 33.7827 },
  KAYSERI: { lat: 38.7205, lon: 35.4826 },
  KILIS: { lat: 36.7184, lon: 37.1212 },
  KIRIKKALE: { lat: 39.8468, lon: 33.5153 },
  KIRKLARELI: { lat: 41.7351, lon: 27.2252 },
  KIRSEHIR: { lat: 39.1425, lon: 34.1709 },
  KOCAELI: { lat: 40.8533, lon: 29.8815 },
  KONYA: { lat: 37.8746, lon: 32.4932 },
  KUTAHYA: { lat: 39.4192, lon: 29.9857 },
  MALATYA: { lat: 38.3552, lon: 38.3095 },
  MANISA: { lat: 38.6191, lon: 27.4289 },
  MARDIN: { lat: 37.3122, lon: 40.735 },
  MERSIN: { lat: 36.8121, lon: 34.6415 },
  MUGLA: { lat: 37.2153, lon: 28.3636 },
  MUS: { lat: 38.9462, lon: 41.7539 },
  NEVSEHIR: { lat: 38.6244, lon: 34.7239 },
  NIGDE: { lat: 37.9667, lon: 34.6833 },
  ORDU: { lat: 40.9862, lon: 37.8797 },
  OSMANIYE: { lat: 37.0742, lon: 36.2478 },
  RIZE: { lat: 41.0201, lon: 40.5234 },
  SAKARYA: { lat: 40.7569, lon: 30.3781 },
  SAMSUN: { lat: 41.2867, lon: 36.33 },
  SANLIURFA: { lat: 37.1674, lon: 38.7955 },
  SIIRT: { lat: 37.9333, lon: 41.95 },
  SINOP: { lat: 42.0264, lon: 35.1551 },
  SIRNAK: { lat: 37.4187, lon: 42.4918 },
  SIVAS: { lat: 39.7477, lon: 37.0179 },
  TEKIRDAG: { lat: 40.978, lon: 27.511 },
  TOKAT: { lat: 40.3167, lon: 36.55 },
  TRABZON: { lat: 41.0027, lon: 39.7168 },
  TUNCELI: { lat: 39.3074, lon: 39.4388 },
  USAK: { lat: 38.6823, lon: 29.4082 },
  VAN: { lat: 38.5012, lon: 43.372 },
  YALOVA: { lat: 40.655, lon: 29.2769 },
  YOZGAT: { lat: 39.8181, lon: 34.8147 },
  ZONGULDAK: { lat: 41.4564, lon: 31.7987 },
  AKSARAY: { lat: 38.3687, lon: 34.037 },
  BAYBURT: { lat: 40.2552, lon: 40.2249 },
  BATMAN: { lat: 37.8874, lon: 41.1322 },
  BARTIN: { lat: 41.6358, lon: 32.3375 },
  ARDAHAN: { lat: 41.1105, lon: 42.7022 },
  IGDIR: { lat: 39.9201, lon: 44.0436 },
  DUZCE: { lat: 40.8438, lon: 31.1565 },
}

const normalizeCityKey = (value: string) =>
  value
    .toLocaleUpperCase('tr-TR')
    .replaceAll('İ', 'I')
    .replaceAll('Ğ', 'G')
    .replaceAll('Ü', 'U')
    .replaceAll('Ş', 'S')
    .replaceAll('Ö', 'O')
    .replaceAll('Ç', 'C')

function ListingsContent() {
  const params = useSearchParams()
  const selectedCity = useAuthStore((s) => s.selectedCity)
  const selectedDistrict = useAuthStore((s) => s.selectedDistrict)
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [listings, setListings] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [locationStatus, setLocationStatus] = useState('')

  const [filters, setFilters] = useState({
    search: params.get('search') || '',
    kategori: params.get('kategori') || '',
    city: params.get('city') || '',
    district: params.get('district') || '',
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    sortBy: params.get('sortBy') || 'newest',
  })

  const cityOptions = useMemo(
    () =>
      [...(cities as CityOption[])].sort((a, b) =>
        a.cityName.localeCompare(b.cityName, 'tr-TR'),
      ),
    [],
  )

  const selectedCityRow = useMemo(
    () => cityOptions.find((city) => city.cityName === filters.city),
    [cityOptions, filters.city],
  )

  const sidebarDistricts = useMemo(
    () =>
      [...(districts as DistrictOption[])]
        .filter((district) => district.cityCode === selectedCityRow?.cityCode)
        .sort((a, b) => a.districtName.localeCompare(b.districtName, 'tr-TR')),
    [selectedCityRow?.cityCode],
  )

  useEffect(() => {
    categoriesApi.getAll().then(({ data }) => setCategories(data.data)).catch(() => setCategories([]))
  }, [])

  const activeCategory = useMemo(
    () => findCategoryBySlug(categories, filters.kategori),
    [categories, filters.kategori],
  )
  const categorySelectOptions = useMemo(() => renderCategoryOptions(categories), [categories])

  const fetchListings = useCallback(async () => {
    setLoading(true)
    try {
      const query: any = { page, sortBy: filters.sortBy }
      if (filters.search) query.search = filters.search
      if (filters.kategori) {
        const category = findCategoryBySlug(categories, filters.kategori)
        if (category) query.category = category.id
      }
      if (filters.city) query.city = filters.city
      if (filters.district) query.district = filters.district
      if (selectedCity && !filters.city) query.preferredCity = selectedCity
      if (selectedDistrict && !filters.district) query.preferredDistrict = selectedDistrict
      if (filters.minPrice) query.minPrice = filters.minPrice
      if (filters.maxPrice) query.maxPrice = filters.maxPrice

      const { data } = await listingsApi.getAll(query)
      const nextListings = data.data.listings
      setListings((current) => (page === 1 ? nextListings : [...current, ...nextListings]))
      setTotal(data.data.pagination.total)
    } catch {
      setListings([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [categories, filters, page, selectedCity, selectedDistrict])

  useEffect(() => {
    fetchListings()
  }, [fetchListings])

  const setFilter = (key: string, value: string) => {
    setPage(1)
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const setCityFilter = (city: string) => {
    setPage(1)
    setFilters((current) => ({ ...current, city, district: '' }))
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Tarayıcı konumu desteklemiyor.')
      return
    }

    setLocationStatus('Konum alınıyor...')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nearest = cityOptions.reduce<{ city: CityOption | null; score: number }>(
          (best, city) => {
            const coord = CITY_COORDS[normalizeCityKey(city.cityName)]
            if (!coord) return best
            const score = Math.pow(coord.lat - coords.latitude, 2) + Math.pow(coord.lon - coords.longitude, 2)
            return score < best.score ? { city, score } : best
          },
          { city: null, score: Number.POSITIVE_INFINITY },
        )

        if (nearest.city) {
          setCityFilter(nearest.city.cityName)
          setLocationStatus(`${nearest.city.cityName} filtrelendi.`)
        } else {
          setLocationStatus('Konum eşleştirilemedi, il seçebilirsiniz.')
        }
      },
      () => setLocationStatus('Konum izni alınamadı.'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    )
  }

  const resetFilters = () => {
    setPage(1)
    setFilters({
      search: '',
      kategori: '',
      city: '',
      district: '',
      minPrice: '',
      maxPrice: '',
      sortBy: 'newest',
    })
    setLocationStatus('')
  }

  const title = activeCategory
    ? `${activeCategory.name} İlanları`
    : filters.search
      ? `"${filters.search}" araması`
      : 'Tüm İlanlar'
  const preferredText = selectedCity
    ? selectedDistrict
      ? `${selectedCity}, ${selectedDistrict} öncelikli`
      : `${selectedCity} öncelikli`
    : ''

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <div className="flex items-start justify-between gap-3 mb-3 sm:mb-4">
        <div>
          <h1 className="text-lg sm:text-xl font-black">{title}</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            {total.toLocaleString('tr-TR')} ilan bulundu
            {preferredText ? ` · ${preferredText}` : ''}
          </p>
        </div>
        <div className="hidden lg:block">
          <select value={filters.sortBy} onChange={(e) => setFilter('sortBy', e.target.value)} className="input w-auto">
            {SORTS.map((sort) => (
              <option key={sort.value} value={sort.value}>{sort.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="lg:hidden sticky top-16 z-20 mb-3 rounded-xl border border-gray-100 bg-white/95 p-2 shadow-sm backdrop-blur">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select value={filters.sortBy} onChange={(e) => setFilter('sortBy', e.target.value)} className="input h-10 text-sm">
            {SORTS.map((sort) => (
              <option key={sort.value} value={sort.value}>{sort.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((current) => !current)}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border-2 border-gray-200 px-3 text-sm font-bold text-gray-700 transition-colors hover:border-brand hover:text-brand"
          >
            {mobileFiltersOpen ? <X className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
            Filtre
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-4 lg:gap-5 items-start">
        <aside className={`${mobileFiltersOpen ? 'block' : 'hidden'} lg:block space-y-2 lg:space-y-3 lg:sticky lg:top-32`}>
          <FilterBox title="Kategoriler">
            <select
              value={filters.kategori}
              onChange={(e) => setFilter('kategori', e.target.value)}
              className="input h-10 text-sm lg:hidden"
            >
              <option value="">Tüm Kategoriler</option>
              {categorySelectOptions.map(({ category, label }) => (
                <option key={category.id} value={category.slug}>{label}</option>
              ))}
            </select>

            <div className="hidden lg:block space-y-1">
              <button
                onClick={() => setFilter('kategori', '')}
                className={`w-full text-left rounded-lg px-2 py-1.5 text-sm font-semibold ${!filters.kategori ? 'bg-brand-light text-brand' : 'hover:bg-gray-50'}`}
              >
                Tüm Kategoriler
              </button>
              {categories.map((category) => (
                <div key={category.id}>
                  <button
                    onClick={() => setFilter('kategori', category.slug)}
                    className={`w-full text-left rounded-lg px-2 py-1.5 text-sm font-semibold ${filters.kategori === category.slug ? 'bg-brand-light text-brand' : 'hover:bg-gray-50'}`}
                  >
                    {category.name} <span className="text-xs text-gray-400">({category.listing_count})</span>
                  </button>
                  {!!category.sub_categories?.length && categoryContainsSlug(category, filters.kategori) && (
                    <div className="pl-3 mt-1 space-y-1">
                      {renderCategoryOptions(category.sub_categories).map(({ category: sub, label }) => (
                        <button
                          key={sub.id}
                          onClick={() => setFilter('kategori', sub.slug)}
                          className={`block w-full text-left rounded-lg px-2 py-1 text-xs ${filters.kategori === sub.slug ? 'bg-brand-light font-black text-brand' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                          {label} ({sub.listing_count || 0})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </FilterBox>

          <FilterBox title="Konum">
            <div className="grid grid-cols-2 gap-2 lg:block lg:space-y-2">
              <button
                type="button"
                onClick={useCurrentLocation}
                className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-full border-2 border-gray-200 px-3 text-xs font-bold text-gray-700 transition-colors hover:border-brand hover:text-brand"
              >
                <LocateFixed className="w-4 h-4" />
                Mevcut konumu kullan
              </button>
              <select
                value={filters.city}
                onChange={(e) => setCityFilter(e.target.value)}
                className="input h-10 text-sm"
              >
                <option value="">İl seçin</option>
                {cityOptions.map((city) => (
                  <option key={city.cityCode} value={city.cityName}>{city.cityName}</option>
                ))}
              </select>
              <select
                value={filters.district}
                onChange={(e) => setFilter('district', e.target.value)}
                disabled={!filters.city}
                className="input h-10 text-sm"
              >
                <option value="">İlçe seçin</option>
                {sidebarDistricts.map((district) => (
                  <option key={district.districtCode} value={district.districtName}>{district.districtName}</option>
                ))}
              </select>
            </div>
            {locationStatus && <p className="mt-2 text-xs text-gray-500">{locationStatus}</p>}
          </FilterBox>

          <FilterBox title="Fiyat">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Min"
                value={filters.minPrice}
                onChange={(e) => setFilter('minPrice', e.target.value)}
                className="input h-10 text-sm"
              />
              <input
                type="number"
                placeholder="Maks"
                value={filters.maxPrice}
                onChange={(e) => setFilter('maxPrice', e.target.value)}
                className="input h-10 text-sm"
              />
            </div>
          </FilterBox>

          <FilterBox title="Kelime">
            <div className="relative">
              <input
                value={filters.search}
                onChange={(e) => setFilter('search', e.target.value)}
                placeholder="Kelime ile filtrele"
                className="input h-10 pr-9 text-sm"
              />
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </FilterBox>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={resetFilters} className="btn-outline text-xs py-2 px-3 text-red-500">
              Temizle
            </button>
            <button onClick={() => setMobileFiltersOpen(false)} className="btn-brand text-xs py-2 px-3">
              Göster
            </button>
          </div>
        </aside>

        <main>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="card animate-pulse">
                  <div className="aspect-[4/3] bg-gray-200 rounded-t-xl" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 rounded" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : listings.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
              {total > listings.length && (
                <div className="mt-6 text-center">
                  <button onClick={() => setPage((current) => current + 1)} className="btn-outline">
                    Daha Fazla Yükle
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="card p-10 sm:p-16 text-center text-gray-400">
              <SlidersHorizontal className="w-10 h-10 mx-auto mb-3" />
              <p className="font-semibold text-gray-600">İlan bulunamadı</p>
              <p className="text-sm mt-1">Farklı filtreler deneyin</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function FilterBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-2.5 lg:p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-black">{title}</h2>
        <ChevronDown className="w-4 h-4 text-gray-400 lg:hidden" />
      </div>
      {children}
    </section>
  )
}

export default function ListingsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid lg:grid-cols-[260px_1fr] gap-5">
            <div className="hidden lg:block h-96 bg-gray-100 rounded-xl animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="card animate-pulse">
                  <div className="aspect-[4/3] bg-gray-200 rounded-t-xl" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      }
    >
      <ListingsContent />
    </Suspense>
  )
}
