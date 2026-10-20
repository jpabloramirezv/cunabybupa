import { notifyChange } from '@/lib/sync'

export class ApiError extends Error {
  status: number
  data: Record<string, unknown>
  constructor(status: number, message: string, data: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.data = data
  }
}

const SEND_TIMEOUT_MS = 20_000

async function parse(res: Response) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(
      res.status,
      (data as { error?: string }).error ?? 'No pudimos completar la acción.',
      data as Record<string, unknown>,
    )
  }
  return data
}

export async function fetcher<T = unknown>(url: string): Promise<T> {
  return parse(await fetch(url, { credentials: 'same-origin' })) as Promise<T>
}

/** Como fetcher, pero un 404 devuelve null (registro que aún no existe en el servidor). */
export async function fetcherOrNull<T = unknown>(url: string): Promise<T | null> {
  const res = await fetch(url, { credentials: 'same-origin' })
  if (res.status === 404) return null
  return parse(res) as Promise<T>
}

export async function send<T = unknown>(
  url: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body?: unknown,
  options?: { keepalive?: boolean },
): Promise<T> {
  // Con red lenta una petición colgada bloquearía toda la cola de guardado: se corta y se reintenta.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      // Permite que la petición termine aunque la pestaña se cierre en ese instante.
      keepalive: options?.keepalive ?? false,
    })
  } finally {
    clearTimeout(timer)
  }
  const data = (await parse(res)) as T
  if (!url.startsWith('/api/session/')) notifyChange()
  return data
}
