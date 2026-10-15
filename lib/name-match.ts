/** Compara nombres de personas sin distinguir tildes, mayúsculas, títulos ni orden. Se usa en cliente y servidor. */

const TITLES = new Set(['dr', 'dra', 'doctor', 'doctora', 'dr.', 'dra.'])

export const normName = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const tokensOf = (s: string) =>
  normName(s)
    .split(' ')
    .filter((t) => t && !TITLES.has(t))

function distance(a: string, b: string) {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1))
      last = tmp
    }
  }
  return prev[b.length]
}

export type NameMatch<T> = { exact: T[]; similar: T[] }

/**
 * Busca coincidencias de `input` entre `candidates`.
 * `exact`: mismo nombre (aunque cambie el orden o falten tildes). `similar`: nombre parcial o con una letra distinta.
 */
export function matchNames<T>(input: string, candidates: T[], nameOf: (c: T) => string): NameMatch<T> {
  const a = tokensOf(input)
  const out: NameMatch<T> = { exact: [], similar: [] }
  if (a.length === 0) return out
  const aKey = [...a].sort().join(' ')
  for (const c of candidates) {
    const b = tokensOf(nameOf(c))
    if (b.length === 0) continue
    if ([...b].sort().join(' ') === aKey) {
      out.exact.push(c)
      continue
    }
    const [short, long] = a.length <= b.length ? [a, b] : [b, a]
    const contained =
      short.length >= 2 && short.every((t) => long.some((u) => u === t || (t.length >= 3 && u.startsWith(t)) || (u.length >= 3 && t.startsWith(u))))
    const close = aKey.length >= 8 && distance(aKey, [...b].sort().join(' ')) <= 2
    if (contained || close) out.similar.push(c)
  }
  return out
}
