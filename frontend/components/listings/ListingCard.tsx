'use client'

import Link from 'next/link'
import { Heart, MapPin, Clock } from 'lucide-react'
import { useState } from 'react'
import { favoritesApi } from '@/lib/api'
import { mediaUrl } from '@/lib/media'
import { useAuthStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m} dk önce`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} sa önce`
  return `${Math.floor(h / 24)} gün önce`
}

export default function ListingCard({ listing }: { listing: any }) {
  const { user } = useAuthStore()
  const router = useRouter()
  const [faved, setFaved] = useState(listing.is_favorited || false)
  const [saving, setSaving] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)

  const imgSrc = mediaUrl(listing.primary_image)

  const toggleFav = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!user) {
      router.push('/giris')
      return
    }
    setSaving(true)
    try {
      if (faved) {
        await favoritesApi.remove(listing.id)
        setFaved(false)
        toast.success('Favoriden çıkarıldı')
      } else {
        await favoritesApi.add(listing.id)
        setFaved(true)
        toast.success('Favorilere eklendi')
      }
    } catch {
      toast.error('Bir hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Link href={`/ilan/${listing.id}`} className="card block hover:-translate-y-1 transition-all hover:shadow-md overflow-hidden group">
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        {imgSrc && !imageFailed ? (
          <img
            src={imgSrc}
            alt={listing.title}
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs font-bold text-gray-400">
            Fotoğraf yüklenemedi
          </div>
        )}

        <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
          {listing.is_featured && <span className="badge-featured">⚡ Öne Çıkan</span>}
          {listing.is_urgent && <span className="badge-urgent">🔥 Acil</span>}
          {listing.is_showcase && <span className="badge-showcase">✨ Vitrin</span>}
        </div>

        <button
          onClick={toggleFav}
          disabled={saving}
          className="absolute top-2 right-2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow hover:scale-110 transition-transform"
        >
          <Heart className={`w-4 h-4 ${faved ? 'fill-brand text-brand' : 'text-gray-400'}`} />
        </button>
      </div>

      <div className="p-3">
        <p className="text-lg font-black text-brand">{Number(listing.price).toLocaleString('tr-TR')} ₺</p>
        <p className="text-sm font-medium text-gray-800 mt-0.5 line-clamp-2 leading-snug">{listing.title}</p>
        <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {listing.city}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeAgo(listing.created_at)}
          </span>
        </div>
      </div>
    </Link>
  )
}
