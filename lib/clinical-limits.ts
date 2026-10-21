/**
 * Rangos que un dato de recién nacido puede tener en la práctica clínica.
 * Fuera de estos límites el valor es un error de digitación y no se guarda.
 * Los avisos más finos (por ejemplo, peso poco habitual para la edad gestacional) siguen en `lib/rules.ts`.
 */
export type ClinicalLimit = { min: number; max: number; unit: string; label: string }

export const LIMITS = {
  gaWeeks: { min: 20, max: 45, unit: 'semanas', label: 'La edad gestacional' },
  birthWeightG: { min: 200, max: 7000, unit: 'g', label: 'El peso de nacimiento' },
  birthLengthCm: { min: 18, max: 70, unit: 'cm', label: 'La talla de nacimiento' },
  dischargeWeightG: { min: 400, max: 9000, unit: 'g', label: 'El peso al alta' },
} as const satisfies Record<string, ClinicalLimit>

export type LimitKey = keyof typeof LIMITS

/** Columnas del Libro que comparten rango con el dato del ingreso. */
export const BOOK_LIMIT_KEYS: Record<string, LimitKey> = {
  eg: 'gaWeeks',
  peso: 'birthWeightG',
  talla: 'birthLengthCm',
  peso_alta: 'dischargeWeightG',
}

const fmt = (n: number) => n.toLocaleString('es-CL')

export function rangeMessage(min: number, max: number, unit?: string) {
  return `Debe estar entre ${fmt(min)} y ${fmt(max)}${unit ? ` ${unit}` : ''}.`
}

export function limitError(key: LimitKey, value: number | null | undefined): string | null {
  if (value == null) return null
  const l: ClinicalLimit = LIMITS[key]
  if (!Number.isFinite(value) || value < l.min || value > l.max) {
    return `${l.label} debe estar entre ${fmt(l.min)} y ${fmt(l.max)} ${l.unit}.`
  }
  return null
}

export function bookLimit(bookKey: string): (ClinicalLimit & { key: LimitKey }) | null {
  const key = BOOK_LIMIT_KEYS[bookKey]
  return key ? { ...LIMITS[key], key } : null
}

export function bookLimitError(bookKey: string, value: number): string | null {
  const key = BOOK_LIMIT_KEYS[bookKey]
  return key ? limitError(key, value) : null
}
