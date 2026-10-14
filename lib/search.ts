import {
  CARE_LEVEL_OPTIONS,
  DELIVERY_OPTIONS,
  FEEDING_OPTIONS,
  SCREENING_KINDS,
  SCREENING_STATUS,
  SEX_OPTIONS,
} from '@/lib/config'
import { STATUS_LABEL, uiStatus } from '@/lib/rules'
import { fmtDateTime } from '@/lib/time'
import type { CatalogsPayload, EpisodeDetail } from '@/lib/types'

/** Minúsculas y sin tildes, para que "Perez" encuentre "Pérez". */
export function fold(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const PUNCT = /[.\-+()\s/]/g
const compactOf = (s: string) => s.replace(PUNCT, '')

/** Cada palabra de la búsqueda debe aparecer en algún dato (en cualquier orden). */
export function parseQuery(q: string) {
  return fold(q).split(/\s+/).filter(Boolean)
}

/** Texto buscable. Con `withCompact` también acepta RUT o teléfonos escritos sin puntos ni guiones. */
export function haystackOf(text: string, withCompact = false) {
  const f = fold(text)
  return withCompact ? `${f} ${compactOf(f)}` : f
}

function tokenHits(hay: string, token: string) {
  if (hay.includes(token)) return true
  const plain = token.replace(/[.\-+()/]/g, '')
  return plain.length > 0 && plain !== token && hay.includes(plain)
}

export function matchesAll(hay: string, tokens: string[]) {
  return tokens.every((t) => tokenHits(hay, t))
}

/** Posiciones del texto original que coinciden con la búsqueda (ignora tildes y mayúsculas). */
export function findRanges(text: string, terms: string[], ignorePunct = false): [number, number][] {
  const chars: string[] = []
  const starts: number[] = []
  const ends: number[] = []
  let i = 0
  for (const ch of text) {
    const skip = ignorePunct && /[.\-+()\s]/.test(ch)
    if (!skip) {
      for (const c of fold(ch)) {
        chars.push(c)
        starts.push(i)
        ends.push(i + ch.length)
      }
    }
    i += ch.length
  }
  const norm = chars.join('')
  const found: [number, number][] = []
  for (const raw of terms) {
    const t = ignorePunct ? raw.replace(/[.\-+()/]/g, '') : raw
    if (!t) continue
    let from = 0
    for (;;) {
      const at = norm.indexOf(t, from)
      if (at === -1) break
      found.push([starts[at], ends[at + t.length - 1]])
      from = at + t.length
    }
  }
  found.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const r of found) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([r[0], r[1]])
  }
  return merged
}

export type SearchFieldEntry = { label: string; hay: string; visible: boolean }
export type EpisodeSearchEntry = { hay: string; fields: SearchFieldEntry[] }

type Raw = [string, string | number | null | undefined | false, { compact?: boolean; visible?: boolean }?]

const labelIn = (opts: { value: string; label: string }[], v: string | null) =>
  opts.find((o) => o.value === v)?.label ?? null

/** Resumen clínico de una línea que se muestra en cada fila. */
export function episodeSummary(e: EpisodeDetail, cat?: CatalogsPayload) {
  const parts: string[] = []
  if (e.gaWeeks != null) parts.push(e.gaDays != null ? `${e.gaWeeks}+${e.gaDays} sem` : `${e.gaWeeks} sem`)
  if (e.birthWeightG != null) parts.push(`${e.birthWeightG.toLocaleString('es-CL')} g`)
  const sex = labelIn(SEX_OPTIONS, e.sex)
  if (sex) parts.push(sex)
  const delivery = labelIn(DELIVERY_OPTIONS, e.deliveryType)
  if (delivery) parts.push(delivery)
  const prevision = cat?.items.find((i) => i.id === e.previsionId)?.label
  if (prevision) parts.push(prevision)
  return parts.join(' · ')
}

/**
 * Reúne todos los datos de la ficha en un solo texto buscable.
 * Los campos con `visible` ya se ven en la fila; el resto se indica como "Coincide en".
 */
