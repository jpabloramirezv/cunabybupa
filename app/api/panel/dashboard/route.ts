import { handle } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'
import { parsePanelPeriod } from '@/lib/panel-indicators'
import { computeDashboard } from '@/lib/server/panel-dashboard'
import { parsePanelUnit } from '@/lib/server/panel'

export const GET = handle(async (req) => {
  await requireCtx('panel')
  const params = new URL(req.url).searchParams
  return Response.json(
    await computeDashboard(parsePanelUnit(params.get('unidad')), parsePanelPeriod(params.get('periodo'))),
  )
})
