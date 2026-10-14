'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import useSWR from 'swr'
import { fetcher, fetcherOrNull } from '@/lib/fetcher'
import {
  draftFor,
  enqueue,
  getOutboxSnapshot,
  getServerOutboxSnapshot,
  hasEntries,
  subscribeOutbox,
  subscribeSaved,
  type OutboxBlock,
} from '@/lib/outbox'
import type {
  CatalogsPayload,
  EpisodeDetail,
  IdentityPayload,
  MePayload,
} from '@/lib/types'

export const useMe = () =>
  useSWR<MePayload>('/api/me', fetcher, { shouldRetryOnError: false, revalidateOnFocus: false })

export const useCatalogs = () =>
  useSWR<CatalogsPayload>('/api/catalogs', fetcher, { revalidateOnFocus: false })

export const useOutbox = () =>
  useSyncExternalStore(subscribeOutbox, getOutboxSnapshot, getServerOutboxSnapshot)

type Overlay = {
  get: <T = unknown>(key: string) => T | null
  set: (block: OutboxBlock, patch: Record<string, unknown>) => void
  local: Record<string, unknown>
}

/**
 * Valores que ve la persona = lo guardado en el servidor + lo escrito que aún no se confirma.
 * Cada cambio entra a la cola de guardado, que reintenta sola si se cae la conexión.
 */
function useOverlay(
  id: string,
  blocks: OutboxBlock[],
  server: Record<string, unknown> | null | undefined,
  revalidate: () => Promise<unknown>,
): Overlay {
  const [local, setLocal] = useState<Record<string, unknown>>({})
  const revalidateRef = useRef(revalidate)
  revalidateRef.current = revalidate
  const blocksKey = blocks.join(',')

  useEffect(() => {
    setLocal(draftFor(id, blocks))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, blocksKey])

  useEffect(
    () =>
      subscribeSaved((keys) => {
        if (!blocks.some((b) => keys.has(`${id}|${b}`))) return
        void revalidateRef.current().then(() => {
          if (!hasEntries(id, blocks)) setLocal({})
        })
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, blocksKey],
  )

  const get = useCallback(
    <T = unknown>(key: string) =>
      (key in local ? local[key] : (server?.[key] ?? null)) as T | null,
    [local, server],
  )
  const set = useCallback(
    (block: OutboxBlock, patch: Record<string, unknown>) => {
      setLocal((l) => ({ ...l, ...patch }))
      enqueue(id, block, patch)
    },
    [id],
  )
  return { get, set, local }
}

export type ScreeningExtraField = 'doneAt2' | 'citedAt' | 'lot' | 'result' | 'preDuctal' | 'postDuctal'

const EXTRA_PREFIX: Record<ScreeningExtraField, string> = {
  doneAt2: 'fecha2',
  citedAt: 'cita',
  lot: 'lote',
  result: 'resultado',
  preDuctal: 'preductal',
  postDuctal: 'postductal',
}

export type EpisodeForm = {
  detail: EpisodeDetail | null | undefined
  loading: boolean
  get: Overlay['get']
  set: Overlay['set']
  /** Estado de un tamizaje, incluyendo lo escrito sin confirmar. */
  screening: (kind: string) => string
  setScreening: (kind: string, status: string) => void
  /** Fecha en que se realizó el tamizaje o la vacuna, incluyendo lo escrito sin confirmar. */
  screeningDate: (kind: string) => string | null
  setScreeningDate: (kind: string, iso: string | null) => void
  /** Datos extra del tamizaje: segunda toma, fecha de cita, lote y resultado. */
  screeningExtra: (kind: string, field: ScreeningExtraField) => string | null
  setScreeningExtra: (kind: string, field: ScreeningExtraField, value: string | null) => void
  refresh: () => Promise<unknown>
}

export function useEpisodeForm(id: string): EpisodeForm {
  const { data, mutate, isLoading } = useSWR<EpisodeDetail | null>(
    `/api/episodes/${id}`,
    fetcherOrNull,
    { revalidateOnFocus: true },
  )
  const refresh = useCallback(() => mutate(), [mutate])
  const { get, set, local } = useOverlay(
    id,
    ['ingreso', 'seguimiento', 'alta'],
    data as unknown as Record<string, unknown> | null | undefined,
    refresh,
  )
  const scr = useOverlay(id, ['tamizaje'], null, refresh)

  const screening = useCallback(
    (kind: string) => {
      if (kind in scr.local) return String(scr.local[kind])
      return data?.screenings.find((s) => s.kind === kind)?.status ?? 'pendiente'
    },
    [data, scr.local],
  )
  const setScreening = useCallback(
    (kind: string, status: string) => scr.set('tamizaje', { [kind]: status }),
    [scr],
  )
  const screeningDate = useCallback(
    (kind: string) => {
      const key = `fecha:${kind}`
      if (key in scr.local) return (scr.local[key] as string | null) || null
      return data?.screenings.find((s) => s.kind === kind)?.doneAt ?? null
    },
    [data, scr.local],
  )
  const setScreeningDate = useCallback(
    (kind: string, iso: string | null) => scr.set('tamizaje', { [`fecha:${kind}`]: iso }),
    [scr],
  )
  const screeningExtra = useCallback(
    (kind: string, field: ScreeningExtraField) => {
      const key = `${EXTRA_PREFIX[field]}:${kind}`
      if (key in scr.local) {
        const v = scr.local[key]
        return v === null || v === undefined || v === '' ? null : String(v)
      }
      const row = data?.screenings.find((s) => s.kind === kind)
      const v = row?.[field]
      return v === null || v === undefined ? null : String(v)
    },
    [data, scr.local],
  )
  const setScreeningExtra = useCallback(
    (kind: string, field: ScreeningExtraField, value: string | null) =>
      scr.set('tamizaje', { [`${EXTRA_PREFIX[field]}:${kind}`]: value }),
    [scr],
  )
  void local
  return {
    screeningExtra,
    setScreeningExtra,
    detail: data,
    loading: isLoading,
    get,
    set,
    screening,
    setScreening,
    screeningDate,
    setScreeningDate,
    refresh,
  }
}

export type IdentityForm = {
  get: Overlay['get']
  set: (patch: Record<string, unknown>) => void
  data: IdentityPayload | undefined
  loading: boolean
}

export function useIdentityForm(id: string, enabled: boolean): IdentityForm {
  const { data, mutate, isLoading } = useSWR<IdentityPayload>(
    enabled ? `/api/episodes/${id}/identity` : null,
    fetcher,
    { revalidateOnFocus: false },
  )
  const refresh = useCallback(() => mutate(), [mutate])
  const { get, set } = useOverlay(
    id,
    ['identidad'],
    data as unknown as Record<string, unknown> | undefined,
    refresh,
  )
  const setIdentity = useCallback((patch: Record<string, unknown>) => set('identidad', patch), [set])
  return { get, set: setIdentity, data, loading: isLoading }
}
