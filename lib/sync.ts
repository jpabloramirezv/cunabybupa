import { mutate } from 'swr'

const CHANNEL = 'cuna:sync'
const POLL_MS = 6000
const isBrowser = typeof window !== 'undefined'

/**
 * Claves que no se refrescan en automático:
 * - la identificación del paciente: leerla queda en auditoría, así que solo se lee al abrirla;
 * - la lista de personas del ingreso, que no depende de los registros.
 */
const skipKey = (key: unknown) =>
  typeof key !== 'string' || key.includes('/identity') || key === '/api/session/staff'

let channel: BroadcastChannel | null = null
let debounce: ReturnType<typeof setTimeout> | null = null

function getChannel() {
  if (!isBrowser || typeof BroadcastChannel === 'undefined') return null
  channel ??= new BroadcastChannel(CHANNEL)
  return channel
}

/** Vuelve a pedir al servidor todo lo que hay en pantalla (pizarra, turno, panel, administración…). */
export function refreshEverything() {
  return mutate((key) => !skipKey(key))
}

/** Se llama tras cualquier cambio guardado: refresca esta pestaña y avisa a las demás. */
export function notifyChange() {
  if (!isBrowser) return
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => {
    debounce = null
    void refreshEverything()
    getChannel()?.postMessage('changed')
  }, 250)
}

async function readVersion(): Promise<string | null> {
  try {
    const res = await fetch('/api/sync', { credentials: 'same-origin', cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { version?: string }
    return data.version ?? null
  } catch {
    return null
  }
}

/** Mantiene toda la app al día: cambios de otras personas, otros equipos y otras pestañas. */
export function startSync() {
  if (!isBrowser) return () => {}
  let last: string | null = null
  let stopped = false
  let checking = false

  async function check() {
    if (stopped || checking || document.visibilityState === 'hidden') return
    checking = true
    const version = await readVersion()
    checking = false
    if (version === null) return
    if (last !== null && version !== last) void refreshEverything()
    last = version
  }

  const ch = getChannel()
  const onMessage = () => {
    void refreshEverything().then(() => {
      void readVersion().then((v) => {
        if (v !== null) last = v
      })
    })
  }
  ch?.addEventListener('message', onMessage)

  const onWake = () => void check()
  document.addEventListener('visibilitychange', onWake)
  window.addEventListener('focus', onWake)
  window.addEventListener('online', onWake)
  const timer = window.setInterval(onWake, POLL_MS)
  void check()

  return () => {
    stopped = true
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onWake)
    window.removeEventListener('focus', onWake)
    window.removeEventListener('online', onWake)
    ch?.removeEventListener('message', onMessage)
  }
}
