// Estadística descriptiva e inferencial básica, sin dependencias externas.

export type Summary = {
  n: number
  mean: number
  sd: number | null
  min: number
  q1: number
  median: number
  q3: number
  p90: number
  max: number
}

export type BoxStats = {
  n: number
  mean: number
  q1: number
  median: number
  q3: number
  whiskerLow: number
  whiskerHigh: number
  outliers: number[]
}

export type HistBin = { from: number; to: number; n: number }

export function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

export const sortAsc = (v: number[]) => [...v].sort((a, b) => a - b)

export function summarize(values: number[]): Summary | null {
  const s = sortAsc(values.filter((v) => Number.isFinite(v)))
  const n = s.length
  if (n === 0) return null
  const mean = s.reduce((a, b) => a + b, 0) / n
  const sd = n > 1 ? Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : null
  return {
    n,
    mean,
    sd,
    min: s[0],
    q1: quantile(s, 0.25)!,
    median: quantile(s, 0.5)!,
    q3: quantile(s, 0.75)!,
    p90: quantile(s, 0.9)!,
    max: s[n - 1],
  }
}

export function boxStats(values: number[]): BoxStats | null {
  const s = sortAsc(values.filter((v) => Number.isFinite(v)))
  const n = s.length
  if (n === 0) return null
  const q1 = quantile(s, 0.25)!
  const q3 = quantile(s, 0.75)!
  const iqr = q3 - q1
  const lowFence = q1 - 1.5 * iqr
  const highFence = q3 + 1.5 * iqr
  const inside = s.filter((v) => v >= lowFence && v <= highFence)
  return {
    n,
    mean: s.reduce((a, b) => a + b, 0) / n,
    q1,
    median: quantile(s, 0.5)!,
    q3,
    whiskerLow: inside[0] ?? s[0],
    whiskerHigh: inside[inside.length - 1] ?? s[n - 1],
    outliers: s.filter((v) => v < lowFence || v > highFence).slice(0, 40),
  }
}

const NICE_WIDTHS = [0.5, 1, 2, 3, 5, 7, 10, 14, 20, 30, 50, 100, 250, 500]

/** Elige un ancho de clase "redondo" para que haya entre 6 y 14 clases. */
export function niceWidth(min: number, max: number, target = 10): number {
  const span = Math.max(max - min, 1e-9)
  const raw = span / target
  return NICE_WIDTHS.find((w) => w >= raw) ?? Math.ceil(raw)
}

export function histogram(values: number[], width?: number): HistBin[] {
  const v = values.filter((x) => Number.isFinite(x))
  if (v.length === 0) return []
  const min = Math.min(...v)
  const max = Math.max(...v)
  const w = width ?? niceWidth(min, max)
  const start = Math.floor(min / w) * w
  const count = Math.max(1, Math.floor((max - start) / w) + 1)
  const bins: HistBin[] = Array.from({ length: count }, (_, i) => ({
    from: start + i * w,
    to: start + (i + 1) * w,
    n: 0,
  }))
  for (const x of v) bins[Math.min(count - 1, Math.floor((x - start) / w))].n++
  return bins
}

/** Intervalo de confianza de Wilson al 95 %, en porcentaje. */
export function wilson(k: number, n: number): [number, number] | null {
  if (n === 0) return null
  const z = 1.96
  const p = k / n
  const d = 1 + (z * z) / n
  const c = p + (z * z) / (2 * n)
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
  return [Math.max(0, ((c - m) / d) * 100), Math.min(100, ((c + m) / d) * 100)]
}

export const pct = (a: number, b: number): number | null => (b === 0 ? null : (a / b) * 100)

// --- Distribuciones -----------------------------------------------------------

function logGamma(x: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5,
  ]
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (const cj of c) ser += cj / ++y
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}

/** Función gamma incompleta regularizada inferior P(a, x). */
function gammaP(a: number, x: number): number {
  if (x <= 0) return 0
  if (x < a + 1) {
    let ap = a
    let sum = 1 / a
    let del = sum
    for (let i = 0; i < 200; i++) {
      ap++
      del *= x / ap
      sum += del
      if (Math.abs(del) < Math.abs(sum) * 1e-12) break
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a))
  }
  let b = x + 1 - a
  let c = 1 / 1e-30
  let d = 1 / b
  let h = d
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < 1e-30) d = 1e-30
    c = b + an / c
    if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-12) break
  }
  return 1 - Math.exp(-x + a * Math.log(x) - logGamma(a)) * h
}

