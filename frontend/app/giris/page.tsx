'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/lib/store'

export default function GirisPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] px-4 py-8" />}>
      <GirisContent />
    </Suspense>
  )
}

function GirisContent() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const { login, register, loading } = useAuthStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' })

  const rawNextPath = searchParams.get('next') || '/'
  const nextPath = rawNextPath.startsWith('/') && !rawNextPath.startsWith('//') ? rawNextPath : '/'

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: e.target.value }))

  const getErrorMessage = (err: any, fallback: string) => {
    const fromValidation = err?.response?.data?.errors?.map((e: any) => e.message).filter(Boolean).join('\n')
    const fromBody = err?.response?.data?.message
    if (fromValidation) return fromValidation
    if (fromBody) return fromBody
    const code = err?.code
    if (code === 'ECONNABORTED' || err?.message?.includes?.('timeout')) {
      return 'Sunucuya bağlanırken zaman aşımı oluştu. İnternet bağlantınızı kontrol edin.'
    }
    if (err?.message === 'Network Error') {
      return 'Ağ hatası: API adresine erişilemiyor. Tarayıcı konsolunda engellenen istek var mı kontrol edin.'
    }
    return fallback
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(form.email.trim(), form.password)
      toast.success('Giriş başarılı')
      router.push(nextPath)
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Giriş başarısız'))
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
      })
      toast.success('Kayıt başarılı')
      router.push(nextPath)
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Kayıt başarısız'))
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center justify-center">
            <span className="text-5xl font-black lowercase tracking-tight text-brand leading-none">satgo</span>
          </Link>
          <p className="text-gray-500 text-sm mt-2">Türkiye'nin ilan platformu</p>
        </div>

        <div className="card overflow-hidden">
          <div className="flex border-b border-gray-100">
            <button
              type="button"
              onClick={() => setTab('login')}
              className={`flex-1 py-3.5 text-sm font-bold transition-colors ${
                tab === 'login' ? 'text-brand border-b-2 border-brand' : 'text-gray-500'
              }`}
            >
              Giriş Yap
            </button>
            <button
              type="button"
              onClick={() => setTab('register')}
              className={`flex-1 py-3.5 text-sm font-bold transition-colors ${
                tab === 'register' ? 'text-brand border-b-2 border-brand' : 'text-gray-500'
              }`}
            >
              Üye Ol
            </button>
          </div>

          <div className="p-6">
            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="label">E-posta</label>
                  <input type="email" value={form.email} onChange={set('email')} required placeholder="ornek@mail.com" className="input" />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="label !mb-0">Şifre</label>
                    <Link href="/sifremi-unuttum" className="text-xs font-bold text-brand hover:underline">
                      Şifremi unuttum
                    </Link>
                  </div>
                  <input type="password" value={form.password} onChange={set('password')} required placeholder="En az 6 karakter" className="input" />
                </div>
                <button type="submit" disabled={loading} className="btn-brand w-full py-3">
                  {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="label">Ad Soyad</label>
                  <input type="text" value={form.name} onChange={set('name')} required minLength={2} placeholder="Adınız Soyadınız" className="input" />
                </div>
                <div>
                  <label className="label">E-posta</label>
                  <input type="email" value={form.email} onChange={set('email')} required placeholder="ornek@mail.com" className="input" />
                </div>
                <div>
                  <label className="label">Telefon</label>
                  <input type="tel" value={form.phone} onChange={set('phone')} placeholder="İsteğe bağlı" className="input" />
                </div>
                <div>
                  <label className="label">Şifre</label>
                  <input type="password" value={form.password} onChange={set('password')} required minLength={6} placeholder="En az 6 karakter" className="input" />
                </div>
                <button type="submit" disabled={loading} className="btn-brand w-full py-3">
                  {loading ? 'Kaydediliyor...' : 'Üye Ol'}
                </button>
                <p className="text-xs leading-5 text-gray-400">
                  Üye olarak <Link href="/kosullar" className="font-bold text-brand">Kullanım Koşulları</Link>,{' '}
                  <Link href="/kvkk" className="font-bold text-brand">KVKK Aydınlatma Metni</Link> ve{' '}
                  <Link href="/gizlilik" className="font-bold text-brand">Gizlilik Politikası</Link> metinlerini kabul etmiş olursun.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
