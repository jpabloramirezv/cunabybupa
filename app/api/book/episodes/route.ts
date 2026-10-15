import { and, desc, eq, isNull, notExists, sql } from 'drizzle-orm'
import { handle, HttpError } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { birthRecord, episode } from '@/lib/db/schema'
import { attachIdentity, buildDetails } from '@/lib/server/episodes'

const norm = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * Sin parámetros: busca ingresos recientes para vincularlos a una fila del libro.
 * Con `sinFila=1`: devuelve TODOS los ingresos de la Pizarra que aún no tienen fila en el libro,
 * sin tope, para que Maternidad y Neonatología vean el mismo universo pendiente.
 */
export const GET = handle(async (req) => {
  const ctx = await requireCtx()
  const url = new URL(req.url)

  if (url.searchParams.get('sinFila') === '1') {
    if (!ctx.canBook) throw new HttpError(403, 'Tu rol no permite abrir el libro.')
    const rows = await db
      .select()
      .from(episode)
      .where(
        notExists(
          db
            .select({ one: sql`1` })
            .from(birthRecord)
            .where(and(eq(birthRecord.episodeId, episode.id), isNull(birthRecord.deletedAt))),
        ),
      )
      .orderBy(desc(episode.createdAt))
    const details = ctx.canIdentity ? await attachIdentity(await buildDetails(rows)) : await buildDetails(rows)
    return Response.json(
      details.map((d) => ({
        id: d.id,
        code: d.code,
        createdAt: d.createdAt,
        status: d.status,
        unit: d.unit,
        patientName: ctx.canIdentity ? (d.identity?.patientName ?? null) : null,
        motherName: ctx.canIdentity ? (d.identity?.motherName ?? null) : null,
        rut: ctx.canIdentity ? (d.identity?.rut ?? null) : null,
        admissionNumber: ctx.canIdentity ? (d.identity?.admissionNumber ?? null) : null,
      })),
    )
  }

  if (!ctx.canBook || !ctx.canIdentity) throw new HttpError(403, 'Tu rol no permite vincular ingresos.')
  const q = norm(url.searchParams.get('q')).trim()
  const rows = await db.select().from(episode).orderBy(desc(episode.createdAt)).limit(150)
  const details = await attachIdentity(await buildDetails(rows))
  const hits = details
    .filter((d) => {
      if (!q) return true
      const hay = norm(
        [d.code, d.identity?.patientName, d.identity?.motherName, d.identity?.rut, d.identity?.admissionNumber].join(' '),
      )
      return hay.includes(q)
    })
    .slice(0, 12)
    .map((d) => ({
      id: d.id,
      code: d.code,
      createdAt: d.createdAt,
      status: d.status,
      patientName: d.identity?.patientName ?? null,
      motherName: d.identity?.motherName ?? null,
      admissionNumber: d.identity?.admissionNumber ?? null,
    }))
  return Response.json(hits)
})
