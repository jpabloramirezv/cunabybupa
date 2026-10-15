export const TZ = 'America/Santiago'

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

export function zonedParts(d: Date) {
  const o: Record<string, string> = {}
  for (const p of partsFmt.formatToParts(d)) o[p.type] = p.value
  return {
    y: +o.year,
    mo: +o.month,
    d: +o.day,
    h: +o.hour,
    mi: +o.minute,
    s: +o.second,
  }
}

function tzOffsetMs(d: Date) {
  const p = zonedParts(d)
  return (
    Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) -
    Math.floor(d.getTime() / 1000) * 1000
  )
}

/** Convierte una hora de pared de Santiago a un instante UTC. */
export function zonedToUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  const first = guess - tzOffsetMs(new Date(guess))
  return new Date(guess - tzOffsetMs(new Date(first)))
}

const pad = (n: number) => String(n).padStart(2, '0')

/** ISO -> valor para <input type="datetime-local"> en hora de Santiago. */
export function toInputValue(iso?: string | Date | null): string {
  if (!iso) return ''
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ''
  const p = zonedParts(d)
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`
}

/** Valor de <input type="datetime-local"> (hora de Santiago) -> ISO UTC. */
export function fromInputValue(v: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v)
  if (!m) return null
  return zonedToUtc(+m[1], +m[2], +m[3], +m[4], +m[5]).toISOString()
}

/** Fecha (YYYY-MM-DD) en Santiago -> inicio del día en UTC. */
export function startOfDay(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  return zonedToUtc(+m[1], +m[2], +m[3], 0, 0)
}

export function endOfDay(ymd: string): Date | null {
  const s = startOfDay(ymd)
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)!
  const next = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 1))
  return zonedToUtc(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    0,
    0,
  )
}

export function todayYmd(now = new Date()): string {
  const p = zonedParts(now)
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}`
}

/** Día calendario (YYYY-MM-DD) de un instante, en hora de Santiago. */
export function ymdInSantiago(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const p = zonedParts(d)
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}`
}

/** Hora de Santiago como "YYYY-MM-DD HH:mm", para planillas y CSV. Vacío si no hay fecha. */
export function fmtSheetDateTime(iso?: string | Date | null): string {
  if (!iso) return ''
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ''
  const p = zonedParts(d)
  return `${p.y}-${pad(p.mo)}-${pad(p.d)} ${pad(p.h)}:${pad(p.mi)}`
}

/** Suma meses y días calendario a un instante respetando la hora de pared de Santiago. */
export function addMonthsDaysSantiago(iso: string | Date, months: number, days: number): Date {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const p = zonedParts(d)
  const shifted = new Date(Date.UTC(p.y, p.mo - 1 + months, p.d + days))
  return zonedToUtc(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate(), p.h, p.mi)
}

export function addDaysYmd(ymd: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)!
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + days))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const p = zonedParts(d)
  return `${pad(p.d)} ${MONTHS[p.mo - 1]} ${pad(p.h)}:${pad(p.mi)}`
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const p = zonedParts(d)
  return `${pad(p.d)} ${MONTHS[p.mo - 1]} ${p.y}`
}

export function fmtYmd(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  return `${m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`
}

export function timeAgo(iso?: string | null, now = Date.now()): string {
  if (!iso) return '—'
  const diff = now - new Date(iso).getTime()
  if (diff < 0) return 'ahora'
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} días`
}

// --- Turnos: día 08:00–20:00, noche 20:00–08:00 (hora de Santiago) ---------

export type ShiftInfo = {
  key: string
  kind: 'D' | 'N'
  label: string
  start: Date
  end: Date
}

function buildShift(ymd: string, kind: 'D' | 'N'): ShiftInfo {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)!
  const y = +m[1]
  const mo = +m[2]
  const d = +m[3]
  if (kind === 'D') {
    return {
      key: `${ymd}-D`,
      kind,
      label: `Turno de día · ${pad(d)} ${MONTHS[mo - 1]}`,
      start: zonedToUtc(y, mo, d, 8, 0),
      end: zonedToUtc(y, mo, d, 20, 0),
    }
  }
  const next = new Date(Date.UTC(y, mo - 1, d + 1))
  return {
    key: `${ymd}-N`,
    kind,
    label: `Turno de noche · ${pad(d)} ${MONTHS[mo - 1]}`,
    start: zonedToUtc(y, mo, d, 20, 0),
    end: zonedToUtc(
      next.getUTCFullYear(),
      next.getUTCMonth() + 1,
      next.getUTCDate(),
      8,
      0,
    ),
  }
}

export function shiftOf(date: Date): ShiftInfo {
  const p = zonedParts(date)
  const ymd = `${p.y}-${pad(p.mo)}-${pad(p.d)}`
  if (p.h >= 8 && p.h < 20) return buildShift(ymd, 'D')
  if (p.h >= 20) return buildShift(ymd, 'N')
  return buildShift(addDaysYmd(ymd, -1), 'N')
}

export function shiftFromKey(key: string): ShiftInfo | null {
  const m = /^(\d{4}-\d{2}-\d{2})-([DN])$/.exec(key)
  if (!m) return null
  return buildShift(m[1], m[2] as 'D' | 'N')
}

export function previousShift(s: ShiftInfo): ShiftInfo {
  const ymd = s.key.slice(0, 10)
  if (s.kind === 'N') return buildShift(ymd, 'D')
  return buildShift(addDaysYmd(ymd, -1), 'N')
}

export function nextShift(s: ShiftInfo): ShiftInfo {
  const ymd = s.key.slice(0, 10)
  if (s.kind === 'D') return buildShift(ymd, 'N')
  return buildShift(addDaysYmd(ymd, 1), 'D')
}
