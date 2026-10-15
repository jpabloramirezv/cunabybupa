import { handle, HttpError, readJson } from '@/lib/api'
import { audit } from '@/lib/audit'
import { requireCtx } from '@/lib/ctx'
import { computeLibroReport, sanitizeLibroConfig } from '@/lib/server/book-insights'
import { buildLibroWorkbook } from '@/lib/server/book-insights-excel'

export const maxDuration = 60

/** Excel del informe del Libro: tablas por sección y hoja de datos sin identificación. */
export const POST = handle(async (req) => {
  const ctx = await requireCtx()
  if (!ctx.canReports && !ctx.canBook) throw new HttpError(403, 'Tu rol no permite exportar estos informes.')
  const body = await readJson<{ config?: unknown }>(req)
  const cfg = sanitizeLibroConfig(body.config ?? body)
  if (!cfg) throw new HttpError(400, 'Revisa el período del informe.')
  const { report, data } = await computeLibroReport(cfg, ctx.name)
  const buffer = await buildLibroWorkbook(report, data)
  await audit(ctx, 'exportar', 'insights', null, `Excel Libro de Partos ${cfg.from} a ${cfg.to} · ${data.length} registros`)
  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="informe-libro-partos-${cfg.from}_${cfg.to}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
})
