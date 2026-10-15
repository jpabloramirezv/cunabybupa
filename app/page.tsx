import { redirect } from 'next/navigation'
import { getAccount, getCtx } from '@/lib/ctx'

export const dynamic = 'force-dynamic'

export default async function Home() {
  if (!(await getAccount())) redirect('/acceso')
  const ctx = await getCtx()
  if (!ctx) redirect('/personal')
  redirect(ctx.canClinical ? '/pizarra' : ctx.canBook ? '/libro' : '/panel')
}
