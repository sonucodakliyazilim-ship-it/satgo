'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { messagesApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { MessageCircle, Send } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MessagesPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [conversations, setConversations] = useState<any[]>([])
  const [active, setActive] = useState<any | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    messagesApi
      .getConversations()
      .then(({ data }) => {
        setConversations(data.data)
        setActive(data.data[0] || null)
      })
      .catch(() => setConversations([]))
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    if (!active) return
    messagesApi.getMessages(active.id).then(({ data }) => setMessages(data.data)).catch(() => setMessages([]))
  }, [active])

  const send = async () => {
    if (!active || !text.trim()) return
    try {
      await messagesApi.send({ conversation_id: active.id, content: text.trim() })
      setText('')
      const { data } = await messagesApi.getMessages(active.id)
      setMessages(data.data)
      toast.success('Mesaj gönderildi')
    } catch {
      toast.error('Mesaj gönderilemedi')
    }
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="card p-8 text-center">
          <MessageCircle className="w-10 h-10 mx-auto text-brand mb-3" />
          <h1 className="text-xl font-black">Mesajlar için giriş yap</h1>
          <button onClick={() => router.push('/giris')} className="btn-brand mt-5">
            Giriş Yap
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="card overflow-hidden grid md:grid-cols-[320px_1fr] min-h-[560px]">
        <aside className="border-r border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h1 className="text-lg font-black">Mesajlar</h1>
          </div>
          {loading ? (
            <div className="p-4 text-sm text-gray-500">Yükleniyor...</div>
          ) : conversations.length ? (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActive(c)}
                className={`w-full text-left p-4 border-b border-gray-50 hover:bg-gray-50 ${active?.id === c.id ? 'bg-brand-light' : ''}`}
              >
                <p className="font-bold text-sm truncate">{c.other_name}</p>
                <p className="text-xs text-gray-500 truncate">{c.listing_title}</p>
                <p className="text-xs text-gray-400 truncate mt-1">{c.last_message || 'Henüz mesaj yok'}</p>
              </button>
            ))
          ) : (
            <div className="p-8 text-center text-gray-400 text-sm">Henüz mesaj yok.</div>
          )}
        </aside>

        <section className="flex flex-col">
          {active ? (
            <>
              <div className="p-4 border-b border-gray-100">
                <p className="font-bold">{active.other_name}</p>
                <p className="text-xs text-gray-500">{active.listing_title}</p>
              </div>
              <div className="flex-1 p-4 space-y-2 overflow-y-auto bg-gray-50">
                {messages.map((m) => {
                  const mine = m.sender_id === user.id
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-brand text-white' : 'bg-white border border-gray-100'}`}>
                        {m.content}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="p-3 border-t border-gray-100 flex gap-2">
                <input value={text} onChange={(e) => setText(e.target.value)} className="input" placeholder="Mesaj yaz..." />
                <button onClick={send} className="btn-brand px-4" aria-label="Gönder">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">Bir konuşma seç.</div>
          )}
        </section>
      </div>
    </div>
  )
}
