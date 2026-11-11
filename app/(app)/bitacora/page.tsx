import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { BitacoraModule } from '@/components/cuna/bitacora/bitacora-module'
import { getCtx } from '@/lib/ctx'

export const metadata: Metadata = { title: 'Bitácora Clínico-Administrativa' }
export const dynamic = 'force-dynamic'

export default async function BitacoraPage() {
  const ctx = await getCtx()
  if (!ctx?.canLog) redirect(ctx?.canClinical === false && ctx.canBook ? '/libro' : '/pizarra')
  return <BitacoraModule />
}
