import type { DashPeriod } from '@/lib/server/panel-dashboard'
import type { DashScope } from '@/lib/panel-indicators'

export const fmtPct = (n: number | null) =>
  n === null ? '—' : `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })} %`

export const fmtHours = (n: number | null) =>
  n === null ? '—' : `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })} h`

export const fmtDays = (n: number | null) =>
  n === null ? '—' : `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })} d`

/** Enlace al Libro de Partos con el filtro de una alerta, para pasar de la cifra a los registros. */
export function libroLink(opts: { alerta?: string; q?: string; period?: DashPeriod; scope: DashScope }) {
  const p = new URLSearchParams()
  if (opts.alerta) p.set('alerta', opts.alerta)
  if (opts.q) p.set('q', opts.q)
  if (opts.alerta && opts.alerta !== 'incompleto-24h' && opts.period) {
    p.set('desde', opts.period.from)
    p.set('hasta', opts.period.to)
  }
  p.set('unidad', opts.scope)
  return `/libro?${p.toString()}`
}
