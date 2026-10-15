import { handle, HttpError } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'
import { computeBookStats, type StatsSegment } from '@/lib/server/book-stats'
import { addDaysYmd, todayYmd } from '@/lib/time'

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** Indicadores agregados (sin datos de identificación) de Nursery, UPC o todos los nacimientos del libro. */
export const GET = handle(async (req) => {
  const ctx = await requireCtx()
  if (!ctx.canPanel && !ctx.canReports && !ctx.canBook) throw new HttpError(403, 'Tu rol no permite ver estos indicadores.')
  const sp = new URL(req.url).searchParams
  const to = sp.get('to') ?? todayYmd()
  const from = sp.get('from') ?? addDaysYmd(to, -29)
  if (!YMD.test(from) || !YMD.test(to) || from > to) throw new HttpError(400, 'El período no es válido.')
  if ((new Date(to).getTime() - new Date(from).getTime()) / 86400000 > 3700) throw new HttpError(400, 'El período es demasiado largo.')
  const seg = sp.get('segment')
  const segment: StatsSegment = seg === 'uci' || seg === 'nursery' ? seg : 'todos'
  const stats = await computeBookStats(from, to, segment)
  return Response.json(stats)
})
