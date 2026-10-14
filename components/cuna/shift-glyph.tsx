import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Sol para turno de día, luna para turno de noche. Siempre acompañado de texto, nunca solo. */
export function ShiftGlyph({ kind, className }: { kind: 'D' | 'N'; className?: string }) {
  const Icon = kind === 'D' ? Sun : Moon
  return (
    <Icon
      aria-hidden
      className={cn('size-4 shrink-0', kind === 'D' ? 'text-warning-foreground' : 'text-primary', className)}
    />
  )
}

export const shiftKindOf = (key?: string | null): 'D' | 'N' | null =>
  key?.endsWith('-D') ? 'D' : key?.endsWith('-N') ? 'N' : null

export const SHIFT_HOURS = { D: '08:00 – 20:00', N: '20:00 – 08:00' } as const
