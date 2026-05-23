'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, CreditCard, Database, FileUp, ImagePlus, Images, Landmark, ListChecks, Pencil, RefreshCw, Save, Tags, Trash2, UploadCloud, Users, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { adminApi, categoriesApi } from '@/lib/api'
import { mediaUrl } from '@/lib/media'
import { useAuthStore } from '@/lib/store'
import HierarchyManager from '@/components/admin/HierarchyManager'
import CustomFieldsManager from '@/components/admin/CustomFieldsManager'

const LISTING_STATUSES = [
  ['pending', 'Beklemede'],
  ['active', 'Aktif'],
  ['passive', 'Pasif'],
  ['sold', 'Satıldı'],
  ['rejected', 'Reddedildi'],
]

const ORDER_STATUSES = [
  ['', 'Tüm talepler'],
  ['pending', 'Bekleyen talepler'],
  ['approved', 'Onaylananlar'],
  ['rejected', 'Reddedilenler'],
]

const ADMIN_TABS = [
  { key: 'listings', label: 'İlanlar', icon: ListChecks },
  { key: 'users', label: 'Kullanıcılar', icon: Users },
  { key: 'categories', label: 'Kategoriler', icon: Tags },
  { key: 'hierarchy', label: 'Hiyerarşi', icon: Database },
  { key: 'fields', label: 'Alanlar', icon: ListChecks },
  { key: 'banners', label: 'Bannerlar', icon: Images },
  { key: 'payments', label: 'Ödeme', icon: CreditCard },
]

const money = (value: number | string) =>
  Number(value || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })

const emptyBannerForm = {
  title: '',
  subtitle: '',
  href: '/ilanlar',
  placement: 'home_hero',
  sort_order: '0',
  is_active: 'true',
}

const emptyPaymentForm = {
  bank_name: '',
  iban: '',
  iban_owner: '',
}

const emptyCategoryForm = {
  parent_id: '',
  name: '',
  slug: '',
  icon: '',
  sort_order: '0',
  is_active: 'true',
}

const slugify = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const flattenCategories = (items: any[] = [], depth = 0, parentName = ''): any[] =>
  items.flatMap((category) => [
    { ...category, parent_name: parentName, depth },
    ...flattenCategories(category.sub_categories || [], depth + 1, category.name),
  ])

const removeCategoriesFromTree = (items: any[] = [], ids: Set<string>): any[] =>
  items
    .filter((category) => !ids.has(String(category.id)))
    .map((category) => ({
      ...category,
      sub_categories: removeCategoriesFromTree(category.sub_categories || [], ids),
    }))

