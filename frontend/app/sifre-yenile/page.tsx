'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  )
}

function ResetPasswordContent() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      toast.success('Şifre yenilendi')
      router.push('/giris')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Şifre yenilenemedi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <form onSubmit={submit} className="card w-full max-w-md p-6 space-y-4">
        <div>
          <h1 className="text-xl font-black text-gray-900">Yeni Şifre Belirle</h1>
          <p className="mt-1 text-sm text-gray-500">Yeni şifren en az 6 karakter olmalı.</p>
        </div>
        <div>
          <label className="label">Yeni şifre</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="input" />
        </div>
        <button disabled={loading || !token} className="btn-brand w-full py-3">
          {loading ? 'Kaydediliyor...' : 'Şifreyi Yenile'}
        </button>
        {!token && <p className="text-sm font-semibold text-red-500">Yenileme bağlantısı eksik veya geçersiz.</p>}
      </form>
    </div>
  )
}
