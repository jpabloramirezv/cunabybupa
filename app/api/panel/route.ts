import { handle, HttpError } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'
import { computePanel, parsePanelUnit, parsePeriod } from '@/lib/server/panel'

export const GET = handle(async (req) => {
  await requireCtx('panel')
  const params = new URL(req.url).searchParams
  const period = parsePeriod(params)
  if (!period) throw new HttpError(400, 'El período no es válido.')
  return Response.json(await computePanel(period.from, period.to, parsePanelUnit(params.get('unidad'))))
})
