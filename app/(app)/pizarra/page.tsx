import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Board } from '@/components/cuna/board'
import { getCtx } from '@/lib/ctx'

export const metadata: Metadata = { title: 'Pizarra' }
export const dynamic = 'force-dynamic'

export default async function PizarraPage() {
  const ctx = await getCtx()
  if (ctx && !ctx.canClinical) redirect(ctx.canBook ? '/libro' : '/panel')
  return (
    <Suspense fallback={<p className="py-10 text-center text-muted-foreground">Cargando registros…</p>}>
      <Board />
    </Suspense>
  )
}
