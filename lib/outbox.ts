'use client'

import { ApiError, send } from '@/lib/fetcher'
import { getEditReason } from '@/lib/edit-reason'

export type OutboxBlock = 'ingreso' | 'seguimiento' | 'alta' | 'identidad' | 'tamizaje'

type Entry = { id: string; block: OutboxBlock; patch: Record<string, unknown> }

export type OutboxSnapshot = {
  pending: number
  flushing: boolean
  offline: boolean
  unauthorized: boolean
  errors: Record<string, string>
}

const STORAGE_KEY = 'cuna:outbox:v1'
/**
 * Los datos de identificación del paciente nunca van al almacenamiento duradero del navegador.
 * Sí se respaldan en sessionStorage (solo esa pestaña, se borra al cerrarla y al sincronizar), de modo
 * que una recarga o caída de la página no pierda lo escrito.
 */
const SESSION_ONLY: OutboxBlock[] = ['identidad']

const isBrowser = typeof window !== 'undefined'

function readStore(store: Storage | undefined): Entry[] {
  try {
    const raw = store?.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Entry[]) : []
  } catch {
    return []
  }
}

function load(): Entry[] {
  if (!isBrowser) return []
  return [...readStore(window.localStorage), ...readStore(window.sessionStorage)]
}

function writeStore(store: Storage, list: Entry[]) {
  try {
    if (list.length === 0) store.removeItem(STORAGE_KEY)
    else store.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // Sin espacio o almacenamiento bloqueado: la cola sigue en memoria.
  }
}

let entries: Entry[] = load()
let flushing = false
let offline = isBrowser ? !navigator.onLine : false
let unauthorized = false
let errors: Record<string, string> = {}
let failures = 0
let snapshot: OutboxSnapshot = build()
const listeners = new Set<() => void>()
const savedListeners = new Set<(keys: Set<string>) => void>()
let timer: ReturnType<typeof setTimeout> | null = null

function build(): OutboxSnapshot {
  return { pending: entries.length, flushing, offline, unauthorized, errors }
}

function persist() {
  if (!isBrowser) return
  writeStore(
    window.localStorage,
    entries.filter((e) => !SESSION_ONLY.includes(e.block)),
  )
  writeStore(
    window.sessionStorage,
    entries.filter((e) => SESSION_ONLY.includes(e.block)),
  )
}

/** Un error del servidor o de capacidad es transitorio: el dato se conserva y se reintenta. */
const isTransient = (status: number) => status >= 500 || status === 408 || status === 429

function notify() {
  snapshot = build()
  for (const l of listeners) l()
}

export const subscribeOutbox = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
export const getOutboxSnapshot = () => snapshot
export const getServerOutboxSnapshot: () => OutboxSnapshot = () => EMPTY
const EMPTY: OutboxSnapshot = {
  pending: 0,
  flushing: false,
  offline: false,
  unauthorized: false,
  errors: {},
}

export function subscribeSaved(cb: (keys: Set<string>) => void) {
  savedListeners.add(cb)
  return () => {
    savedListeners.delete(cb)
  }
}

export const hasEntries = (id: string, blocks: OutboxBlock[]) =>
  entries.some((e) => e.id === id && blocks.includes(e.block))

export function draftFor(id: string, blocks: OutboxBlock[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const e of entries) {
    if (e.id === id && blocks.includes(e.block)) Object.assign(out, e.patch)
  }
  return out
}

export function enqueue(id: string, block: OutboxBlock, patch: Record<string, unknown>) {
  const existing = entries.find((e) => e.id === id && e.block === block)
  if (existing) Object.assign(existing.patch, patch)
  else entries.push({ id, block, patch: { ...patch } })
  if (errors[id]) {
    errors = { ...errors }
    delete errors[id]
  }
  persist()
  notify()
  scheduleFlush()
}

export function scheduleFlush(delay = 450) {
  if (!isBrowser) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void flush()
  }, delay)
}

export function clearOutbox() {
  entries = []
  errors = {}
  persist()
  notify()
}

function sendEntry(e: Entry, patch: Record<string, unknown>) {
  const base = `/api/episodes/${e.id}`
  const reason = getEditReason(e.id)
  const why = reason ? { reason } : {}
  switch (e.block) {
    case 'identidad':
      return send(`${base}/identity`, 'PATCH', { ...patch, ...why })
    case 'tamizaje':
      return send(`${base}/screening`, 'PATCH', { ...patch, ...why })
    default:
      return send(base, 'PATCH', { block: e.block, patch, ...why })
  }
}

export async function flush() {
  if (flushing || entries.length === 0) return
  flushing = true
  notify()
  const saved = new Set<string>()
  try {
    for (const e of [...entries]) {
      const sent = { ...e.patch }
      try {
        await sendEntry(e, sent)
        for (const k of Object.keys(sent)) {
          if (e.patch[k] === sent[k]) delete e.patch[k]
        }
        if (Object.keys(e.patch).length === 0) entries = entries.filter((x) => x !== e)
        saved.add(`${e.id}|${e.block}`)
        offline = false
        unauthorized = false
        failures = 0
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 401) {
            unauthorized = true
            break
          }
          if (isTransient(err.status)) {
            offline = true
            failures += 1
            break
          }
          // Aún no existe el ingreso en el servidor: se reintenta después.
          if (err.status === 404 && e.block !== 'ingreso') continue
          entries = entries.filter((x) => x !== e)
          errors = { ...errors, [e.id]: err.message }
        } else {
          offline = true
          failures += 1
          break
        }
      }
    }
  } finally {
    flushing = false
    persist()
    notify()
    if (saved.size) for (const cb of savedListeners) cb(saved)
    if (offline && entries.length > 0 && !unauthorized) {
      scheduleFlush(Math.min(2000 * 2 ** Math.max(failures - 1, 0), 30000))
    }
  }
}

if (isBrowser) {
  window.addEventListener('online', () => {
    offline = false
    notify()
    void flush()
  })
  window.addEventListener('offline', () => {
    offline = true
    notify()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && entries.length > 0) void flush()
  })
  if (entries.length > 0) scheduleFlush(1500)
  window.setInterval(() => {
    if (entries.length > 0) void flush()
  }, 15000)
}
