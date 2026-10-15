'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ZoomOut } from 'lucide-react'

/** Escala sobre la cual consideramos que el usuario hizo zoom. */
const ZOOM_THRESHOLD = 1.05
/** Inactividad (sin tocar ni desplazar) antes de volver solo a la vista normal. */
const IDLE_RESET_MS = 8000
/** Espera tras salir de un campo de texto con zoom antes de restablecer. */
const BLUR_RESET_MS = 450

type Geometry = {
  scale: number
  left: number
  top: number
  width: number
  height: number
}

const NORMAL: Geometry = { scale: 1, left: 0, top: 0, width: 0, height: 0 }

function isTextField(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true
  if (el instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'button', 'submit', 'range', 'file'].includes(el.type)
  }
  return false
}

/**
 * Los navegadores no permiten volver a escala 1 por API directa.
 * Fijar maximum-scale=1 un instante y restaurar el viewport original
 * obliga a iOS Safari y Chrome Android a recalcular el zoom, sin
 * bloquear permanentemente el zoom del usuario (accesibilidad).
 */
function restoreViewport() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  if (!meta) return
  const original = meta.getAttribute('content') ?? 'width=device-width, initial-scale=1'
  meta.setAttribute('content', 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1')
  window.setTimeout(() => meta.setAttribute('content', original), 160)
}

/**
 * Zoom inteligente para móviles: detecta cuando el usuario amplió con pinch,
 * muestra un aviso discreto y devuelve la app a su responsividad inicial
 * automáticamente (por inactividad, al cambiar de pantalla o al salir de un
 * campo de texto), o al instante con un toque. En escritorio no hace nada.
 */
export function SmartZoom() {
  const pathname = usePathname()
  const [geo, setGeo] = useState<Geometry>(NORMAL)
  const [paused, setPaused] = useState(false)
  const [cycle, setCycle] = useState(0)

  const zoomedRef = useRef(false)
  const pausedRef = useRef(false)
  const touchingRef = useRef(false)
  const idleTimer = useRef<number | undefined>(undefined)
  const blurTimer = useRef<number | undefined>(undefined)
  const frame = useRef<number | undefined>(undefined)

  const clearTimers = useCallback(() => {
    window.clearTimeout(idleTimer.current)
    window.clearTimeout(blurTimer.current)
  }, [])

  const reset = useCallback(() => {
    clearTimers()
    restoreViewport()
  }, [clearTimers])

  const armIdle = useCallback(() => {
    window.clearTimeout(idleTimer.current)
    if (!zoomedRef.current || pausedRef.current) return
    setCycle((c) => c + 1)
    idleTimer.current = window.setTimeout(() => {
      if (touchingRef.current) return armIdle()
      reset()
    }, IDLE_RESET_MS)
  }, [reset])

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv || !window.matchMedia('(pointer: coarse)').matches) return

    const read = () => {
      frame.current = undefined
      const scale = vv.scale
      const zoomed = scale > ZOOM_THRESHOLD
      const wasZoomed = zoomedRef.current
      zoomedRef.current = zoomed

      if (!zoomed) {
        clearTimers()
        if (pausedRef.current) {
          pausedRef.current = false
          setPaused(false)
        }
        setGeo((g) => (g.scale === 1 ? g : NORMAL))
        return
      }

      setGeo({
        scale,
        left: vv.offsetLeft,
        top: vv.offsetTop,
        width: vv.width * scale,
        height: vv.height * scale,
      })
      if (!wasZoomed) armIdle()
    }

    const schedule = () => {
      if (frame.current === undefined) frame.current = window.requestAnimationFrame(read)
    }
    const onActivity = () => {
      schedule()
      armIdle()
    }
    const onTouchStart = (e: TouchEvent) => {
      touchingRef.current = e.touches.length > 0
      window.clearTimeout(idleTimer.current)
    }
    const onTouchEnd = (e: TouchEvent) => {
      touchingRef.current = e.touches.length > 0
      if (!touchingRef.current) {
        schedule()
        armIdle()
      }
    }
    const onFocusOut = (e: FocusEvent) => {
      if (!zoomedRef.current || !isTextField(e.target)) return
      window.clearTimeout(blurTimer.current)
      blurTimer.current = window.setTimeout(() => {
        const active = document.activeElement
        if (!isTextField(active) && zoomedRef.current) reset()
      }, BLUR_RESET_MS)
    }

    vv.addEventListener('resize', onActivity)
    vv.addEventListener('scroll', onActivity)
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    document.addEventListener('touchcancel', onTouchEnd, { passive: true })
    document.addEventListener('focusout', onFocusOut)
    read()

    return () => {
      vv.removeEventListener('resize', onActivity)
      vv.removeEventListener('scroll', onActivity)
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
      document.removeEventListener('focusout', onFocusOut)
      if (frame.current !== undefined) window.cancelAnimationFrame(frame.current)
      clearTimers()
    }
  }, [armIdle, clearTimers, reset])

  // Al navegar a otra pantalla el zoom anterior ya no tiene sentido.
  useEffect(() => {
    if (zoomedRef.current) reset()
  }, [pathname, reset])

  const keepZoom = () => {
    pausedRef.current = true
    setPaused(true)
    clearTimers()
  }

  const showHint = geo.scale > ZOOM_THRESHOLD
  if (!showHint) return null

  const inverse = 1 / geo.scale

  return (
    <div
      className="pointer-events-none fixed z-[70] print:hidden"
      style={{
        left: geo.left,
        top: geo.top,
        width: geo.width,
        height: geo.height,
        transform: `scale(${inverse})`,
        transformOrigin: '0 0',
      }}
    >
      <div
        className="flex h-full items-end justify-center px-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto relative flex max-w-full items-center gap-1 overflow-hidden rounded-full bg-primary py-1.5 pl-4 pr-1.5 text-primary-foreground shadow-lg"
        >
          <span className="text-sm font-medium">Zoom ampliado</span>
          {!paused && (
            <button
              type="button"
              onClick={keepZoom}
              className="min-h-9 rounded-full px-3 text-sm font-medium text-primary-foreground/80 underline-offset-2 hover:underline"
            >
              Mantener
            </button>
          )}
          <button
            type="button"
            onClick={reset}
            className="flex min-h-9 items-center gap-1.5 rounded-full bg-primary-foreground px-3.5 text-sm font-semibold text-primary"
          >
            <ZoomOut className="size-4" aria-hidden="true" />
            Vista normal
          </button>
          {!paused && (
            <span
              key={cycle}
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary-foreground/60"
              style={{ animation: `smart-zoom-countdown ${IDLE_RESET_MS}ms linear forwards` }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
