// Motor de formularios: reglas compartidas entre cliente y servidor.
// Una columna puede mostrarse solo si se cumplen todas sus condiciones sobre otras columnas.

export type ConditionOp = 'eq' | 'neq' | 'in' | 'contains' | 'filled' | 'empty'

export type Condition = {
  /** Clave de la columna cuya respuesta se evalúa. */
  key: string
  op: ConditionOp
  /** Valores de comparación (no aplica a «filled» y «empty»). */
  values: string[]
}

export const CONDITION_OP_LABEL: Record<ConditionOp, string> = {
  eq: 'es igual a',
  neq: 'es distinto de',
  in: 'es alguno de',
  contains: 'contiene',
  filled: 'tiene respuesta',
  empty: 'está vacía',
}

export const OPS_WITHOUT_VALUE: ConditionOp[] = ['filled', 'empty']

/** Dónde vive una columna: el Libro de Partos y Abortos, o la ficha de Neonatología (Pizarra). */
export type FieldScope = 'libro' | 'ficha'

export const SCOPE_LABEL: Record<FieldScope, string> = {
  libro: 'Libro de Partos y Abortos',
  ficha: 'Ficha de Neonatología',
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

export function isCondition(v: unknown): v is Condition {
  if (!v || typeof v !== 'object') return false
  const c = v as Record<string, unknown>
  return (
    typeof c.key === 'string' &&
    ['eq', 'neq', 'in', 'contains', 'filled', 'empty'].includes(c.op as string) &&
    Array.isArray(c.values) &&
    c.values.every((x) => typeof x === 'string')
  )
}

export function evalCondition(c: Condition, values: Record<string, string>): boolean {
  const actual = norm(values[c.key] ?? '')
  const wanted = c.values.map(norm)
  switch (c.op) {
    case 'filled':
      return actual !== ''
    case 'empty':
      return actual === ''
    case 'eq':
      return wanted.length > 0 && actual === wanted[0]
    case 'neq':
      return wanted.length === 0 || actual !== wanted[0]
    case 'in':
      return wanted.includes(actual)
    case 'contains':
      return wanted.some((w) => w !== '' && actual.includes(w))
  }
}

/** Todas las condiciones deben cumplirse. Sin condiciones, la columna siempre se muestra. */
export const conditionsMet = (conditions: Condition[], values: Record<string, string>) =>
  conditions.every((c) => evalCondition(c, values))

export function describeCondition(c: Condition, labelOf: (key: string) => string): string {
  const who = labelOf(c.key)
  if (OPS_WITHOUT_VALUE.includes(c.op)) return `${who} ${CONDITION_OP_LABEL[c.op]}`
  return `${who} ${CONDITION_OP_LABEL[c.op]} «${c.values.join('», «')}»`
}

/** Las reglas que el Libro traía fijas en código; se cargan una sola vez como condiciones editables. */
export const LEGACY_CONDITIONS: Record<string, Condition[]> = {
  causa_cesarea: [{ key: 'tipo_parto', op: 'contains', values: ['CESÁREA'] }],
  robson: [{ key: 'tipo_parto', op: 'neq', values: ['ABORTO'] }],
  tiempo_rpm: [{ key: 'rpm', op: 'eq', values: ['SI'] }],
  profilaxis_rpm: [{ key: 'rpm', op: 'eq', values: ['SI'] }],
  elisa_res: [{ key: 'elisa_n', op: 'filled', values: [] }],
  vdrl_res: [{ key: 'vdrl_n', op: 'filled', values: [] }],
  sgb_res: [{ key: 'sgb', op: 'eq', values: ['SI'] }],
  prof_sgb: [{ key: 'sgb_res', op: 'eq', values: ['POSITIVO'] }],
  paridad_n: [{ key: 'paridad', op: 'eq', values: ['MULTÍPARA'] }],
  hb_res: [{ key: 'hb', op: 'eq', values: ['SI'] }],
  chagas_res: [{ key: 'chagas', op: 'eq', values: ['SI'] }],
  peat_resultado: [{ key: 'peat', op: 'eq', values: ['SI'] }],
}

/** Tipos de columna que se pueden crear (los mismos que ya usa el Libro). */
export const MAX_CONDITIONS = 4
