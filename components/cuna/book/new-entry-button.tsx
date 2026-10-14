'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Baby, HeartPulse, Plus } from 'lucide-react'
import { PrimaryButton } from '@/components/cuna/ui'

/** Pregunta primero si el registro es de Maternidad o de Neonatología; Neonatología sigue el flujo de siempre. */
export function NewEntryButton({
  canNeonatal,
  canMaternity,
  onNeonatal,
}: {
  canNeonatal: boolean
  canMaternity: boolean
  onNeonatal: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
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
      title: 'Neonatología (UCI)',
      hint: 'Ingreso o egreso de un recién nacido hospitalizado.',
      Icon: Baby,
      enabled: canNeonatal,
      run: onNeonatal,
    },
    {
      key: 'mat',
      title: 'Maternidad',
      hint: 'Fila del Libro de Partos y Abortos.',
      Icon: HeartPulse,
      enabled: canMaternity,
      run: () => router.push('/libro?nuevo=1'),
    },
  ]

  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      <PrimaryButton
        variant="accent"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-full sm:w-auto"
      >
        <Plus className="size-5" aria-hidden />
        Nuevo registro
      </PrimaryButton>
      {open ? (
        <div
          role="menu"
          aria-label="¿Qué tipo de registro es?"
          className="absolute right-0 z-20 mt-2 flex w-full min-w-72 flex-col gap-1 rounded-xl border border-border bg-card p-2 shadow-lg sm:w-80"
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
        </div>
      ) : null}
    </div>
  )
}
