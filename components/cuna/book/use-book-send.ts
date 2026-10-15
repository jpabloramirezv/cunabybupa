'use client'

import { useCallback, useState } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import { useMe } from '@/lib/hooks'

export type BookSend = {
  /** id del ingreso -> id de su fila en el libro. */
  sent: Record<string, string>
  sending: string | null
  error: string | null
  send: (episodeId: string) => Promise<void>
  pendingCount: (ids: string[]) => number
}

/** Estado y acción de "Enviar al libro" para perfiles que pueden completar la parte neonatal. */
export function useBookSend(): BookSend | null {
  const { data: me } = useMe()
  const enabled = !!me?.canBook && !!me.canEditNeonatal
  const { data, mutate } = useSWR<{ sent: Record<string, string> }>(enabled ? '/api/book/send' : null, fetcher, {
    revalidateOnFocus: true,
  })
  const [sending, setSending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const send = useCallback(
    async (episodeId: string) => {
      setSending(episodeId)
      setError(null)
      try {
        const res = await fetch('/api/book/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ episodeId }),
        })
        const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string }
        if (!res.ok || !body.id) throw new Error(body.error ?? 'No pudimos enviarlo al libro. Intenta de nuevo.')
        await mutate((cur) => ({ sent: { ...(cur?.sent ?? {}), [episodeId]: body.id! } }), { revalidate: false })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No pudimos enviarlo al libro.')
      } finally {
        setSending(null)
      }
    },
    [mutate],
  )

  if (!enabled) return null
  const sent = data?.sent ?? {}
  return { sent, sending, error, send, pendingCount: (ids) => ids.filter((id) => !sent[id]).length }
}
