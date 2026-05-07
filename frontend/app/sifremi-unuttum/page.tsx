'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetToken, setResetToken] = useState('')
  const [password, setPassword] = useState('')
  const [passwordAgain, setPasswordAgain] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authApi.forgotPassword(email.trim())
      setResetToken(data.resetToken || data.data?.resetToken || '')
      toast.success(data.message || 'Şifre sıfırlama bağlantısı gönderildi')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'İşlem tamamlanamadı')
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== passwordAgain) {
      toast.error('Yeni şifreler aynı olmalı')
      return
    }

    setResetLoading(true)
    try {
      await authApi.resetPassword(resetToken.trim(), password)
      toast.success('Şifre yenilendi, giriş yapabilirsin')
      router.push('/giris')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Şifre yenilenemedi')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-8">
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
            Şifre yenileme sayfasını aç
          </Link>
        )}

        <form onSubmit={resetPassword} className="mt-5 space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
          <div>
            <h2 className="font-black text-gray-900">Şifre Yenile</h2>
            <p className="mt-1 text-xs font-semibold text-gray-500">E-postadan gelen yenileme kodunu girerek yeni şifre belirle.</p>
          </div>
          <div>
            <label className="label">Yenileme kodu</label>
            <input value={resetToken} onChange={(e) => setResetToken(e.target.value)} required className="input bg-white" placeholder="Yenileme kodu" />
          </div>
          <div>
            <label className="label">Yeni şifre</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="input bg-white" />
          </div>
          <div>
            <label className="label">Yeni şifre tekrar</label>
            <input type="password" value={passwordAgain} onChange={(e) => setPasswordAgain(e.target.value)} required minLength={6} className="input bg-white" />
          </div>
          <button disabled={resetLoading || !resetToken.trim()} className="btn-brand w-full py-3">
            {resetLoading ? 'Kaydediliyor...' : 'Şifreyi Yenile'}
          </button>
        </form>

        <Link href="/giris" className="mt-4 block text-center text-sm font-bold text-gray-500 hover:text-brand">
          Girişe dön
        </Link>
      </div>
    </div>
  )
}
