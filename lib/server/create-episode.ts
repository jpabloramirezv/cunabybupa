import { eq } from 'drizzle-orm'
import type { Ctx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { episode } from '@/lib/db/schema'
import { shiftOf } from '@/lib/time'

/**
 * Crea el registro si todavía no existe. Se usa desde Identificación (primer paso de un
 * registro nuevo) y desde Ingreso (registros que ya venían en cola de guardado).
 */
export async function ensureEpisode(id: string, ctx: Pick<Ctx, 'staffId'>, now = new Date()) {
  const [existing] = await db.select().from(episode).where(eq(episode.id, id)).limit(1)
  if (existing) return { row: existing, created: false }
  await db
    .insert(episode)
    .values({
      id,
      createdAt: now,
      admissionAt: now,
      createdShift: shiftOf(now).key,
      createdBy: ctx.staffId,
    })
    .onConflictDoNothing()
  const [row] = await db.select().from(episode).where(eq(episode.id, id)).limit(1)
  return { row, created: true }
}
