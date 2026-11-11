import { handle } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'
import { getBookFields } from '@/lib/server/book'

/** Columnas adicionales activas de la ficha de Neonatología, para quien la completa. */
export const GET = handle(async () => {
  await requireCtx()
  const fields = await getBookFields(false, 'ficha')
  return Response.json({
    fields: fields.map((f) => ({
      key: f.key,
      label: f.label,
      group: f.group,
      type: f.type,
      options: f.options,
      required: f.required,
      help: f.help,
      min: f.min,
      max: f.max,
      showIf: f.showIf,
    })),
  })
})
