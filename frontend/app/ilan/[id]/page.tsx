'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { listingsApi, messagesApi, favoritesApi } from '@/lib/api'
import { mediaUrl } from '@/lib/media'
import { useAuthStore } from '@/lib/store'
import { Heart, MapPin, Clock, MessageCircle, ChevronLeft, ChevronRight, Share2, Flag, Megaphone, BadgePercent } from 'lucide-react'
import toast from 'react-hot-toast'

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 24) return `${h} saat önce`
  return `${Math.floor(h / 24)} gün önce`
}

const yesNo = (value: any) => (value ? 'Evet' : 'Hayır')

const vehicleOptionLabel = (value?: string | null) => {
  const labels: Record<string, string> = {
    gasoline: 'Benzin',
    diesel: 'Dizel',
    lpg: 'LPG',
    electric: 'Elektrik',
    hybrid: 'Hibrit',
    automatic: 'Otomatik',
    manual: 'Manuel',
    semi_automatic: 'Yarı Otomatik',
    front: 'Önden Çekiş',
    rear: 'Arkadan İtiş',
    awd: '4x4 / AWD',
    sedan: 'Sedan',
    hatchback: 'Hatchback',
    suv: 'SUV',
    coupe: 'Coupe',
    wagon: 'Station Wagon',
    van: 'Van',
    pickup: 'Pickup',
    tr: 'TR Plaka',
    foreign: 'Yabancı Plaka',
    none: 'Yok',
    exists: 'Var',
    unknown: 'Bilinmiyor',
    true: 'Var',
    false: 'Yok',
  }
  return value ? labels[value] || value : value
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuthStore()

  const [listing, setListing] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [imgIdx, setImgIdx] = useState(0)
  const [faved, setFaved] = useState(false)
  const [sending, setSending] = useState(false)
  const [offerSending, setOfferSending] = useState<number | null>(null)
  const [msg, setMsg] = useState('')
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    listingsApi
      .getOne(id)
      .then(({ data }) => {
        setListing(data.data)
        setFaved(data.data.is_favorited || false)
        setImageFailed(false)
      })
      .catch(() => router.push('/ilanlar'))
      .finally(() => setLoading(false))
  }, [id, router])

  const toggleFav = async () => {
    if (!user) {
      router.push('/giris')
      return
    }
    try {
      if (faved) {
        await favoritesApi.remove(id)
        setFaved(false)
        toast.success('Favoriden çıkarıldı')
      } else {
        await favoritesApi.add(id)
        setFaved(true)
        toast.success('Favorilere eklendi')
      }
    } catch {
      toast.error('Hata oluştu')
    }
  }

  const sendMsg = async () => {
    if (!user) {
      router.push('/giris')
      return
    }
    if (!msg.trim()) return
    setSending(true)
    try {
      await messagesApi.send({ listing_id: id, content: msg })
      toast.success('Mesaj gönderildi!')
      setMsg('')
      router.push('/mesajlar')
    } catch {
      toast.error('Mesaj gönderilemedi')
    } finally {
      setSending(false)
    }
  }

  const sendOffer = async (amount: number) => {
    if (!user) {
      router.push('/giris')
      return
    }
    setOfferSending(amount)
    try {
      const formatted = amount.toLocaleString('tr-TR')
      await messagesApi.send({ listing_id: id, content: `Teklifim: ${formatted} TL` })
      toast.success('Teklif gönderildi!')
      router.push('/mesajlar')
    } catch {
      toast.error('Teklif gönderilemedi')
    } finally {
      setOfferSending(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 animate-pulse">
        <div className="h-72 bg-gray-200 rounded-2xl mb-4" />
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-2/3" />
      </div>
    )
  }

  if (!listing) return null

  const images = listing.images || []
  const img = images[imgIdx]
  const imgUrl = mediaUrl(img?.url)
  const price = Number(listing.price || 0)
  const offerOptions = price > 0
    ? [
        { label: 'İlan fiyatı', helper: 'Satıcının istediği ücret', amount: price },
        { label: '%5 altı', helper: 'Makul pazarlık', amount: Math.round(price * 0.95) },
        { label: '%10 altı', helper: 'En düşük hızlı teklif', amount: Math.round(price * 0.9) },
      ]
    : []

  return (
    <div className="max-w-5xl mx-auto px-4 py-4">
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="card overflow-hidden">
            <div className="relative aspect-[4/3] bg-gray-100">
              {imgUrl && !imageFailed ? (
                <img
                  src={imgUrl}
                  alt={listing.title}
                  onError={() => setImageFailed(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <img src="/satgo-logo.jpeg" alt="" className="h-full w-full object-contain p-16 opacity-70" />
              )}

              <div className="absolute top-3 left-3 flex gap-1">
                {listing.is_featured && <span className="badge-featured">⚡ Öne Çıkan</span>}
                {listing.is_urgent && <span className="badge-urgent">🔥 Acil</span>}
                {listing.is_showcase && <span className="badge-showcase">✨ Vitrin</span>}
              </div>

              {images.length > 1 && (
                <>
                  <button
                    onClick={() => {
                      setImageFailed(false)
                      setImgIdx((i) => Math.max(0, i - 1))
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 rounded-full flex items-center justify-center shadow"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setImageFailed(false)
                      setImgIdx((i) => Math.min(images.length - 1, i + 1))
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 rounded-full flex items-center justify-center shadow"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                    {imgIdx + 1}/{images.length}
                  </div>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto">
                {images.map((im: any, i: number) => {
                  const tUrl = mediaUrl(im.url)
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setImageFailed(false)
                        setImgIdx(i)
                      }}
                      className={`w-16 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition-colors ${
                        i === imgIdx ? 'border-brand' : 'border-transparent'
                      }`}
                    >
                      {tUrl ? <img src={tUrl} alt="" className="h-full w-full object-cover" /> : null}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-2xl font-black text-brand">{Number(listing.price).toLocaleString('tr-TR')} ₺</p>
                <h1 className="text-xl font-bold text-gray-800 mt-1">{listing.title}</h1>
              </div>
              <button
                onClick={toggleFav}
                className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:border-brand transition-colors shrink-0"
              >
                <Heart className={`w-5 h-5 ${faved ? 'fill-brand text-brand' : 'text-gray-400'}`} />
              </button>
            </div>

            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {listing.city}
                {listing.district && `, ${listing.district}`}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {timeAgo(listing.created_at)}
              </span>
            </div>
          </div>

          {!!listing.hierarchy_labels?.length && (
            <div className="card p-5">
              <h2 className="font-bold text-gray-800 mb-3">Kategori Detayı</h2>
              <div className="flex flex-wrap gap-2">
                {listing.hierarchy_labels.map((label: string, index: number) => (
                  <span key={`${label}-${index}`} className="rounded-full bg-brand-light px-3 py-1.5 text-xs font-black text-brand">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!!listing.custom_fields?.length && (
            <div className="card p-5">
              <h2 className="font-bold text-gray-800 mb-3">İlan Bilgileri</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {listing.custom_fields
                  .filter((field: any) => field.value !== null && field.value !== undefined && field.value !== '')
                  .map((field: any) => (
                    <div key={field.id} className="rounded-lg bg-gray-50 px-3 py-2.5">
                      <p className="text-[11px] font-medium text-gray-400">{field.label}</p>
                      <p className="text-sm font-semibold text-gray-800">
                        {field.field_type === 'checkbox' || field.field_type === 'boolean'
                          ? field.value
                            ? 'Evet'
                            : 'Hayır'
                          : String(field.value)}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {listing.vehicle_details && (
            <div className="card p-5">
              <h2 className="font-bold text-gray-800 mb-3">Araç Bilgileri</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Marka', listing.vehicle_details.brand],
                  ['Model', listing.vehicle_details.model],
                  ['Seri', listing.vehicle_details.series],
                  ['Paket', listing.vehicle_details.package_name],
                  ['Tip', listing.vehicle_details.type_name || listing.vehicle_details.trim_name],
                  ['Yıl', listing.vehicle_details.year],
                  ['KM', listing.vehicle_details.mileage?.toLocaleString('tr-TR')],
                  ['Yakıt Tipi', vehicleOptionLabel(listing.vehicle_details.fuel_type)],
                  ['Vites Tipi', vehicleOptionLabel(listing.vehicle_details.transmission)],
                  ['Kasa Tipi', vehicleOptionLabel(listing.vehicle_details.body_type)],
                  ['Çekiş', vehicleOptionLabel(listing.vehicle_details.drive_type)],
                  ['Renk', listing.vehicle_details.color],
                  ['Garanti', yesNo(listing.vehicle_details.has_warranty)],
                  ['Kalan Garanti Süresi / KM Sayısı', listing.vehicle_details.warranty_remaining],
                  ['Ağır Hasar Kayıtlı', yesNo(listing.vehicle_details.has_damage_record)],
                  ['LPG', yesNo(listing.vehicle_details.has_lpg)],
                  ['Plaka Tipi', vehicleOptionLabel(listing.vehicle_details.plate_type)],
                  ['Takas Durumu', yesNo(listing.vehicle_details.trade_in)],
                  ['Plaka', listing.vehicle_details.plate_number],
                  ['Şasi No (Son 6 Hanesi)', listing.vehicle_details.chassis_last6],
                  ['Hasar / Tramer Kaydı', vehicleOptionLabel(listing.vehicle_details.tramer_record)],
                  ['Rehin & Haciz Durumu', vehicleOptionLabel(listing.vehicle_details.lien_pledge_status)],
                  ['Marka Adı', listing.vehicle_details.legal_brand],
                  ['Ticari Adı', listing.vehicle_details.commercial_name],
                  ['Model Yılı', listing.vehicle_details.legal_model_year],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="bg-gray-50 rounded-lg px-3 py-2.5">
                      <p className="text-[11px] text-gray-400 font-medium">{k}</p>
                      <p className="text-sm font-semibold text-gray-800 capitalize">{String(v)}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {listing.motorcycle_details && (
            <div className="card p-5">
              <h2 className="font-bold text-gray-800 mb-3">Motor Bilgileri</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Marka', listing.motorcycle_details.brand],
                  ['Model', listing.motorcycle_details.model],
                  ['Seri', listing.motorcycle_details.series],
                  ['Paket', listing.motorcycle_details.package_name],
                  ['Yıl', listing.motorcycle_details.year],
                  ['KM', listing.motorcycle_details.mileage?.toLocaleString('tr-TR')],
                  ['Motor Hacmi', listing.motorcycle_details.engine_cc && `${listing.motorcycle_details.engine_cc} cc`],
                  ['Renk', listing.motorcycle_details.color],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="bg-gray-50 rounded-lg px-3 py-2.5">
                      <p className="text-[11px] text-gray-400 font-medium">{k}</p>
                      <p className="text-sm font-semibold text-gray-800 capitalize">{String(v)}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {listing.real_estate_details && (
            <div className="card p-5">
              <h2 className="font-bold text-gray-800 mb-3">Emlak Bilgileri</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['İlan Tipi', listing.real_estate_details.listing_type === 'sale' ? 'Satılık' : 'Kiralık'],
                  ['Alan (m²)', listing.real_estate_details.size_m2],
                  ['Oda Sayısı', listing.real_estate_details.room_count],
                  ['Bina Yaşı', listing.real_estate_details.building_age],
                  ['Bulunduğu Kat', listing.real_estate_details.floor],
                  ['Isıtma', listing.real_estate_details.heating],
                  ['Eşyalı', listing.real_estate_details.is_furnished ? 'Evet' : 'Hayır'],
                  ['Aidat', listing.real_estate_details.monthly_dues && `${listing.real_estate_details.monthly_dues} ₺`],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="bg-gray-50 rounded-lg px-3 py-2.5">
                      <p className="text-[11px] text-gray-400 font-medium">{k}</p>
                      <p className="text-sm font-semibold text-gray-800">{String(v)}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {listing.description && (
            <div className="card p-5">
              <h2 className="font-bold text-gray-800 mb-2">Açıklama</h2>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{listing.description}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-bold text-gray-800 mb-3">Satıcı</h2>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-brand-light text-brand font-black text-lg flex items-center justify-center">
                {listing.seller_name?.[0] || '?'}
              </div>
              <div>
                <p className="font-bold">{listing.seller_name}</p>
                <p className="text-sm text-gray-500">
                  ⭐ {Number(listing.seller_rating || 0).toFixed(1)} · {listing.seller_listing_count} ilan
                </p>
              </div>
            </div>

            {user?.id === listing.user_id && (
              <button
                onClick={() => router.push(`/ilan/${id}/one-cikar`)}
                className="btn-brand w-full flex items-center justify-center gap-2 text-sm"
              >
                <Megaphone className="w-4 h-4" />
                İlanı Öne Çıkar
              </button>
            )}

            {user?.id !== listing.user_id && (
              <div className="space-y-2">
                {!!offerOptions.length && (
                  <div className="rounded-xl border border-brand/20 bg-brand-light p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-black text-gray-900">
                      <BadgePercent className="h-4 w-4 text-brand" />
                      Hızlı teklif ver
                    </div>
                    <div className="grid gap-2">
                      {offerOptions.map((offer) => (
                        <button
                          key={offer.label}
                          type="button"
                          onClick={() => sendOffer(offer.amount)}
                          disabled={offerSending !== null}
                          className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-left shadow-sm transition-colors hover:text-brand disabled:opacity-60"
                        >
                          <span>
                            <span className="block text-sm font-black">{offer.label}</span>
                            <span className="block text-xs font-semibold text-gray-400">{offer.helper}</span>
                          </span>
                          <span className="text-sm font-black">{offer.amount.toLocaleString('tr-TR')} TL</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <textarea
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  placeholder="Merhaba, ilan hakkında bilgi almak istiyorum..."
                  rows={3}
                  className="input resize-none text-sm"
                />
                <button
                  onClick={sendMsg}
                  disabled={sending || !msg.trim()}
                  className="btn-brand w-full flex items-center justify-center gap-2 text-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  {sending ? 'Gönderiliyor...' : 'Mesaj Gönder'}
                </button>
              </div>
            )}
          </div>

          <div className="card p-4 flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(window.location.href).then(() => toast.success('Link kopyalandı'))}
              className="flex-1 btn-outline text-sm flex items-center justify-center gap-1.5 py-2"
            >
              <Share2 className="w-4 h-4" /> Paylaş
            </button>
            <button className="flex-1 btn-outline text-sm flex items-center justify-center gap-1.5 py-2 text-red-400 border-red-200 hover:border-red-400 hover:text-red-500">
              <Flag className="w-4 h-4" /> Şikayet
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
