import { handle, HttpError, readJson } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'
import { computeInsights, sanitizeConfig } from '@/lib/server/insights'

export const maxDuration = 60

/** Genera el informe estadístico con la configuración elegida. Sin datos de identificación. */
export const POST = handle(async (req) => {
  const ctx = await requireCtx('reports')
  const body = await readJson<{ config?: unknown }>(req)
  const cfg = sanitizeConfig(body.config ?? body)
  if (!cfg) throw new HttpError(400, 'Revisa el período: la fecha final debe ser posterior a la inicial y no superar 5 años.')
  const { report } = await computeInsights(cfg, ctx.name)
  return Response.json(report, { headers: { 'Cache-Control': 'no-store' } })
})
