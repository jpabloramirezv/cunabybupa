import { handle, HttpError } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'
import { computePanel, parsePeriod } from '@/lib/server/panel'

export const GET = handle(async (req) => {
  await requireCtx('panel')
  const period = parsePeriod(new URL(req.url).searchParams)
  if (!period) throw new HttpError(400, 'El período no es válido.')
  return Response.json(await computePanel(period.from, period.to))
})
