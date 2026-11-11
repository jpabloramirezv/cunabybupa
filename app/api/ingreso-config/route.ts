import { handle } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'
import { getIngresoOverrides } from '@/lib/server/ingreso-config'

/** Nombres, ayudas y preguntas ocultas del Ingreso, para quien completa la ficha y mira la tabla. */
export const GET = handle(async () => {
  await requireCtx()
  return Response.json({ overrides: await getIngresoOverrides() })
})
