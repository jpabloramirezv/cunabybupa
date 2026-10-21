import { SEGMENT_LABEL, linkCode, type BookSegment, type SectionProgress } from '@/lib/book-flow'
import type { BookFieldRow, BookRecordOut } from '@/lib/server/book'
import { ymdInSantiago } from '@/lib/time'

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/

const WEEKDAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const WEEKDAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const PROGRESS_TEXT: Record<SectionProgress['state'], string> = {
  completo: 'completa completo',
  en_curso: 'en curso',
  pendiente: 'pendiente falta',
}

/** Variantes con que una persona escribiría una fecha ISO: 20-10-2026, 20/10/2026, 20 octubre, etc. */
function dateVariants(ymd: string) {
  const m = YMD.exec(ymd)
  if (!m) return [ymd]
  const [, y, mo, d] = m
  const month = MONTHS[Number(mo) - 1] ?? ''
  const wd = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))).getUTCDay()
  return [
    `${d}-${mo}-${y}`,
    `${d}/${mo}/${y}`,
    `${d}.${mo}.${y}`,
    ymd,
    `${Number(d)} ${month} ${y}`,
    `${Number(d)} de ${month} de ${y}`,
    `${d}-${mo}`,
    month,
    WEEKDAYS_LONG[wd],
    WEEKDAYS_SHORT[wd],
  ]
}

/**
 * Todo lo que una persona puede ver en una fila del Libro, en un solo texto para el buscador:
 * cada columna con el formato en que se muestra, la fecha y el día de la semana, el tipo, los códigos y el equipo.
 */
export function bookRowSearchText(
  r: BookRecordOut,
  fields: BookFieldRow[],
  seg: BookSegment,
  mat: SectionProgress,
  neo: SectionProgress,
) {
  const parts: string[] = []

  for (const f of fields) {
    const v = r.values[f.key]
    if (!v) continue
    parts.push(v)
    if (f.type === 'date') parts.push(...dateVariants(v))
  }
  for (const v of Object.values(r.values)) if (v) parts.push(v)

  const ownDate = r.values.fecha ?? ''
  parts.push(...dateVariants(YMD.test(ownDate) ? ownDate : ymdInSantiago(r.createdAt)))

  parts.push(
    SEGMENT_LABEL[seg],
    linkCode(r.seq),
    String(r.n),
    `n ${r.n}`,
    r.episodeCode ?? '',
    r.createdByName ?? '',
    r.updatedByName ?? '',
    `maternidad ${PROGRESS_TEXT[mat.state]}`,
    seg === 'aborto' ? '' : `neonatologia neonatal ${PROGRESS_TEXT[neo.state]}`,
  )

  return parts.filter(Boolean).join(' ')
}
