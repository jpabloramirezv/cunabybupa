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
const UNITS_KEY = 'cuna:outbox:units:v1'
/**
 * Bloques que se respaldan solo en sessionStorage (se pierden al cerrar la pestaña).
 * Está vacío a propósito: un corte de luz o un cierre de pestaña no debe perder datos ya escritos, ni siquiera
 * los de identificación. La cola se vacía sola al confirmarse en el servidor y al cerrar la sesión.
 */
const SESSION_ONLY: OutboxBlock[] = []

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
let timerDue = 0
let editedWhileFlushing = false

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
  if (flushing) editedWhileFlushing = true
  persist()
  notify()
  scheduleFlush()
}

/**
 * Programa un guardado. Si ya hay uno más próximo no lo posterga: así, aunque la persona escriba sin parar,
 * el servidor recibe los cambios cada pocos cientos de milisegundos y no solo cuando se detiene.
 */
export function scheduleFlush(delay = 300) {
  if (!isBrowser) return
  const due = Date.now() + delay
  if (timer && timerDue <= due) return
  if (timer) clearTimeout(timer)
  timerDue = due
  timer = setTimeout(() => {
    timer = null
    void flush()
  }, delay)
}

export function clearOutbox() {
  entries = []
  errors = {}
  newUnits.clear()
  persistUnits()
  persist()
  notify()
}

/**
 * Unidad elegida al abrir un registro nuevo; se envía solo en el primer guardado y el servidor la fija al crear.
 * Se respalda en el equipo para que un registro recuperado tras una recarga no cambie de unidad.
 */
const newUnits = new Map<string, 'uci' | 'nursery'>(loadUnits())

function loadUnits(): [string, 'uci' | 'nursery'][] {
  if (!isBrowser) return []
  try {
    const raw = window.localStorage.getItem(UNITS_KEY)
    return raw ? (JSON.parse(raw) as [string, 'uci' | 'nursery'][]) : []
  } catch {
    return []
  }
}

function persistUnits() {
  if (!isBrowser) return
  try {
    if (newUnits.size === 0) window.localStorage.removeItem(UNITS_KEY)
    else window.localStorage.setItem(UNITS_KEY, JSON.stringify([...newUnits]))
  } catch {
    // Sin almacenamiento: la unidad queda solo en memoria.
  }
}

export function setNewEpisodeUnit(id: string, unit: 'uci' | 'nursery') {
  newUnits.set(id, unit)
  persistUnits()
}

function sendEntry(e: Entry, patch: Record<string, unknown>, keepalive = false) {
  const base = `/api/episodes/${e.id}`
  const reason = getEditReason(e.id)
  const why = reason ? { reason } : {}
  const unit = newUnits.has(e.id) ? { unit: newUnits.get(e.id) } : {}
  const opts = keepalive ? { keepalive: true } : undefined
  switch (e.block) {
    case 'identidad':
      return send(`${base}/identity`, 'PATCH', { ...patch, ...why, ...unit }, opts)
    case 'tamizaje':
      return send(`${base}/screening`, 'PATCH', { ...patch, ...why }, opts)
    default:
      return send(base, 'PATCH', { block: e.block, patch, ...why, ...unit }, opts)
  }
}

/** Quita de la cola lo que el servidor ya confirmó, conservando lo que se siguió escribiendo mientras tanto. */
function applySaved(e: Entry, sent: Record<string, unknown>) {
  for (const k of Object.keys(sent)) {
    if (e.patch[k] === sent[k]) delete e.patch[k]
  }
  if (Object.keys(e.patch).length === 0) entries = entries.filter((x) => x !== e)
}

/**
 * Último intento al ocultarse o cerrarse la pestaña: todo lo pendiente sale en paralelo con keepalive,
 * que el navegador termina de enviar aunque la página ya no exista. Lo que no se confirme sigue
 * respaldado en el equipo y se reenvía al volver a abrir.
 */
function flushOnExit() {
  if (entries.length === 0 || unauthorized) return
  for (const e of [...entries]) {
    const sent = { ...e.patch }
    sendEntry(e, sent, true)
      .then(() => {
        applySaved(e, sent)
        persist()
        notify()
        for (const cb of savedListeners) cb(new Set([`${e.id}|${e.block}`]))
      })
      .catch(() => {})
  }
}

/** Incorpora lo que otra pestaña dejó en la cola, para que escribir en dos pestañas no se pisen entre sí. */
function mergeFromStorage() {
  let changed = false
  for (const other of readStore(window.localStorage)) {
    const mine = entries.find((x) => x.id === other.id && x.block === other.block)
    if (!mine) {
      entries.push(other)
      changed = true
      continue
    }
    for (const [k, v] of Object.entries(other.patch)) {
      if (!(k in mine.patch)) {
        mine.patch[k] = v
        changed = true
      }
    }
  }
  if (!changed) return
  persist()
  notify()
  scheduleFlush()
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
        applySaved(e, sent)
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
    } else if (editedWhileFlushing && entries.length > 0 && !unauthorized) {
      // Lo escrito durante el envío no debe esperar al siguiente ciclo largo.
      scheduleFlush()
    }
    editedWhileFlushing = false
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
    if (document.visibilityState === 'hidden') flushOnExit()
    else if (entries.length > 0) void flush()
  })
  window.addEventListener('pagehide', flushOnExit)
  window.addEventListener('storage', (ev) => {
    if (ev.key === STORAGE_KEY) mergeFromStorage()
  })
  // Pide al navegador que no borre este respaldo si el equipo se queda sin espacio.
  void navigator.storage?.persist?.().catch(() => {})
  if (entries.length > 0) scheduleFlush(800)
  window.setInterval(() => {
    if (entries.length > 0) void flush()
  }, 5000)
}
