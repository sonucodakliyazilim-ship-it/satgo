'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { favoritesApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import ListingCard from '@/components/listings/ListingCard'

export default function FavoritesPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    favoritesApi.getAll().then(({ data }) => setItems(data.data)).catch(() => setItems([])).finally(() => setLoading(false))
  }, [user])

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="card p-8 text-center">
          <h1 className="text-xl font-black">Favorilerini görmek için giriş yap</h1>
          <button onClick={() => router.push('/giris')} className="btn-brand mt-5">
            Giriş Yap
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-xl font-black mb-4">Favorilerim</h1>
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card animate-pulse h-56" />
          ))}
        </div>
      ) : items.length ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((listing) => (
            <ListingCard key={listing.id} listing={{ ...listing, is_favorited: true }} />
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center text-gray-500">Henüz favori ilan yok.</div>
      )}
    </div>
  )
}
