'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, CircleHelp, X } from 'lucide-react'
import { tourSteps, type TourId, type TourStep } from '@/lib/tour-steps'
import { usePref } from '@/lib/use-pref'
import { cn } from '@/lib/utils'

type Rect = { top: number; left: number; width: number; height: number }

const PAD = 8
const GAP = 14
const FIND_TIMEOUT_MS = 3000

function queryTarget(selector?: string): HTMLElement | null {
  if (!selector) return null
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

function readRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect()
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }
}

type Props = {
  tourId: TourId
  /** Identifica a la persona: la guía se abre sola una vez por persona en este equipo. */
  personKey: number | string
}

/** Guía paso a paso: botón "Ver guía" en el encabezado y recorrido sobre los elementos reales de la app. */
export function GuidedTour({ tourId, personKey }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const steps = tourSteps(tourId)
  const [seen, setSeen, ready] = usePref<boolean>(`tour.seen.${tourId}.${personKey}`, false)
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [cardHeight, setCardHeight] = useState(0)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const bodyId = useId()

  const step: TourStep = steps[index]
  const last = index === steps.length - 1

  const start = useCallback(() => {
    setIndex(0)
    setRect(null)
    setOpen(true)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    setRect(null)
    setSeen(true)
    launcherRef.current?.focus()
  }, [setSeen])

  useEffect(() => {
    if (!ready || seen) return
    const t = setTimeout(() => {
      setSeen(true)
      start()
    }, 900)
    return () => clearTimeout(t)
  }, [ready, seen, setSeen, start])

  useEffect(() => {
    if (!open) return
    if (step.route && pathname !== step.route) router.push(step.route)
  }, [open, step.route, pathname, router])

  // Busca el elemento del paso (la página puede estar cargando) y lo mantiene medido al hacer scroll o redimensionar.
  useEffect(() => {
    if (!open) return
    if (pathname !== step.route) {
      setRect(null)
      return
    }
    let cancelled = false
    let el: HTMLElement | null = null
    let raf = 0
    const started = Date.now()

    const measure = () => {
      if (cancelled) return
      if (el && document.contains(el)) {
        const next = readRect(el)
        setRect((prev) =>
          prev && prev.top === next.top && prev.left === next.left && prev.width === next.width && prev.height === next.height
            ? prev
            : next,
        )
      }
      raf = requestAnimationFrame(measure)
    }

    const find = () => {
      if (cancelled) return
      el = queryTarget(step.target)
      if (el) {
        el.scrollIntoView({ block: 'center', inline: 'nearest' })
        measure()
        return
      }
      setRect(null)
      if (step.target && Date.now() - started < FIND_TIMEOUT_MS) setTimeout(find, 150)
    }
    find()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [open, step, pathname])

  useEffect(() => {
    if (!open) return
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [open])

  useLayoutEffect(() => {
    if (open && cardRef.current) setCardHeight(cardRef.current.offsetHeight)
  }, [open, index, rect, viewport.w])

  useEffect(() => {
    if (open) cardRef.current?.focus()
  }, [open, index])

  const next = useCallback(() => {
    if (last) close()
    else setIndex((i) => i + 1)
  }, [last, close])
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      } else if (e.key === 'Tab' && cardRef.current) {
        const items = Array.from(cardRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'))
        if (items.length === 0) return
        const first = items[0]
        const lastItem = items[items.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || active === cardRef.current)) {
          e.preventDefault()
          lastItem.focus()
        } else if (!e.shiftKey && active === lastItem) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close, next, prev])

  const cardWidth = Math.min(380, Math.max(0, viewport.w - 24))
  let cardStyle: React.CSSProperties
  if (rect && viewport.w > 0) {
    const centerX = rect.left + rect.width / 2
    const left = Math.min(Math.max(12, centerX - cardWidth / 2), viewport.w - cardWidth - 12)
    const below = rect.top + rect.height + GAP
    const above = rect.top - GAP - cardHeight
    if (below + cardHeight <= viewport.h - 12) cardStyle = { top: below, left, width: cardWidth }
    else if (above >= 12) cardStyle = { top: above, left, width: cardWidth }
    else cardStyle = { bottom: 12, left, width: cardWidth }
  } else {
    cardStyle = { top: '50%', left: '50%', width: cardWidth || undefined, transform: 'translate(-50%, -50%)' }
  }

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        data-tour="launcher"
        onClick={start}
        className="flex h-11 items-center gap-2 rounded-lg border border-navy-foreground/40 px-4 text-sm font-semibold hover:bg-navy-foreground/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
      >
        <CircleHelp className="size-4" aria-hidden />
        Ver guía
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[200] print:hidden">
              <div className="absolute inset-0" aria-hidden />
              {rect ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute rounded-xl border-2 border-magenta shadow-[0_0_0_100vmax_color-mix(in_oklab,var(--foreground)_60%,transparent)] motion-safe:transition-[top,left,width,height] motion-safe:duration-200"
                  style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
                />
              ) : (
                <div aria-hidden className="pointer-events-none absolute inset-0 bg-foreground/60" />
              )}
              <div
                ref={cardRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={bodyId}
                tabIndex={-1}
                style={cardStyle}
                className="absolute flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xl outline-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground" aria-live="polite">
                    Paso {index + 1} de {steps.length}
                  </p>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Cerrar guía"
                    className="-mr-2 -mt-2 flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                  >
                    <X className="size-5" aria-hidden />
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  <h2 id={titleId} className="text-lg font-bold leading-tight text-balance">
                    {step.title}
                  </h2>
                  <p id={bodyId} className="text-base leading-relaxed text-pretty text-muted-foreground">
                    {step.body}
                  </p>
                </div>
                <div className="flex gap-1" aria-hidden>
                  {steps.map((s, i) => (
                    <span
                      key={s.id}
                      className={cn('h-1.5 flex-1 rounded-full', i <= index ? 'bg-magenta' : 'bg-muted')}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="h-11 rounded-lg px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                  >
                    Omitir
                  </button>
                  <div className="flex items-center gap-2">
                    {index > 0 ? (
                      <button
                        type="button"
                        onClick={prev}
                        className="flex h-11 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-semibold hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                      >
                        <ArrowLeft className="size-4" aria-hidden />
                        Atrás
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={next}
                      className="flex h-11 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
                    >
                      {last ? 'Listo' : 'Siguiente'}
                      {last ? null : <ArrowRight className="size-4" aria-hidden />}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
