import { HttpError } from '@/lib/api'
import {
  CARE_LEVEL_OPTIONS,
  DELIVERY_OPTIONS,
  FEEDING_OPTIONS,
  HIV_RESULTS,
  SEX_OPTIONS,
} from '@/lib/config'
import { limitError, type LimitKey } from '@/lib/clinical-limits'
import { apgar10Error, apgar5Error } from '@/lib/rules'

export type Block = 'ingreso' | 'seguimiento' | 'alta'

type Spec =
  | { type: 'int' | 'fk' | 'ts' | 'bool' | 'text' | 'fkList' | 'dec' }
  | { type: 'enum'; values: string[] }

const FIELD_SPECS: Record<string, Spec> = {
  gaWeeks: { type: 'int' },
  gaDays: { type: 'int' },
  birthWeightG: { type: 'int' },
  apgar1: { type: 'int' },
  apgar5: { type: 'int' },
  apgar10: { type: 'int' },
  birthLengthCm: { type: 'dec' },
  birthHeadCm: { type: 'dec' },
  docUrgencyLaw: { type: 'bool' },
  docConsentAdmission: { type: 'bool' },
  docConsentMila: { type: 'bool' },
  maternalHivResult: { type: 'enum', values: HIV_RESULTS.map((o) => o.value) },
  maternalHivAt: { type: 'ts' },
  sex: { type: 'enum', values: SEX_OPTIONS.map((o) => o.value) },
  deliveryType: { type: 'enum', values: DELIVERY_OPTIONS.map((o) => o.value) },
  birthAt: { type: 'ts' },
  previsionId: { type: 'fk' },
  procedimientoId: { type: 'fk' },
  dxIngresoId: { type: 'fk' },
  dxIngresoIds: { type: 'fkList' },
  medicoId: { type: 'fk' },
  medicoIds: { type: 'fkList' },
  admissionAt: { type: 'ts' },
  careLevel: { type: 'enum', values: CARE_LEVEL_OPTIONS.map((o) => o.value) },
  transferOrigin: { type: 'text' },
  gesNotified: { type: 'bool' },
  gesNotifiedAt: { type: 'ts' },
  hyperbili: { type: 'bool' },
  phototherapyAt: { type: 'ts' },
  dischargeAt: { type: 'ts' },
  dischargeWeightG: { type: 'int' },
  dxEgresoId: { type: 'fk' },
  dxEgresoIds: { type: 'fkList' },
  destinoId: { type: 'fk' },
  feedingDischarge: { type: 'enum', values: FEEDING_OPTIONS.map((o) => o.value) },
}

/** Cada lista guarda todos los valores; el campo individual es el principal (el primero). */
const LIST_PRINCIPAL: Record<string, string> = {
  medicoIds: 'medicoId',
  dxIngresoIds: 'dxIngresoId',
  dxEgresoIds: 'dxEgresoId',
}

const BLOCK_FIELDS: Record<Block, string[]> = {
  ingreso: [
    'gaWeeks', 'gaDays', 'birthWeightG', 'apgar1', 'apgar5', 'sex', 'deliveryType',
    'birthAt', 'previsionId', 'procedimientoId', 'dxIngresoId', 'dxIngresoIds', 'medicoId', 'medicoIds',
    'admissionAt', 'careLevel', 'transferOrigin', 'gesNotified', 'gesNotifiedAt',
    'apgar10', 'birthLengthCm', 'birthHeadCm', 'docUrgencyLaw', 'docConsentAdmission',
    'docConsentMila', 'maternalHivResult', 'maternalHivAt',
  ],
  seguimiento: ['hyperbili', 'phototherapyAt', 'gesNotified', 'gesNotifiedAt'],
  alta: [
    'dischargeAt', 'dischargeWeightG', 'dxEgresoId', 'dxEgresoIds', 'destinoId', 'feedingDischarge',
    'medicoId', 'medicoIds',
  ],
}

export const isBlock = (b: unknown): b is Block =>
  b === 'ingreso' || b === 'seguimiento' || b === 'alta'

const bad = (field: string) => new HttpError(400, `El dato "${field}" no es válido.`)

/** Convierte y valida el parche. Solo el APGAR a 5 minutos imposible se rechaza. */
export function parsePatch(block: Block, raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') throw new HttpError(400, 'Los datos enviados no son válidos.')
  const out: Record<string, unknown> = {}
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!BLOCK_FIELDS[block].includes(key)) throw bad(key)
    const spec = FIELD_SPECS[key]
    if (spec.type === 'fkList') {
      const principal = LIST_PRINCIPAL[key]
      if (v === null || v === '') {
        out[key] = []
        out[principal] = null
        continue
      }
      if (!Array.isArray(v) || v.length > 12) throw bad(key)
      const ids = [...new Set(v.map((x) => Number(x)))]
      if (ids.some((n) => !Number.isInteger(n) || n <= 0 || n > 1_000_000)) throw bad(key)
      out[key] = ids
      out[principal] = ids[0] ?? null
      continue
    }
    if (v === null || v === '') {
      out[key] = null
      continue
    }
    switch (spec.type) {
      case 'text': {
        if (typeof v !== 'string') throw bad(key)
        const t = v.trim().slice(0, 160)
        out[key] = t || null
        break
      }
      case 'int':
      case 'fk': {
        const n = typeof v === 'string' ? Number(v) : v
        if (typeof n !== 'number' || !Number.isInteger(n) || Math.abs(n) > 1_000_000) throw bad(key)
        out[key] = n
        break
      }
      case 'dec': {
        const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v
        if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 200) throw bad(key)
        out[key] = Math.round(n * 10) / 10
        break
      }
      case 'bool':
        if (typeof v !== 'boolean') throw bad(key)
        out[key] = v
        break
      case 'ts': {
        const d = new Date(String(v))
        if (Number.isNaN(d.getTime())) throw bad(key)
        out[key] = d
        break
      }
      case 'enum':
        if (typeof v !== 'string' || !spec.values.includes(v)) throw bad(key)
        out[key] = v
        break
    }
  }
  for (const [listKey, single] of Object.entries(LIST_PRINCIPAL)) {
    if (single in out && !(listKey in out)) out[listKey] = out[single] == null ? [] : [out[single]]
  }
  if ('apgar5' in out) {
    const err = apgar5Error(out.apgar5 as number | null)
    if (err) throw new HttpError(422, err)
  }
  if ('apgar10' in out) {
    const err = apgar10Error(out.apgar10 as number | null)
    if (err) throw new HttpError(422, err)
  }
  const limitedFields: Array<[string, LimitKey]> = [
    ['gaWeeks', 'gaWeeks'],
    ['birthWeightG', 'birthWeightG'],
    ['birthLengthCm', 'birthLengthCm'],
    ['dischargeWeightG', 'dischargeWeightG'],
  ]
  for (const [field, limitKey] of limitedFields) {
    if (!(field in out)) continue
    const raw = out[field]
    const err = limitError(limitKey, raw == null ? null : Number(raw))
    if (err) throw new HttpError(422, err)
  }
  if (out.maternalHivAt instanceof Date && out.maternalHivAt.getTime() > Date.now() + 24 * 3600_000) {
    throw new HttpError(422, 'La fecha del examen de VIH no puede estar en el futuro.')
  }
  return out
}
