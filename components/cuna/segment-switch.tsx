'use client'

import { cn } from '@/lib/utils'

export type StatsSegment = 'uci' | 'nursery' | 'todos'

const OPTIONS: { value: StatsSegment; title: string; hint: string }[] = [
  {
    value: 'uci',
    title: 'UCI Neonatal',
    hint: 'Recién nacidos hospitalizados en la unidad (ingresos y egresos de la Pizarra).',
  },
  {
    value: 'nursery',
    title: 'Nursery',
    hint: 'Recién nacidos con estadía normal, sin hospitalización. Se registran igual que un ingreso UCI.',
  },
  {
    value: 'todos',
    title: 'UCI Neonatal + Nursery',
    hint: 'Todos los recién nacidos de la unidad juntos, más el bloque de maternidad del Libro de Partos y Abortos.',
  },
]

export function SegmentSwitch({
  value,
  onChange,
  className,
}: {
  value: StatsSegment
  onChange: (v: StatsSegment) => void
  className?: string
}) {
  const active = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0]
  return (
    <div className={cn('flex flex-col gap-2 print:hidden', className)}>
      <div role="group" aria-label="Qué recién nacidos analizar" className="inline-flex w-full flex-wrap gap-1 rounded-xl bg-muted p-1 sm:w-fit">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-11 flex-1 rounded-lg px-4 text-sm font-semibold transition-all sm:flex-none',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
              value === o.value ? 'bg-card text-navy shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.title}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground text-pretty">{active.hint}</p>
    </div>
  )
}
