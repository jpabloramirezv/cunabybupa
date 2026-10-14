import { handle, HttpError, readJson } from '@/lib/api'
import { audit } from '@/lib/audit'
import { requireCtx } from '@/lib/ctx'
import { computeInsights, sanitizeConfig } from '@/lib/server/insights'
import { buildInsightsWorkbook } from '@/lib/server/insights-excel'

export const maxDuration = 60

/** Excel del informe: tablas por sección y hoja de datos sin identificación. */
export const POST = handle(async (req) => {
  const ctx = await requireCtx('reports')
  const body = await readJson<{ config?: unknown }>(req)
  const cfg = sanitizeConfig(body.config ?? body)
  if (!cfg) throw new HttpError(400, 'Revisa el período del informe.')
  const { report, rows } = await computeInsights(cfg, ctx.name)
  const buffer = await buildInsightsWorkbook(report, rows)
  await audit(ctx, 'exportar', 'insights', null, `Excel ${cfg.from} a ${cfg.to} · ${rows.length} registros`)
  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="insights-neonatologia-${cfg.from}_${cfg.to}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
})
