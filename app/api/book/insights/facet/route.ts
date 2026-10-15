import { handle, HttpError } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'
import { libroFacet, sanitizeLibroConfig } from '@/lib/server/book-insights'

/** Categorías disponibles de una columna dentro del período y alcance, para armar filtros. */
export const GET = handle(async (req) => {
  const ctx = await requireCtx()
  if (!ctx.canReports && !ctx.canBook) throw new HttpError(403, 'Tu rol no permite ver estos informes.')
  const sp = new URL(req.url).searchParams
  const cfg = sanitizeLibroConfig({
    from: sp.get('from'),
    to: sp.get('to'),
    scope: sp.get('scope'),
    basis: sp.get('basis'),
  })
  const key = sp.get('key')?.trim()
  if (!cfg || !key) throw new HttpError(400, 'Faltan parámetros.')
  const facet = await libroFacet(cfg, key)
  if (!facet) throw new HttpError(404, 'Columna no disponible.')
  return Response.json(facet, { headers: { 'Cache-Control': 'no-store' } })
})
