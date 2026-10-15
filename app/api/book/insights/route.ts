import { handle, HttpError, readJson } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'
import { computeLibroReport, sanitizeLibroConfig } from '@/lib/server/book-insights'

export const maxDuration = 60

/** Informe estadístico del Libro de Partos y Abortos con la configuración elegida. Sin datos de identificación. */
export const POST = handle(async (req) => {
  const ctx = await requireCtx()
  if (!ctx.canReports && !ctx.canBook) throw new HttpError(403, 'Tu rol no permite ver estos informes.')
  const body = await readJson<{ config?: unknown }>(req)
  const cfg = sanitizeLibroConfig(body.config ?? body)
  if (!cfg) throw new HttpError(400, 'Revisa el período: la fecha final debe ser posterior a la inicial y no superar 5 años.')
  const { report } = await computeLibroReport(cfg, ctx.name)
  return Response.json(report, { headers: { 'Cache-Control': 'no-store' } })
})