export function buildEpisodeIndex(e: EpisodeDetail, cat?: CatalogsPayload): EpisodeSearchEntry {
  const item = (id: number | null) => (id == null ? null : (cat?.items.find((i) => i.id === id)?.label ?? null))
  const dx = (id: number | null) => {
    const d = id == null ? null : cat?.diagnoses.find((x) => x.id === id)
    return d ? `${d.code} ${d.name} ${d.synonyms.join(' ')}` : null
  }
  const id = e.identity
  const kindLabel = (k: string) => SCREENING_KINDS.find((s) => s.key === k)

  const raws: Raw[] = [
    ['Código', e.code, { compact: true, visible: true }],
    ['Estado', STATUS_LABEL[uiStatus(e)], { visible: true }],
    ['Paciente', id?.patientName, { visible: true }],
    ['RUT', id?.rut, { compact: true, visible: true }],
    ['Madre', id?.motherName, { visible: true }],
    ['Teléfono de la madre', id?.motherPhone, { compact: true }],
    ['N° de ingreso', id?.admissionNumber, { compact: true }],
    ['Edad gestacional', e.gaWeeks != null && `${e.gaWeeks} semanas ${e.gaWeeks}+${e.gaDays ?? 0} ${e.gaWeeks} sem`, { visible: true }],
    ['Peso', e.birthWeightG != null && `${e.birthWeightG} g gramos`, { visible: true }],
    ['Sexo', labelIn(SEX_OPTIONS, e.sex), { visible: true }],
    ['Tipo de parto', labelIn(DELIVERY_OPTIONS, e.deliveryType), { visible: true }],
    [
      'Apgar',
      e.apgar1 != null || e.apgar5 != null || e.apgar10 != null
        ? `apgar ${e.apgar1 ?? ''} ${e.apgar5 ?? ''} ${e.apgar10 ?? ''}`
        : null,
    ],
    ['Previsión', item(e.previsionId), { visible: true }],
    ['Procedimiento', item(e.procedimientoId)],
    [
      'Médico',
      (e.medicoIds?.length ? e.medicoIds : e.medicoId != null ? [e.medicoId] : [])
        .map((m) => item(m))
        .filter(Boolean)
        .join(' '),
    ],
    ['Nivel de cuidado', labelIn([...CARE_LEVEL_OPTIONS], e.careLevel)],
    ['Centro de origen', e.transferOrigin],
    ['Notificación GES', e.gesNotified === null ? null : e.gesNotified ? 'ges notificado' : 'ges no notificado'],
    [
      'Diagnóstico de ingreso',
      (e.dxIngresoIds?.length ? e.dxIngresoIds : e.dxIngresoId != null ? [e.dxIngresoId] : [])
        .map((x) => dx(x))
        .filter(Boolean)
        .join(' '),
    ],
    [
      'Diagnóstico de egreso',
      (e.dxEgresoIds?.length ? e.dxEgresoIds : e.dxEgresoId != null ? [e.dxEgresoId] : [])
        .map((x) => dx(x))
        .filter(Boolean)
        .join(' '),
    ],
    ['Destino', item(e.destinoId)],
    ['Alimentación al alta', labelIn(FEEDING_OPTIONS, e.feedingDischarge)],
    [
      'Condición',
      [
        e.readmissionOf && 'reingreso',
        e.hyperbili && 'hiperbilirrubinemia',
        e.phototherapyAt && 'fototerapia',
        e.altaConfirmedAt ? 'alta confirmada' : e.altaStarted ? 'alta en curso' : null,
      ]
        .filter(Boolean)
        .join(' '),
    ],
    ['Datos pendientes', [...e.missing, ...e.altaMissing, ...e.warnings].join(' ')],
    [
      'Tamizajes',
      e.screenings
        .map((s) => {
          const k = kindLabel(s.kind)
          const st = SCREENING_STATUS.find((x) => x.key === s.status)?.label ?? s.status
          return `${k?.label ?? s.kind} ${k?.help ?? ''} ${st}${s.status === 'pendiente' ? ' abierto' : ''}${e.overdueKinds.includes(s.kind) ? ' abierto 48 horas' : ''}`
        })
        .join(' '),
    ],
    [
      'Equipo',
      [...e.blocks.map((b) => b.staffName), ...e.screenings.map((s) => s.updatedByName)].filter(Boolean).join(' '),
    ],
    ['Fechas', [fmtDateTime(e.createdAt), fmtDateTime(e.birthAt), fmtDateTime(e.dischargeAt)].join(' ')],
    ['Turno', [e.createdShift, e.completedShift].filter(Boolean).join(' ')],
  ]

  const fields: SearchFieldEntry[] = raws
    .filter((r): r is [string, string | number, { compact?: boolean; visible?: boolean }?] => !!r[1] || r[1] === 0)
    .map(([label, value, opts]) => ({
      label,
      hay: haystackOf(String(value), opts?.compact),
      visible: !!opts?.visible,
    }))
  return { hay: fields.map((f) => f.hay).join(' '), fields }
}

/** Datos ocultos en la fila donde sí hubo coincidencia. */
export function hiddenMatches(entry: EpisodeSearchEntry | undefined, tokens: string[]) {
  if (!entry || tokens.length === 0) return []
  const labels = entry.fields
    .filter((f) => !f.visible && tokens.some((t) => tokenHits(f.hay, t)))
    .map((f) => f.label)
  return [...new Set(labels)]
}
