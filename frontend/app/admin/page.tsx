'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ImagePlus, Landmark, Pencil, RefreshCw, Save, Trash2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { adminApi } from '@/lib/api'
import { API_BASE_URL } from '@/lib/config'
import { useAuthStore } from '@/lib/store'

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

const money = (value: number | string) =>
  Number(value || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })

const API = API_BASE_URL
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

export default function AdminPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [dashboard, setDashboard] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [listings, setListings] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [banners, setBanners] = useState<any[]>([])
  const [paymentSettings, setPaymentSettings] = useState<any>(null)
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm)
  const [status, setStatus] = useState('')
  const [orderStatus, setOrderStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null)
  const [bannerForm, setBannerForm] = useState(emptyBannerForm)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null)
  const [savingBanner, setSavingBanner] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [d, u, l, o, b, p] = await Promise.all([
        adminApi.dashboard(),
        adminApi.users(),
        adminApi.listings(status ? { status } : undefined),
        adminApi.promotionOrders(orderStatus ? { status: orderStatus } : undefined),
        adminApi.banners(),
        adminApi.paymentSettings(),
      ])
      setDashboard(d.data.data)
      setUsers(u.data.data)
      setListings(l.data.data)
      setOrders(o.data.data)
      setBanners(b.data.data)
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
    try {
      await adminApi.setListingStatus(id, nextStatus)
      toast.success('İlan durumu güncellendi')
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Durum güncellenemedi')
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
            const imageUrl = banner.image_url?.startsWith('http') ? banner.image_url : `${API}${banner.image_url}`
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
                      <div className="flex justify-end gap-2">
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
                    <div className="flex justify-end gap-2">
                      <button onClick={() => changeListingStatus(listing.id, 'active')} className="btn-outline text-xs py-1.5 px-3">Onayla</button>
                      <button onClick={() => changeListingStatus(listing.id, 'rejected')} className="btn-outline text-xs py-1.5 px-3 text-red-500">Reddet</button>
                    </div>
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
  const listingLabel = LISTING_STATUSES.find(([value]) => value === status)?.[1]
  const label = order ? orderLabels[status] || status : listingLabel || status
  return <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">{label}</span>
}
