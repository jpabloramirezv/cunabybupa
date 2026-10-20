'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Baby, HeartPulse, Plus, Stethoscope } from 'lucide-react'
import { PrimaryButton } from '@/components/cuna/ui'

/** Pregunta primero si el registro es de Maternidad o de Neonatología; Neonatología sigue el flujo de siempre. */
export function NewEntryButton({
  canNeonatal,
  canNursery,
  canMaternity,
  onNeonatal,
}: {
  canNeonatal: boolean
  canNursery: boolean
  canMaternity: boolean
  onNeonatal: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  // El menú se dibuja en el body para que ningún buscador ni barra fija lo tape.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = ref.current?.getBoundingClientRect()
      if (r) setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  const items = [
    {
      key: 'neo',
      title: 'Nuevo ingreso a UPC',
      hint: 'RN hospitalizado en la unidad. Parte desde su fila del Libro de Partos o por traslado, y va a la Pizarra.',
      Icon: Baby,
      enabled: canNeonatal,
      run: onNeonatal,
    },
    {
      key: 'nursery',
      title: 'Nuevo ingreso a Nursery',
      hint: 'RN con estadía normal. Elige su fila del Libro de Partos y completa los datos neonatales en el mismo formulario del libro.',
      Icon: Stethoscope,
      enabled: canNursery,
      run: () => router.push('/libro?nuevo=neo'),
    },
    {
      key: 'mat',
      title: 'Parto o aborto (Maternidad)',
      hint: 'Datos de la madre al llegar a la clínica. Si Neonatología ya empezó la fila, podrás continuarla.',
      Icon: HeartPulse,
      enabled: canMaternity,
      run: () => router.push('/libro?nuevo=1'),
    },
  ]

  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      <PrimaryButton
        variant="accent"
        data-tour="new-entry"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-full sm:w-auto"
      >
        <Plus className="size-5" aria-hidden />
        Nuevo registro
      </PrimaryButton>
      {open && pos
        ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label="¿Qué tipo de registro es?"
          style={{ top: pos.top, right: pos.right }}
          className="fixed z-[100] flex w-[min(20rem,calc(100vw-1rem))] flex-col gap-1 rounded-xl border border-border bg-card p-2 shadow-xl"
        >
          <p className="px-3 pb-1 pt-2 text-sm font-semibold text-foreground">¿Qué tipo de registro es?</p>
          {items.map(({ key, title, hint, Icon, enabled, run }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              disabled={!enabled}
              onClick={() => {
                setOpen(false)
                run()
              }}
              className="flex items-start gap-3 rounded-lg p-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <span className="flex flex-col">
                <span className="text-base font-semibold text-foreground">{title}</span>
                <span className="text-sm text-muted-foreground text-pretty">
                  {enabled ? hint : 'Tu perfil no puede crear este tipo de registro.'}
                </span>
              </span>
            </button>
          ))}
        </div>,
        document.body,
      )
        : null}
    </div>
  )
}
