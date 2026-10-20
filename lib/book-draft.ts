const KEY = 'cuna:book-draft:v1'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type StoredBookDraft<T> = {
  staffId: number
  savedAt: number
  section: string
  original: Record<string, string>
  originalEpisode: string | null
  draft: T
}

const hasStorage = () => typeof window !== 'undefined'

/** Guarda en el equipo el registro del libro que se está escribiendo, para sobrevivir a cortes de luz o cierres de pestaña. */
export function saveBookDraft<T>(entry: Omit<StoredBookDraft<T>, 'savedAt'>) {
  if (!hasStorage()) return
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...entry, savedAt: Date.now() }))
  } catch {
    // Sin espacio o almacenamiento bloqueado: el borrador sigue en pantalla.
  }
}

export function loadBookDraft<T>(staffId: number): StoredBookDraft<T> | null {
  if (!hasStorage()) return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as StoredBookDraft<T>
    if (stored.staffId !== staffId || Date.now() - stored.savedAt > MAX_AGE_MS) return null
    return stored
  } catch {
    return null
  }
}

export function clearBookDraft() {
  if (!hasStorage()) return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // Nada que limpiar.
  }
}
