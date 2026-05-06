'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Clipboard, Clock3, Landmark, ReceiptText, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { promotionsApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'

const money = (value: number | string) =>
  Number(value || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })

const statusMap: Record<string, { label: string; className: string; icon: any }> = {
  pending: { label: 'Bekliyor', className: 'bg-amber-100 text-amber-700', icon: Clock3 },
  approved: { label: 'Onaylandı', className: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  rejected: { label: 'Reddedildi', className: 'bg-red-100 text-red-700', icon: XCircle },
  cancelled: { label: 'İptal', className: 'bg-gray-100 text-gray-600', icon: XCircle },
}

export default function PaymentInstructionPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuthStore()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    promotionsApi
      .getOrder(id)
      .then(({ data }) => setOrder(data.data))
      .catch((err) => {
        toast.error(err?.response?.data?.message || 'Ödeme talimatı alınamadı')
        router.push('/')
      })
      .finally(() => setLoading(false))
  }, [id, router, user])

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} kopyalandı`)
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="card p-8 text-center">
          <h1 className="text-xl font-black">Ödeme talimatı için giriş yap</h1>
          <button onClick={() => router.push('/giris')} className="btn-brand mt-5">
            Giriş Yap
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 animate-pulse space-y-3">
        <div className="h-10 bg-gray-100 rounded-lg w-48" />
        <div className="h-80 bg-gray-100 rounded-xl" />
      </div>
    )
  }

  if (!order) return null

  const status = statusMap[order.status] || statusMap.pending
  const StatusIcon = status.icon

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <button
        onClick={() => router.push(`/ilan/${order.listing_id}`)}
        className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-brand"
      >
        <ArrowLeft className="w-4 h-4" />
        İlan detayına dön
      </button>

      <div className="card p-5 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-brand flex items-center gap-2">
              <ReceiptText className="w-4 h-4" />
              Ödeme Talimatı
            </p>
            <h1 className="text-2xl font-black mt-1">{order.package_label || order.package_name}</h1>
            <p className="text-sm text-gray-500 mt-1">{order.listing_title}</p>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${status.className}`}>
            <StatusIcon className="w-4 h-4" />
            {status.label}
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <InfoRow label="Tutar" value={money(order.amount)} />
          <InfoRow label="Paket Süresi" value={`${order.duration_days} gün`} />
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
          <p className="font-black flex items-center gap-2">
            <Landmark className="w-5 h-5 text-brand" />
            Havale / EFT Bilgileri
          </p>
          <CopyRow label="Banka" value={order.bank_name} onCopy={copy} />
          <CopyRow label="Alıcı" value={order.iban_owner} onCopy={copy} />
          <CopyRow label="IBAN" value={order.iban} onCopy={copy} />
          <CopyRow label="Açıklama Kodu" value={order.payment_code} onCopy={copy} strong />
        </div>

        {order.status === 'pending' && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-800">
            Ödeme açıklamasına <b>{order.payment_code}</b> kodunu yaz. Admin onayından sonra paket otomatik aktif olur.
          </div>
        )}

        {order.status === 'approved' && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-800">
            Ödeme onaylandı ve paket ilanın için aktif edildi.
          </div>
        )}

        {order.admin_note && (
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-400">Admin notu</p>
            <p className="text-sm font-semibold mt-1">{order.admin_note}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
      <p className="text-xs text-gray-400 font-bold">{label}</p>
      <p className="font-black mt-1">{value}</p>
    </div>
  )
}

function CopyRow({
  label,
  value,
  strong,
  onCopy,
}: {
  label: string
  value: string
  strong?: boolean
  onCopy: (value: string, label: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white border border-gray-100 px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-gray-400 font-bold">{label}</p>
        <p className={`${strong ? 'font-black text-brand' : 'font-semibold'} truncate`}>{value}</p>
      </div>
      <button
        type="button"
        onClick={() => onCopy(value, label)}
        className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-brand hover:border-brand shrink-0"
        aria-label={`${label} kopyala`}
      >
        <Clipboard className="w-4 h-4" />
      </button>
    </div>
  )
}
