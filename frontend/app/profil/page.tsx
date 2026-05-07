'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Heart, Megaphone, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi, listingsApi, messagesApi, usersApi } from '@/lib/api'
import { mediaUrl } from '@/lib/media'
import { useAuthStore } from '@/lib/store'

const STATUSES: Record<string, string> = {
  pending: 'Onay Bekliyor',
  active: 'Yayında',
  passive: 'Yayından Kaldırıldı',
  sold: 'Satıldı',
  rejected: 'Reddedildi',
}

const TABS = [
  { key: 'listings', label: 'İlanlarım' },
  { key: 'bought', label: 'Aldıklarım' },
  { key: 'sold', label: 'Sattıklarım' },
]

export default function ProfilePage() {
  const router = useRouter()
  const { user, setUser, logout } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [listingsLoading, setListingsLoading] = useState(false)
  const [dealsLoading, setDealsLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('listings')
  const [listings, setListings] = useState<any[]>([])
  const [conversations, setConversations] = useState<any[]>([])
  const [form, setForm] = useState({ name: '', phone: '', city: '', district: '', bio: '' })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', password: '' })
  const [passwordSaving, setPasswordSaving] = useState(false)

  const soldListings = useMemo(() => listings.filter((listing) => listing.status === 'sold'), [listings])
  const boughtItems = useMemo(() => {
    if (!user) return []
    const buyerRows = conversations.filter((item) => item.buyer_id === user.id)
    const soldRows = buyerRows.filter((item) => item.listing_status === 'sold')
    return soldRows.length ? soldRows : buyerRows
  }, [conversations, user])

  const loadListings = async () => {
    setListingsLoading(true)
    try {
      const { data } = await listingsApi.getMine(statusFilter === 'all' ? undefined : { status: statusFilter })
      setListings(data.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'İlanların alınamadı')
    } finally {
      setListingsLoading(false)
    }
  }

  const loadDeals = async () => {
    setDealsLoading(true)
    try {
      const { data } = await messagesApi.getConversations()
      setConversations(data.data)
    } catch {
      setConversations([])
    } finally {
      setDealsLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    usersApi.getMe().then(({ data }) => {
      const me = data.data
      setForm({
        name: me.name || '',
        phone: me.phone || '',
        city: me.city || '',
        district: me.district || '',
        bio: me.bio || '',
      })
      setUser(me)
    })
  }, [user?.id, setUser])

  useEffect(() => {
    if (!user) return
    loadListings()
  }, [user?.id, statusFilter])

  useEffect(() => {
    if (!user) return
    loadDeals()
  }, [user?.id])

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const setPassword = (key: 'currentPassword' | 'password') => (e: React.ChangeEvent<HTMLInputElement>) =>
    setPasswordForm((f) => ({ ...f, [key]: e.target.value }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await usersApi.updateMe({
        ...form,
        phone: form.phone.trim() || null,
      })
      setUser({ ...(user as any), ...data.data })
      toast.success('Profil güncellendi')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Profil güncellenemedi')
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (id: string, status: string) => {
    try {
      await listingsApi.setStatus(id, status)
      toast.success('İlan durumu güncellendi')
      loadListings()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'İlan durumu değişmedi')
    }
  }

  const deleteListing = async (id: string) => {
    if (!window.confirm('Bu ilan kalıcı olarak silinsin mi?')) return
    try {
      await listingsApi.delete(id)
      toast.success('İlan silindi')
      loadListings()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'İlan silinemedi')
    }
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordSaving(true)
    try {
      await authApi.changePassword(passwordForm)
      toast.success('Şifre güncellendi. Tekrar giriş yapmalısın.')
      await logout()
      router.push('/giris')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Şifre güncellenemedi')
    } finally {
      setPasswordSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="card p-8 text-center">
          <h1 className="text-xl font-black">Profil için giriş yap</h1>
          <button onClick={() => router.push('/giris')} className="btn-brand mt-5">
            Giriş Yap
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <form onSubmit={save} className="card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-brand-light text-brand font-black text-xl flex items-center justify-center">
            {user.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-black">Profilim</h1>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label">Ad Soyad</label>
            <input value={form.name} onChange={set('name')} className="input" />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input value={form.phone} onChange={set('phone')} placeholder="05XXXXXXXXX" className="input" />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label">Şehir</label>
            <input value={form.city} onChange={set('city')} className="input" />
          </div>
          <div>
            <label className="label">İlçe</label>
            <input value={form.district} onChange={set('district')} className="input" />
          </div>
        </div>
        <div>
          <label className="label">Hakkımda</label>
          <textarea value={form.bio} onChange={set('bio')} rows={3} className="input resize-none" />
        </div>
        <div className="flex gap-2">
          <button disabled={saving} className="btn-brand flex-1">
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
          <button type="button" onClick={() => logout().then(() => router.push('/'))} className="btn-outline">
            Çıkış
          </button>
        </div>
      </form>

      <form onSubmit={changePassword} className="card p-5 space-y-4">
        <div>
          <h2 className="text-lg font-black text-gray-900">Şifre Yenile</h2>
          <p className="text-sm text-gray-500 mt-1">Güvenlik için mevcut şifreni girerek yeni şifre belirleyebilirsin.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label">Mevcut şifre</label>
            <input type="password" value={passwordForm.currentPassword} onChange={setPassword('currentPassword')} required className="input" />
          </div>
          <div>
            <label className="label">Yeni şifre</label>
            <input type="password" value={passwordForm.password} onChange={setPassword('password')} required minLength={6} className="input" />
          </div>
        </div>
        <button disabled={passwordSaving} className="btn-outline">
          {passwordSaving ? 'Güncelleniyor...' : 'Şifreyi Yenile'}
        </button>
      </form>

      <section className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-full bg-gray-100 p-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full px-4 py-2 text-sm font-black transition-colors ${
                  activeTab === tab.key ? 'bg-white text-brand shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'listings' && (
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-auto">
              <option value="all">Tüm ilanlar</option>
              <option value="pending">Onay bekleyen</option>
              <option value="active">Yayında</option>
              <option value="passive">Yayından kaldırılan</option>
              <option value="sold">Satılan</option>
              <option value="rejected">Reddedilen</option>
            </select>
          )}
        </div>

        {activeTab === 'listings' && (
          <ListingList
            listings={listings}
            loading={listingsLoading}
            emptyText="Henüz ilan yok."
            onStatus={changeStatus}
            onDelete={deleteListing}
          />
        )}

        {activeTab === 'sold' && (
          <ListingList
            listings={soldListings}
            loading={listingsLoading}
            emptyText="Henüz satılan ilan yok."
            onStatus={changeStatus}
            onDelete={deleteListing}
          />
        )}

        {activeTab === 'bought' && (
          <div className="divide-y divide-gray-100">
            {boughtItems.map((item) => (
              <DealRow key={item.id} item={item} />
            ))}
            {!dealsLoading && !boughtItems.length && (
              <EmptyState text="Henüz aldığın ilan yok." actionHref="/ilanlar" actionLabel="İlanlara Bak" />
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function ListingList({
  listings,
  loading,
  emptyText,
  onStatus,
  onDelete,
}: {
  listings: any[]
  loading: boolean
  emptyText: string
  onStatus: (id: string, status: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="divide-y divide-gray-100">
      {listings.map((listing) => (
        <MyListingRow key={listing.id} listing={listing} onStatus={onStatus} onDelete={onDelete} />
      ))}
      {!loading && !listings.length && <EmptyState text={emptyText} actionHref="/ilan-ver" actionLabel="İlan Ver" />}
    </div>
  )
}

function MyListingRow({
  listing,
  onStatus,
  onDelete,
}: {
  listing: any
  onStatus: (id: string, status: string) => void
  onDelete: (id: string) => void
}) {
  const img = normalizeImage(listing.primary_image)

  return (
    <div className="p-4 flex flex-col lg:flex-row lg:items-center gap-4">
      <Link href={`/ilan/${listing.id}`} className="flex items-center gap-3 min-w-0 flex-1">
        <ListingImage img={img} title={listing.title} fallback={listing.category_icon} />
        <div className="min-w-0">
          <p className="font-black truncate">{listing.title}</p>
          <p className="text-sm text-gray-500 truncate">
            {Number(listing.price || 0).toLocaleString('tr-TR')} TL · {listing.city || 'Konum yok'} · {listing.category_name}
          </p>
          <StatusBadge status={listing.status} />
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-2 text-sm lg:w-44">
        <Stat icon={Eye} label="Görüntüleme" value={listing.view_count || 0} />
        <Stat icon={Heart} label="Favori" value={listing.favorite_count || 0} />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Link href={`/ilan/${listing.id}/duzenle`} className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1">
          <Pencil className="w-4 h-4" />
          Düzenle
        </Link>
        <Link href={`/ilan/${listing.id}/one-cikar`} className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1">
          <Megaphone className="w-4 h-4" />
          Öne Çıkar
        </Link>
        {listing.status === 'active' && (
          <>
            <button onClick={() => onStatus(listing.id, 'passive')} className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1">
              <EyeOff className="w-4 h-4" />
              Kaldır
            </button>
            <button onClick={() => onStatus(listing.id, 'sold')} className="btn-outline text-xs py-1.5 px-3">
              Satıldı
            </button>
          </>
        )}
        {['passive', 'sold'].includes(listing.status) && (
          <button onClick={() => onStatus(listing.id, 'active')} className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1">
            <RotateCcw className="w-4 h-4" />
            Yayına Al
          </button>
        )}
        <button onClick={() => onDelete(listing.id)} className="btn-outline text-xs py-1.5 px-3 text-red-500 flex items-center gap-1">
          <Trash2 className="w-4 h-4" />
          Sil
        </button>
      </div>
    </div>
  )
}

function DealRow({ item }: { item: any }) {
  const img = normalizeImage(item.listing_image)

  return (
    <Link href={`/ilan/${item.listing_id}`} className="p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors">
      <ListingImage img={img} title={item.listing_title} />
      <div className="min-w-0 flex-1">
        <p className="font-black truncate">{item.listing_title}</p>
        <p className="text-sm text-gray-500 truncate">
          {Number(item.listing_price || 0).toLocaleString('tr-TR')} TL · {item.other_name}
        </p>
        <StatusBadge status={item.listing_status || 'active'} />
      </div>
    </Link>
  )
}

function ListingImage({ img, title, fallback }: { img: string | null; title: string; fallback?: string }) {
  return (
    <div className="w-20 h-16 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
      {img ? <img src={img} alt={title} className="w-full h-full object-cover" /> : <span className="text-2xl">{fallback || '•'}</span>}
    </div>
  )
}

function EmptyState({ text, actionHref, actionLabel }: { text: string; actionHref: string; actionLabel: string }) {
  return (
    <div className="p-10 text-center text-gray-400">
      <p className="font-semibold text-gray-600">{text}</p>
      <Link href={actionHref} className="btn-brand inline-flex mt-4">
        {actionLabel}
      </Link>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex mt-1 rounded-full bg-brand-light px-2 py-1 text-xs font-bold text-brand">
      {STATUSES[status] || status}
    </span>
  )
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <p className="text-[11px] font-semibold text-gray-400 flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </p>
      <p className="font-black">{Number(value).toLocaleString('tr-TR')}</p>
    </div>
  )
}

function normalizeImage(path?: string | null) {
  return mediaUrl(path)
}
