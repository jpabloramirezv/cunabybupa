'use client'

import { useCallback, useState } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import { useMe } from '@/lib/hooks'

export type SendResult = {
  id: string
  code: string
  mode: 'new' | 'linked' | 'existing'
}

export type BookSend = {
  /** id del ingreso -> id de su fila en el libro. */
  sent: Record<string, string>
  /** Ingreso para el que está abierta la confirmación (null = cerrada). */
  target: string | null
  sending: boolean
  error: string | null
  result: SendResult | null
  /** Abre la confirmación: propone fila nueva o incorporar a una existente. */
  open: (episodeId: string) => void
  close: () => void
  /** Confirma el envío: fila nueva (recordId null) o incorporar a una fila existente. */
  confirm: (recordId: string | null) => Promise<void>
  pendingCount: (ids: string[]) => number
}

/** Estado y acciones de "Enviar al libro" para perfiles que pueden completar la parte neonatal. */
export function useBookSend(): BookSend | null {
  const { data: me } = useMe()
  const enabled = !!me?.canBook && !!me.canEditNeonatal
  const { data, mutate } = useSWR<{ sent: Record<string, string> }>(enabled ? '/api/book/send' : null, fetcher, {
    revalidateOnFocus: true,
  })
  const [target, setTarget] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SendResult | null>(null)

  const open = useCallback((episodeId: string) => {
    setTarget(episodeId)
    setError(null)
    setResult(null)
  }, [])

  const close = useCallback(() => {
    setTarget(null)
    setError(null)
    setResult(null)
  }, [])

  const confirm = useCallback(
    async (recordId: string | null) => {
      if (!target) return
      setSending(true)
      setError(null)
      try {
        const res = await fetch('/api/book/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ episodeId: target, recordId }),
        })
        const body = (await res.json().catch(() => ({}))) as Partial<SendResult> & { error?: string }
        if (!res.ok || !body.id) throw new Error(body.error ?? 'No pudimos enviarlo al libro. Intenta de nuevo.')
        await mutate((cur) => ({ sent: { ...(cur?.sent ?? {}), [target]: body.id! } }), { revalidate: false })
        setResult({ id: body.id, code: body.code ?? '', mode: body.mode ?? 'new' })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No pudimos enviarlo al libro.')
      } finally {
        setSending(false)
      }
    },
    [mutate, target],
  )

  if (!enabled) return null
  const sent = data?.sent ?? {}
  return {
    sent,
    target,
    sending,
    error,
    result,
    open,
    close,
    confirm,
    pendingCount: (ids) => ids.filter((id) => !sent[id]).length,
  }
}
