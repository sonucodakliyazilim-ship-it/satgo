'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { listingsApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    city: '',
    district: '',
    neighborhood: '',
  })

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    listingsApi
      .getOne(id)
      .then(({ data }) => {
        const listing = data.data
        if (listing.user_id !== user.id && user.role !== 'admin') {
          toast.error('Bu ilanı düzenleme yetkin yok.')
          router.push(`/ilan/${id}`)
          return
        }
        setForm({
          title: listing.title || '',
          description: listing.description || '',
          price: listing.price ? String(Number(listing.price)) : '',
          city: listing.city || '',
          district: listing.district || '',
          neighborhood: listing.neighborhood || '',
        })
      })
      .catch(() => {
        toast.error('İlan bulunamadı')
        router.push('/profil')
      })
      .finally(() => setLoading(false))
  }, [id, router, user])

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [key]: e.target.value }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await listingsApi.update(id, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        price: form.price ? Number(form.price) : null,
        city: form.city.trim() || null,
        district: form.district.trim() || null,
        neighborhood: form.neighborhood.trim() || null,
      })
      toast.success('İlan güncellendi')
      router.push('/profil')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'İlan güncellenemedi')
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="card p-8 text-center">
          <h1 className="text-xl font-black">İlan düzenlemek için giriş yap</h1>
          <button onClick={() => router.push('/giris')} className="btn-brand mt-5">
            Giriş Yap
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 animate-pulse space-y-3">
        <div className="h-10 bg-gray-100 rounded-lg w-48" />
        <div className="h-96 bg-gray-100 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <button
        type="button"
        onClick={() => router.push('/profil')}
        className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-brand"
      >
        <ArrowLeft className="w-4 h-4" />
        İlanlarıma dön
      </button>

      <form onSubmit={save} className="card p-5 space-y-4">
        <div>
          <h1 className="text-xl font-black">İlanı Düzenle</h1>
          <p className="text-sm text-gray-500 mt-1">Başlık, açıklama, fiyat ve konum bilgilerini güncelle.</p>
        </div>

        <div>
          <label className="label">Başlık</label>
          <input value={form.title} onChange={set('title')} required minLength={5} maxLength={200} className="input" />
        </div>

        <div>
          <label className="label">Açıklama</label>
          <textarea value={form.description} onChange={set('description')} rows={5} className="input resize-none" />
        </div>

        <div>
          <label className="label">Fiyat</label>
          <input value={form.price} onChange={set('price')} type="number" min={0} step="1" className="input" />
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="label">Şehir</label>
            <input value={form.city} onChange={set('city')} className="input" />
          </div>
          <div>
            <label className="label">İlçe</label>
            <input value={form.district} onChange={set('district')} className="input" />
          </div>
          <div>
            <label className="label">Mahalle</label>
            <input value={form.neighborhood} onChange={set('neighborhood')} className="input" />
          </div>
        </div>

        <button disabled={saving} className="btn-brand w-full flex items-center justify-center gap-2">
          <Save className="w-4 h-4" />
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </form>
    </div>
  )
}
