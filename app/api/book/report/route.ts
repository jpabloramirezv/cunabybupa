import { handle, HttpError } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'
import { computeBookColumnReport, type ReportScope } from '@/lib/server/book-report'
import { addDaysYmd, todayYmd } from '@/lib/time'

const YMD = /^\d{4}-\d{2}-\d{2}$/
const SCOPES: ReportScope[] = ['todos', 'nacimientos', 'nursery', 'uci', 'aborto']

/** Estadísticas agregadas (sin datos de identificación) según las columnas elegidas del Libro de Partos y Abortos. */
export const GET = handle(async (req) => {
  const ctx = await requireCtx()
  if (!ctx.canReports && !ctx.canBook) throw new HttpError(403, 'Tu rol no permite ver estos informes.')
  const sp = new URL(req.url).searchParams
  const to = sp.get('to') ?? todayYmd()
  const from = sp.get('from') ?? addDaysYmd(to, -29)
  if (!YMD.test(from) || !YMD.test(to) || from > to) throw new HttpError(400, 'El período no es válido.')
  if ((new Date(to).getTime() - new Date(from).getTime()) / 86400000 > 3700) throw new HttpError(400, 'El período es demasiado largo.')
  const rawScope = sp.get('scope') as ReportScope | null
  const scope: ReportScope = rawScope && SCOPES.includes(rawScope) ? rawScope : 'todos'
  const keys = (sp.get('cols') ?? '').split(',').map((k) => k.trim()).filter(Boolean)
  const by = sp.get('by')?.trim() || null
  const report = await computeBookColumnReport({ from, to, scope, keys, by })
  return Response.json(report)
})