export const chiSquareP = (chi2: number, df: number) =>
  df <= 0 ? null : Math.min(1, Math.max(0, 1 - gammaP(df / 2, chi2 / 2)))

function normalCdf(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}

// --- Pruebas -----------------------------------------------------------------

export type ChiResult = {
  chi2: number
  df: number
  p: number | null
  cramersV: number | null
  lowExpectedShare: number
}

/** Chi-cuadrado de independencia. Ignora filas y columnas sin casos. */
export function chiSquare(table: number[][]): ChiResult | null {
  const rows = table.filter((r) => r.some((x) => x > 0))
  if (rows.length < 2) return null
  const cols = rows[0].map((_, j) => j).filter((j) => rows.some((r) => r[j] > 0))
  if (cols.length < 2) return null
  const t = rows.map((r) => cols.map((j) => r[j]))
  const rowSum = t.map((r) => r.reduce((a, b) => a + b, 0))
  const colSum = cols.map((_, j) => t.reduce((a, r) => a + r[j], 0))
  const total = rowSum.reduce((a, b) => a + b, 0)
  let chi2 = 0
  let low = 0
  for (let i = 0; i < t.length; i++) {
    for (let j = 0; j < cols.length; j++) {
      const e = (rowSum[i] * colSum[j]) / total
      if (e < 5) low++
      chi2 += (t[i][j] - e) ** 2 / e
    }
  }
  const df = (t.length - 1) * (cols.length - 1)
  const k = Math.min(t.length, cols.length) - 1
  return {
    chi2,
    df,
    p: chiSquareP(chi2, df),
    cramersV: k > 0 ? Math.sqrt(chi2 / (total * k)) : null,
    lowExpectedShare: low / (t.length * cols.length),
  }
}

function ranks(values: number[]): number[] {
  const idx = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0])
  const out = new Array<number>(values.length)
  let i = 0
  while (i < idx.length) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++
    const r = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) out[idx[k][1]] = r
    i = j + 1
  }
  return out
}

export type KruskalResult = { h: number; df: number; p: number | null }

/** Kruskal-Wallis con corrección por empates. */
export function kruskalWallis(groups: number[][]): KruskalResult | null {
  const g = groups.filter((x) => x.length > 0)
  if (g.length < 2) return null
  const all = g.flat()
  const n = all.length
  if (n < 3) return null
  const r = ranks(all)
  let pos = 0
  let h = 0
  for (const grp of g) {
    const rs = r.slice(pos, pos + grp.length).reduce((a, b) => a + b, 0)
    h += (rs * rs) / grp.length
    pos += grp.length
  }
  h = (12 / (n * (n + 1))) * h - 3 * (n + 1)
  const counts = new Map<number, number>()
  for (const v of all) counts.set(v, (counts.get(v) ?? 0) + 1)
  let ties = 0
  for (const c of counts.values()) ties += c ** 3 - c
  const corr = 1 - ties / (n ** 3 - n)
  if (corr <= 0) return null
  h /= corr
  const df = g.length - 1
  return { h, df, p: chiSquareP(h, df) }
}

export type SpearmanResult = { rho: number; n: number; p: number | null }

export function spearman(x: number[], y: number[]): SpearmanResult | null {
  const n = Math.min(x.length, y.length)
  if (n < 5) return null
  const rx = ranks(x.slice(0, n))
  const ry = ranks(y.slice(0, n))
  const mx = rx.reduce((a, b) => a + b, 0) / n
  const my = ry.reduce((a, b) => a + b, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (rx[i] - mx) * (ry[i] - my)
    sxx += (rx[i] - mx) ** 2
    syy += (ry[i] - my) ** 2
  }
  if (sxx === 0 || syy === 0) return null
  const rho = sxy / Math.sqrt(sxx * syy)
  let p: number | null = null
  if (n >= 10 && Math.abs(rho) < 1) {
    const z = Math.atanh(rho) * Math.sqrt((n - 3) / 1.06)
    p = 2 * (1 - normalCdf(Math.abs(z)))
  } else if (Math.abs(rho) >= 1) {
    p = 0
  }
  return { rho, n, p }
}

// --- Formato ------------------------------------------------------------------

export const fmtNum = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? '—'
    : v.toLocaleString('es-CL', { maximumFractionDigits: digits, minimumFractionDigits: 0 })

export const fmtPct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? '—' : `${fmtNum(v, digits)}%`

export const fmtP = (p: number | null | undefined) =>
  p === null || p === undefined ? '—' : p < 0.001 ? 'p < 0,001' : `p = ${fmtNum(p, 3)}`
