import { desc } from 'drizzle-orm'
import { handle, HttpError } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { episode } from '@/lib/db/schema'
import { attachIdentity, buildDetails } from '@/lib/server/episodes'

const norm = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Busca ingresos de UCI recientes para vincularlos a una fila del libro. */
export const GET = handle(async (req) => {
  const ctx = await requireCtx()
  if (!ctx.canBook || !ctx.canIdentity) throw new HttpError(403, 'Tu rol no permite vincular ingresos.')
  const q = norm(new URL(req.url).searchParams.get('q')).trim()
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
