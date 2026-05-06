'use client'

import Link from 'next/link'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetToken, setResetToken] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authApi.forgotPassword(email.trim())
      setResetToken(data.resetToken || '')
      toast.success(data.message || 'Şifre sıfırlama bağlantısı gönderildi')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'İşlem tamamlanamadı')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="card w-full max-w-md p-6">
        <h1 className="text-xl font-black text-gray-900">Şifremi Unuttum</h1>
        <p className="mt-1 text-sm text-gray-500">E-posta adresini yaz, şifre yenileme bağlantısını oluşturalım.</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="label">E-posta</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" placeholder="ornek@mail.com" />
          </div>
          <button disabled={loading} className="btn-brand w-full py-3">
            {loading ? 'Gönderiliyor...' : 'Bağlantı Gönder'}
          </button>
        </form>
        {resetToken && (
          <Link href={`/sifre-yenile?token=${resetToken}`} className="mt-4 block rounded-lg bg-brand-light px-3 py-2 text-sm font-bold text-brand">
            Geliştirme modu: Şifre yenileme sayfasını aç
          </Link>
        )}
        <Link href="/giris" className="mt-4 block text-center text-sm font-bold text-gray-500 hover:text-brand">
          Girişe dön
        </Link>
      </div>
    </div>
  )
}