export default function AdminPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [dashboard, setDashboard] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [listings, setListings] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [banners, setBanners] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [paymentSettings, setPaymentSettings] = useState<any>(null)
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm)
  const [status, setStatus] = useState('')
  const [orderStatus, setOrderStatus] = useState('')
  const [activeTab, setActiveTab] = useState('listings')
  const [loading, setLoading] = useState(true)
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null)
  const [processingListingId, setProcessingListingId] = useState<string | null>(null)
  const [bannerForm, setBannerForm] = useState(emptyBannerForm)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null)
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [categoryCsv, setCategoryCsv] = useState('Araç>Otomobil\nAraç>SUV & 4x4\nElektronik>Telefon\nEv Eşyası>Beyaz Eşya')
  const [categoryCsvFile, setCategoryCsvFile] = useState<File | null>(null)
  const [savingBanner, setSavingBanner] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [savingCategory, setSavingCategory] = useState(false)
  const [importingCategory, setImportingCategory] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [d, u, l, o, b, p, c] = await Promise.all([
        adminApi.dashboard(),
        adminApi.users(),
        adminApi.listings(status ? { status } : undefined),
        adminApi.promotionOrders(orderStatus ? { status: orderStatus } : undefined),
        adminApi.banners(),
        adminApi.paymentSettings(),
        categoriesApi.getAll({ include_inactive: true }),
      ])
      setDashboard(d.data.data)
      setUsers(u.data.data)
      setListings(l.data.data)
      setOrders(o.data.data)
      setBanners(b.data.data)
      setCategories(c.data.data || [])
      setPaymentSettings(p.data.data)
      setPaymentForm({
        bank_name: p.data.data?.bank_name || '',
        iban: p.data.data?.iban || '',
        iban_owner: p.data.data?.iban_owner || '',
      })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Admin verileri alınamadı')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    if (user.role !== 'admin') {
      router.push('/')
      return
    }
    load()
  }, [user?.id, user?.role, status, orderStatus])

  const approveOrder = async (id: string) => {
    setProcessingOrderId(id)
    try {
      const adminNote = window.prompt('Admin notu', '') || undefined
      await adminApi.approvePromotionOrder(id, adminNote)
      toast.success('Ödeme onaylandı, paket aktif edildi')
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ödeme onaylanamadı')
    } finally {
      setProcessingOrderId(null)
    }
  }

  const rejectOrder = async (id: string) => {
    setProcessingOrderId(id)
    try {
      const adminNote = window.prompt('Red notu', '') || undefined
      await adminApi.rejectPromotionOrder(id, adminNote)
      toast.success('Ödeme reddedildi')
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ödeme reddedilemedi')
    } finally {
      setProcessingOrderId(null)
    }
  }

  const changeListingStatus = async (id: string, nextStatus: string) => {
    setProcessingListingId(id)
    try {
      const res = await adminApi.setListingStatus(id, nextStatus)
      const updated = res.data.data
      setListings((current) =>
        status === 'pending'
          ? current.filter((listing) => listing.id !== id)
          : current.map((listing) => (listing.id === id ? { ...listing, ...updated } : listing)),
      )
      toast.success('İlan durumu güncellendi')
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Durum güncellenemedi')
    } finally {
      setProcessingListingId(null)
    }
  }

  const deleteListing = async (id: string) => {
    if (!window.confirm('Bu ilan kalici olarak silinsin mi?')) return
    setProcessingListingId(id)
    try {
      await adminApi.deleteListing(id)
      toast.success('Ilan silindi')
      setListings((current) => current.filter((listing) => listing.id !== id))
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ilan silinemedi')
    } finally {
      setProcessingListingId(null)
    }
  }

  const changeUserStatus = async (id: string, nextStatus: string) => {
    try {
      await adminApi.setUserStatus(id, nextStatus)
      toast.success('Kullanıcı durumu güncellendi')
      load()
    } catch {
      toast.error('Kullanıcı güncellenemedi')
    }
  }

  const setPayment = (key: keyof typeof emptyPaymentForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setPaymentForm((current) => ({ ...current, [key]: e.target.value }))

  const savePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPayment(true)
    try {
      const res = await adminApi.updatePaymentSettings(paymentForm)
      const next = res.data.data
      setPaymentSettings(next)
      setPaymentForm({
        bank_name: next.bank_name || '',
        iban: next.iban || '',
        iban_owner: next.iban_owner || '',
      })
      toast.success('Ödeme bilgileri güncellendi')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ödeme bilgileri kaydedilemedi')
    } finally {
      setSavingPayment(false)
    }
  }

  const setBanner = (key: keyof typeof emptyBannerForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setBannerForm((current) => ({ ...current, [key]: e.target.value }))

  const resetBannerForm = () => {
    setBannerForm(emptyBannerForm)
    setBannerFile(null)
    setEditingBannerId(null)
  }

  const editBanner = (banner: any) => {
    setEditingBannerId(banner.id)
    setBannerFile(null)
    setBannerForm({
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      href: banner.href || '/ilanlar',
      placement: banner.placement || 'home_hero',
      sort_order: String(banner.sort_order ?? 0),
      is_active: banner.is_active ? 'true' : 'false',
    })
  }

  const saveBanner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingBannerId && !bannerFile) {
      toast.error('Banner için görsel seç')
      return
    }
    setSavingBanner(true)
    try {
      const fd = new FormData()
      Object.entries(bannerForm).forEach(([key, value]) => fd.append(key, value))
      if (bannerFile) fd.append('image', bannerFile)
      if (editingBannerId) await adminApi.updateBanner(editingBannerId, fd)
      else await adminApi.createBanner(fd)
      toast.success(editingBannerId ? 'Banner güncellendi' : 'Banner eklendi')
      resetBannerForm()
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Banner kaydedilemedi')
    } finally {
      setSavingBanner(false)
    }
  }

  const deleteBanner = async (id: string) => {
    if (!window.confirm('Bu banner silinsin mi?')) return
    try {
      await adminApi.deleteBanner(id)
      toast.success('Banner silindi')
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Banner silinemedi')
    }
  }

  const setCategory = (key: keyof typeof emptyCategoryForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value
    setCategoryForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'name' && !editingCategoryId ? { slug: slugify(value) } : {}),
    }))
  }

  const resetCategoryForm = () => {
    setCategoryForm(emptyCategoryForm)
    setEditingCategoryId(null)
  }

  const editCategory = (category: any) => {
    setEditingCategoryId(category.id)
    setCategoryForm({
      parent_id: category.parent_id ? String(category.parent_id) : '',
      name: category.name || '',
      slug: category.slug || '',
      icon: category.icon || '',
      sort_order: String(category.sort_order ?? 0),
      is_active: category.is_active === false ? 'false' : 'true',
    })
  }

  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingCategory(true)
    try {
      const payload = {
        parent_id: categoryForm.parent_id || null,
        name: categoryForm.name,
        slug: slugify(categoryForm.slug || categoryForm.name),
        icon: categoryForm.icon || null,
        sort_order: Number(categoryForm.sort_order || 0),
        is_active: categoryForm.is_active === 'true',
      }

      if (editingCategoryId) await categoriesApi.update(editingCategoryId, payload)
      else await categoriesApi.create(payload)

      toast.success(editingCategoryId ? 'Kategori güncellendi' : 'Kategori eklendi')
      resetCategoryForm()
      window.dispatchEvent(new Event('satgo:categories-updated'))
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Kategori kaydedilemedi')
    } finally {
      setSavingCategory(false)
    }
  }

  const deleteCategory = async (id: string | number) => {
    if (!window.confirm('Bu kategori silinsin mi? Alt kategoriler de silinir.')) return
    try {
      const res = await categoriesApi.delete(id)
      const deletedIds = new Set<string>((res.data?.data?.deleted_ids || [id]).map((item: any) => String(item)))
      setCategories((current) => removeCategoriesFromTree(current, deletedIds))
      toast.success('Kategori silindi')
      if (editingCategoryId === String(id)) resetCategoryForm()
      window.dispatchEvent(new Event('satgo:categories-updated'))
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Kategori silinemedi')
    }
  }

  const toggleCategoryActive = async (category: any) => {
    try {
      await categoriesApi.update(category.id, { is_active: category.is_active === false })
      toast.success(category.is_active === false ? 'Kategori aktif edildi' : 'Kategori pasife alındı')
      window.dispatchEvent(new Event('satgo:categories-updated'))
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Kategori durumu değiştirilemedi')
    }
  }

  const readCategoryCsvFile = async (file?: File | null) => {
    if (!file) return
    setCategoryCsvFile(file)
    setCategoryCsv(await file.text())
  }

  const importCategoryCsv = async (e: React.FormEvent) => {
    e.preventDefault()
    setImportingCategory(true)
    try {
      if (categoryCsvFile) {
        const fd = new FormData()
        fd.append('file', categoryCsvFile)
        await categoriesApi.importCsv(fd)
      } else {
        await categoriesApi.importCsv({ csv: categoryCsv })
      }
      toast.success('Kategori CSV aktarıldı')
      setCategoryCsvFile(null)
      window.dispatchEvent(new Event('satgo:categories-updated'))
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Kategori CSV aktarılamadı')
    } finally {
      setImportingCategory(false)
    }
  }

  const categoryRows = flattenCategories(categories)

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="card p-8 text-center">
          <h1 className="text-xl font-black">Admin panel için giriş yap</h1>
          <button onClick={() => router.push('/giris')} className="btn-brand mt-5">
            Giriş Yap
          </button>
        </div>
      </div>
    )
  }

  if (user.role !== 'admin') return null

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Admin Panel</h1>
          <p className="text-sm text-gray-500 mt-1">İlan, kullanıcı ve öne çıkarma taleplerini buradan yönet.</p>
        </div>
        <button onClick={load} className="btn-outline text-sm py-2 px-4 flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Yenile
        </button>
      </div>

      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Kullanıcı" value={dashboard.total_users} />
          <Stat label="Aktif İlan" value={dashboard.active_listings} />
          <Stat label="Bugün İlan" value={dashboard.today_new_listings} />
          <Stat label="Bekleyen Rapor" value={dashboard.pending_reports} />
          <Stat label="Aktif Paket" value={dashboard.active_promotions} />
        </div>
      )}

      <nav className="flex gap-2 overflow-x-auto rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
        {ADMIN_TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-black transition-colors ${
                active ? 'bg-gray-950 text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-950'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </nav>

      {activeTab === 'payments' && (
      <section className="card overflow-hidden border-2 border-brand/20">
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-black flex items-center gap-2">
              <Landmark className="h-5 w-5 text-brand" />
              Ödeme Bilgileri
            </h2>
            <p className="text-sm text-gray-500 mt-1">Yeni havale/EFT talimatlarında görünecek banka, alıcı ve IBAN bilgisini yönet.</p>
          </div>
          {paymentSettings?.updated_at && (
            <p className="text-xs font-semibold text-gray-400">
              Son güncelleme: {new Date(paymentSettings.updated_at).toLocaleString('tr-TR')}
            </p>
          )}
        </div>

        <form onSubmit={savePayment} className="p-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
          <div>
            <label className="label">Banka</label>
            <input
              value={paymentForm.bank_name}
              onChange={setPayment('bank_name')}
              required
              className="input"
              placeholder="Banka adı"
            />
          </div>
          <div>
            <label className="label">Alıcı Ad Soyad</label>
            <input
              value={paymentForm.iban_owner}
              onChange={setPayment('iban_owner')}
              required
              className="input"
              placeholder="Ad Soyad"
            />
          </div>
          <div>
            <label className="label">IBAN</label>
            <input
              value={paymentForm.iban}
              onChange={setPayment('iban')}
              required
              className="input font-mono"
              placeholder="TR00 0000 0000 0000 0000 0000 00"
            />
          </div>
          <button disabled={savingPayment} className="btn-brand flex items-center justify-center gap-2 whitespace-nowrap">
            <Save className="h-4 w-4" />
            {savingPayment ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </form>

        <div className="border-t border-gray-100 px-4 py-3 text-xs font-semibold text-gray-500">
          Güncelleme sonrası oluşturulan yeni ödeme talimatları bu bilgileri kullanır; mevcut talimatların kayıtlı bilgisi değişmez.
        </div>
      </section>
      )}

      {activeTab === 'banners' && (
      <section className="card overflow-hidden border-2 border-brand/20">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-black">Banner ve Slider Görselleri</h2>
          <p className="text-sm text-gray-500 mt-1">Ana sayfa slider görsellerini ekle, düzenle, pasifleştir veya sil.</p>
        </div>

        <form onSubmit={saveBanner} className="p-4 grid lg:grid-cols-[1fr_220px] gap-4 border-b border-gray-100">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">Başlık</label>
              <input value={bannerForm.title} onChange={setBanner('title')} required className="input" placeholder="Kampanya başlığı" />
            </div>
            <div>
              <label className="label">Link</label>
              <input value={bannerForm.href} onChange={setBanner('href')} className="input" placeholder="/ilanlar?kategori=arac" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Açıklama</label>
              <textarea value={bannerForm.subtitle} onChange={setBanner('subtitle')} rows={2} className="input resize-none" />
            </div>
            <div>
              <label className="label">Sıra</label>
              <input type="number" value={bannerForm.sort_order} onChange={setBanner('sort_order')} className="input" />
            </div>
            <div>
              <label className="label">Durum</label>
              <select value={bannerForm.is_active} onChange={setBanner('is_active')} className="input">
                <option value="true">Aktif</option>
                <option value="false">Pasif</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 text-center hover:border-brand">
              <ImagePlus className="h-6 w-6 text-brand" />
              <span className="px-3 text-xs font-bold text-gray-600">{bannerFile ? bannerFile.name : editingBannerId ? 'Yeni görsel seç' : 'Görsel seç'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setBannerFile(e.target.files?.[0] || null)} />
            </label>
            <div className="flex gap-2">
              <button disabled={savingBanner} className="btn-brand flex-1 text-sm">
                {savingBanner ? 'Kaydediliyor...' : editingBannerId ? 'Güncelle' : 'Ekle'}
              </button>
              {editingBannerId && (
                <button type="button" onClick={resetBannerForm} className="btn-outline px-3 text-sm">
                  Vazgeç
                </button>
              )}
            </div>
          </div>
        </form>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {banners.map((banner) => {
            const imageUrl = mediaUrl(banner.image_url) || '/satgo-logo.jpeg'
            return (
              <div key={banner.id} className="overflow-hidden rounded-lg border border-gray-100 bg-white">
                <div className="aspect-[16/7] bg-gray-100">
                  <img src={imageUrl} alt={banner.title} className="h-full w-full object-cover" />
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-black">{banner.title}</p>
                      <p className="truncate text-xs text-gray-500">{banner.href}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-black ${banner.is_active ? 'bg-brand-light text-brand' : 'bg-gray-100 text-gray-500'}`}>
                      {banner.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => editBanner(banner)} className="btn-outline flex items-center gap-1 px-3 py-1.5 text-xs">
                      <Pencil className="h-3.5 w-3.5" />
                      Düzenle
                    </button>
                    <button onClick={() => deleteBanner(banner.id)} className="btn-outline flex items-center gap-1 px-3 py-1.5 text-xs text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                      Sil
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          {!loading && !banners.length && (
            <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center text-sm font-semibold text-gray-400 md:col-span-2 xl:col-span-3">
              Henüz banner yok. İlk slider görselini ekle.
            </div>
          )}
        </div>
      </section>
      )}

      {activeTab === 'categories' && (
      <section className="card overflow-hidden border-2 border-brand/20">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-black">Kategori Yönetimi</h2>
          <p className="text-sm text-gray-500 mt-1">Ana kategori veya alt kategori ekle, düzenle ve pasife al.</p>
        </div>

        <form onSubmit={importCategoryCsv} className="grid gap-3 border-b border-gray-100 bg-gray-50 p-4 lg:grid-cols-[1fr_240px]">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="label mb-0">CSV ile kategori yükle</label>
              {categoryCsvFile && <span className="max-w-[220px] truncate text-xs font-black text-brand">{categoryCsvFile.name}</span>}
            </div>
            <textarea
              value={categoryCsv}
              onChange={(e) => {
                setCategoryCsv(e.target.value)
                setCategoryCsvFile(null)
              }}
              rows={4}
              className="input resize-none bg-white font-mono text-xs"
              placeholder="Ana Kategori>Alt Kategori"
            />
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="btn-outline flex cursor-pointer items-center justify-center gap-2 px-3 py-2 text-sm">
              <UploadCloud className="h-4 w-4" />
              CSV Dosyası Seç
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => readCategoryCsvFile(e.target.files?.[0])} />
            </label>
            <button disabled={importingCategory} className="btn-brand flex items-center justify-center gap-2">
              <FileUp className="h-4 w-4" />
              {importingCategory ? 'Aktarılıyor...' : 'Kategorileri Aktar'}
            </button>
          </div>
        </form>

        <form onSubmit={saveCategory} className="p-4 grid gap-3 lg:grid-cols-[1fr_1fr_140px_120px_120px_auto] lg:items-end border-b border-gray-100">
          <div>
            <label className="label">Üst kategori</label>
            <select value={categoryForm.parent_id} onChange={setCategory('parent_id')} className="input">
              <option value="">Ana kategori</option>
              {categoryRows
                .filter((category) => String(category.id) !== editingCategoryId)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {'- '.repeat(category.depth)}{category.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="label">Kategori adı</label>
            <input value={categoryForm.name} onChange={setCategory('name')} required className="input" placeholder="Örn: Evcil Hayvan" />
          </div>
          <div>
            <label className="label">Slug</label>
            <input value={categoryForm.slug} onChange={setCategory('slug')} required className="input" placeholder="evcil-hayvan" />
          </div>
          <div>
            <label className="label">Sıra</label>
            <input type="number" value={categoryForm.sort_order} onChange={setCategory('sort_order')} className="input" />
          </div>
          <div>
            <label className="label">Durum</label>
            <select value={categoryForm.is_active} onChange={setCategory('is_active')} className="input">
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button disabled={savingCategory} className="btn-brand flex min-w-[120px] items-center justify-center gap-2 whitespace-nowrap">
              <Save className="h-4 w-4" />
              {savingCategory ? 'Kaydediliyor...' : editingCategoryId ? 'Güncelle' : 'Ekle'}
            </button>
            {editingCategoryId && (
              <button type="button" onClick={resetCategoryForm} className="btn-outline px-3 text-sm">
                Vazgeç
              </button>
            )}
          </div>
          <div className="lg:col-span-6">
            <label className="label">İkon</label>
            <input value={categoryForm.icon} onChange={setCategory('icon')} className="input max-w-xs" placeholder="Emoji veya kısa ikon" />
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left p-3">Kategori</th>
                <th className="text-left p-3">Üst kategori</th>
                <th className="text-left p-3">Slug</th>
                <th className="text-left p-3">Sıra</th>
                <th className="text-left p-3">Durum</th>
                <th className="text-right p-3">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {categoryRows.map((category) => (
                <tr key={category.id} className="border-t border-gray-50">
                  <td className="p-3">
                    <span className="font-bold">{category.depth ? `- ${category.name}` : category.name}</span>
                  </td>
                  <td className="p-3 text-gray-500">{category.parent_name || 'Ana kategori'}</td>
                  <td className="p-3 font-mono text-xs">{category.slug}</td>
                  <td className="p-3">{category.sort_order ?? 0}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-black ${category.is_active === false ? 'bg-gray-100 text-gray-500' : 'bg-emerald-100 text-emerald-700'}`}>
                      {category.is_active === false ? 'Pasif' : 'Aktif'}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                    <button onClick={() => editCategory(category)} type="button" className="btn-outline flex items-center gap-1 px-3 py-1.5 text-xs">
                      <Pencil className="h-3.5 w-3.5" />
                      Düzenle
                    </button>
                    <button onClick={() => toggleCategoryActive(category)} type="button" className="btn-outline px-3 py-1.5 text-xs">
                      {category.is_active === false ? 'Aktifleştir' : 'Pasifleştir'}
                    </button>
                    <button onClick={() => deleteCategory(category.id)} type="button" className="btn-outline flex items-center gap-1 px-3 py-1.5 text-xs text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !categoryRows.length && (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Kategori yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {activeTab === 'hierarchy' && <HierarchyManager />}
      {activeTab === 'fields' && <CustomFieldsManager />}

      {activeTab === 'payments' && (
      <section className="card overflow-hidden border-2 border-brand/20">
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-black">Öne Çıkarma Talepleri</h2>
            <p className="text-sm text-gray-500 mt-1">Kullanıcı havale/EFT talebi oluşturunca burada bekleyen ödeme olarak görünür.</p>
          </div>
          <select value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)} className="input w-auto">
            {ORDER_STATUSES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left p-3">Paket</th>
                <th className="text-left p-3">Kullanıcı</th>
                <th className="text-left p-3">İlan</th>
                <th className="text-left p-3">Ödeme Kodu</th>
                <th className="text-left p-3">Durum</th>
                <th className="text-right p-3">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-gray-50">
                  <td className="p-3">
                    <p className="font-bold">{order.package_label || order.package_name}</p>
                    <p className="text-xs text-gray-500">
                      {money(order.amount)} · {order.duration_days} gün
                    </p>
                  </td>
                  <td className="p-3">
                    <p className="font-semibold">{order.user_name}</p>
                    <p className="text-xs text-gray-500">{order.user_email}</p>
                  </td>
                  <td className="p-3 max-w-[260px] truncate">{order.listing_title}</td>
                  <td className="p-3 font-mono text-xs">{order.payment_code}</td>
                  <td className="p-3"><StatusBadge status={order.status} order /></td>
                  <td className="p-3">
                    {order.status === 'pending' ? (
                      <div className="flex items-center justify-end gap-2 text-xs font-semibold text-gray-400">
                        <button
                          onClick={() => approveOrder(order.id)}
                          disabled={processingOrderId === order.id}
                          className="btn-outline text-xs py-1.5 px-3 text-emerald-600 flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Onayla
                        </button>
                        <button
                          onClick={() => rejectOrder(order.id)}
                          disabled={processingOrderId === order.id}
                          className="btn-outline text-xs py-1.5 px-3 text-red-500 flex items-center gap-1"
                        >
                          <XCircle className="w-4 h-4" />
                          Reddet
                        </button>
                      </div>
                    ) : (
                      <p className="text-right text-xs text-gray-400">Sonuçlandı</p>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && !orders.length && (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Öne çıkarma talebi yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {activeTab === 'listings' && (
      <section className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-black">İlan Yönetimi</h2>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-auto">
            <option value="">Tüm ilanlar</option>
            {LISTING_STATUSES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left p-3">İlan</th>
                <th className="text-left p-3">Satıcı</th>
                <th className="text-left p-3">Kategori</th>
                <th className="text-left p-3">Durum</th>
                <th className="text-right p-3">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => (
                <tr key={listing.id} className="border-t border-gray-50">
                  <td className="p-3">
                    <p className="font-bold">{listing.title}</p>
                    <p className="text-xs text-gray-500">{Number(listing.price || 0).toLocaleString('tr-TR')} TL · {listing.city}</p>
                  </td>
                  <td className="p-3">{listing.seller_name}</td>
                  <td className="p-3">{listing.category_name}</td>
                  <td className="p-3"><StatusBadge status={listing.status} /></td>
                  <td className="p-3">
                    {listing.status === 'pending' ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => changeListingStatus(listing.id, 'active')}
                          disabled={processingListingId === listing.id}
                          className="btn-outline text-xs py-1.5 px-3 text-emerald-600"
                        >
                          Onayla
                        </button>
                        <button
                          onClick={() => changeListingStatus(listing.id, 'rejected')}
                          disabled={processingListingId === listing.id}
                          className="btn-outline text-xs py-1.5 px-3 text-red-500"
                        >
                          Reddet
                        </button>
                        <button
                          onClick={() => deleteListing(listing.id)}
                          disabled={processingListingId === listing.id}
                          className="btn-outline flex items-center gap-1 px-3 py-1.5 text-xs text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Sil
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        {listing.status === 'active' ? 'Onaylandı' : listing.status === 'rejected' ? 'Reddedildi' : 'Sonuçlandı'}
                        <button
                          onClick={() => deleteListing(listing.id)}
                          disabled={processingListingId === listing.id}
                          className="btn-outline flex items-center gap-1 px-3 py-1.5 text-xs text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Sil
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && !listings.length && (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">İlan yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {activeTab === 'users' && (
      <section className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-black">Kullanıcılar</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left p-3">Ad</th>
                <th className="text-left p-3">E-posta</th>
                <th className="text-left p-3">Rol</th>
                <th className="text-left p-3">Durum</th>
                <th className="text-right p-3">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id} className="border-t border-gray-50">
                  <td className="p-3 font-bold">{item.name}</td>
                  <td className="p-3">{item.email}</td>
                  <td className="p-3">{item.role}</td>
                  <td className="p-3"><StatusBadge status={item.status} /></td>
                  <td className="p-3 text-right">
                    <button onClick={() => changeUserStatus(item.id, item.status === 'banned' ? 'active' : 'banned')} className="btn-outline text-xs py-1.5 px-3">
                      {item.status === 'banned' ? 'Aktifleştir' : 'Banla'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500 font-semibold">{label}</p>
      <p className="text-2xl font-black text-brand mt-1">{Number(value || 0).toLocaleString('tr-TR')}</p>
    </div>
  )
}

function StatusBadge({ status, order }: { status: string; order?: boolean }) {
  const orderLabels: Record<string, string> = {
    pending: 'Bekliyor',
    approved: 'Onaylandı',
    rejected: 'Reddedildi',
    cancelled: 'İptal',
  }
  const colors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    active: 'bg-emerald-100 text-emerald-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    passive: 'bg-gray-100 text-gray-600',
    sold: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-gray-100 text-gray-600',
  }
  const listingLabel = LISTING_STATUSES.find(([value]) => value === status)?.[1]
  const label = order ? orderLabels[status] || status : listingLabel || status
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${colors[status] || 'bg-gray-100 text-gray-600'}`}>{label}</span>
}
