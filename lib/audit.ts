import { and, desc, eq, gt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { auditLog } from '@/lib/db/schema'
import type { Ctx } from '@/lib/ctx'

type Action = 'crear' | 'modificar' | 'leer' | 'eliminar' | 'exportar'

/** Ventana en la que abrir varias veces el mismo dato sensible cuenta como un solo acceso. */
const ACCESS_WINDOW_MS = 15 * 60 * 1000

/**
 * Guarda quién hizo qué sobre registros, campos, turnos, exportaciones y administración.
 * No usar para lecturas generales (listados, indicadores): solo aportan ruido.
 * Nunca recibe valores de datos identificatorios, solo nombres de campos.
 */
export async function audit(
  ctx: Pick<Ctx, 'staffId' | 'name'>,
  action: Action,
  block: string,
  episodeId?: string | null,
  detail?: string,
) {
  await db.insert(auditLog).values({
    staffId: ctx.staffId,
    staffName: ctx.name,
    action,
    block,
    episodeId: episodeId ?? null,
    detail: detail ?? null,
  })
}

/**
 * Acceso a datos sensibles (p. ej. identificación del paciente). Es lo único que se audita
 * como lectura, y se agrupa: la misma persona sobre el mismo registro cuenta una vez cada 15 min.
 */
export async function auditAccess(
  ctx: Pick<Ctx, 'staffId' | 'name'>,
  block: string,
  episodeId: string,
  detail?: string,
) {
  const since = new Date(Date.now() - ACCESS_WINDOW_MS)
  const [recent] = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, 'leer'),
        eq(auditLog.block, block),
        eq(auditLog.episodeId, episodeId),
        eq(auditLog.staffId, ctx.staffId),
        gt(auditLog.at, since),
      ),
    )
    .orderBy(desc(auditLog.at))
    .limit(1)
  if (recent) return
  await audit(ctx, 'leer', block, episodeId, detail)
}
