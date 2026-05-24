'use client'

import { useEffect } from 'react'
import { io, type Socket } from 'socket.io-client'
import toast from 'react-hot-toast'
import { SOCKET_URL } from '@/lib/config'
import { ensureAccessToken } from '@/lib/api'
import { useAuthStore } from '@/lib/store'

type IncomingMessageNotification = {
  conversationId?: string
  preview?: string
}

export default function MessageNotifications() {
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    if (!user?.id) return

    let socket: Socket | null = null
    let cancelled = false

    const connect = async () => {
      const token = await ensureAccessToken().catch(() => null)
      if (!token || cancelled) return

      socket = io(SOCKET_URL, {
        auth: { token },
        withCredentials: true,
        transports: ['websocket', 'polling'],
      })

      socket.on('new_conversation_message', (payload: IncomingMessageNotification = {}) => {
        const preview = String(payload.preview || 'Yeni mesajın var.').trim()
        const message = preview.length > 90 ? `${preview.slice(0, 90)}...` : preview

        toast.success(`Yeni mesaj: ${message}`, {
          duration: 5000,
          id: payload.conversationId ? `message-${payload.conversationId}-${message}` : undefined,
        })

        if (
          typeof document !== 'undefined' &&
          document.hidden &&
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted'
        ) {
          new Notification('Satgo yeni mesaj', { body: message })
        }
      })
    }

    connect()

    return () => {
      cancelled = true
      socket?.disconnect()
    }
  }, [user?.id])

  return null
}
