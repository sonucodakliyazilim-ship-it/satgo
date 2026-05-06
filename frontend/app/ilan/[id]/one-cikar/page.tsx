'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ArrowUp, CalendarDays, Flame, Megaphone, Sparkles, Store } from 'lucide-react'
import toast from 'react-hot-toast'
import { listingsApi, promotionsApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'

const packageIcon = (code?: string, type?: string) => {
  if (code === 'daily_featured' || code === 'weekly_featured') return CalendarDays
  if (type === 'urgent') return Flame
  if (type === 'showcase') return Store
  if (type === 'boost') return ArrowUp
  return Sparkles
}

const money = (value: number | string) =>
  Number(value || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })

export default function PromoteListingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuthStore()
  const [listing, setListing] = useState<any>(null)
  const [packages, setPackages] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    let alive = true
    Promise.all([listingsApi.getOne(id), promotionsApi.getPackages()])
      .then(([listingRes, packageRes]) => {
        if (!alive) return
        const currentListing = listingRes.data.data
        if (currentListing.user_id !== user.id && user.role !== 'admin') {
          toast.error('Bu ilan için paket satın alamazsın.')
          router.push(`/ilan/${id}`)
          return
        }
        setListing(currentListing)
        setPackages(packageRes.data.data)
        setSelectedId(packageRes.data.data[0]?.id || null)
      })
      .catch((err) => {
        toast.error(err?.response?.data?.message || 'Paketler alınamadı')
        router.push(`/ilan/${id}`)
      })
      .finally(() => alive && setLoading(false))

    return () => {
      alive = false
    }
  }, [id, router, user])

  const selectedPackage = useMemo(
    () => packages.find((pkg) => pkg.id === selectedId),
    [packages, selectedId],
  )

  const purchase = async () => {
    if (!selectedPackage) return
    setSubmitting(true)
    try {
      const { data } = await promotionsApi.purchase({
        listing_id: id,
        package_id: selectedPackage.id,
        user_note: note.trim() || undefined,
      })
      toast.success('Ödeme talimatı oluşturuldu')
      router.push(`/odeme-talimat/${data.data.order.id}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ödeme talimatı oluşturulamadı')
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="card p-8 text-center">
          <h1 className="text-xl font-black">Paket satın almak için giriş yap</h1>
          <button onClick={() => router.push('/giris')} className="btn-brand mt-5">
            Giriş Yap
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 animate-pulse">
        <div className="h-10 bg-gray-100 rounded-lg w-48 mb-5" />
        <div className="grid md:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <button
        onClick={() => router.push(`/ilan/${id}`)}
        className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-brand"
      >
        <ArrowLeft className="w-4 h-4" />
        İlan detayına dön
      </button>

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-brand flex items-center gap-2">
            <Megaphone className="w-4 h-4" />
            Öne çıkarma paketi
          </p>
          <h1 className="text-2xl font-black mt-1">{listing?.title}</h1>
          <p className="text-sm text-gray-500 mt-1">Onaylanan ödeme sonrası paket aktif olur.</p>
        </div>
        <div className="text-sm text-gray-500">
          İlan durumu: <span className="font-bold text-gray-800">{listing?.status}</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {packages.map((pkg) => {
          const Icon = packageIcon(pkg.code, pkg.type)
          const active = pkg.id === selectedId
          return (
            <button
              key={pkg.id}
              onClick={() => setSelectedId(pkg.id)}
              className={`card text-left p-4 transition-all border-2 ${
                active ? 'border-brand shadow-md' : 'border-gray-100 hover:border-brand/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-full bg-brand-light text-brand flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </span>
                  <div>
                    <h2 className="font-black text-gray-900">{pkg.label || pkg.name}</h2>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">{pkg.description}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-brand">{money(pkg.price)}</p>
                  <p className="text-xs text-gray-400">{pkg.duration_days} gün</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <label className="label">Ödeme notu</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            className="input resize-none"
            placeholder="Havale açıklamasına eklemek istediğin kısa not"
          />
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">Seçilen paket</p>
            <p className="font-black">
              {selectedPackage ? `${selectedPackage.label || selectedPackage.name} · ${money(selectedPackage.price)}` : 'Paket seç'}
            </p>
          </div>
          <button
            onClick={purchase}
            disabled={!selectedPackage || submitting || listing?.status !== 'active'}
            className="btn-brand md:min-w-56"
          >
            {submitting ? 'Oluşturuluyor...' : 'Ödeme Talimatı Oluştur'}
          </button>
        </div>
        {listing?.status !== 'active' && (
          <p className="text-sm font-semibold text-red-500">Sadece aktif ilanlar için paket satın alınabilir.</p>
        )}
      </div>
    </div>
  )
}
