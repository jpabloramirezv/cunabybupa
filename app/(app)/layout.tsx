import { redirect } from 'next/navigation'
import { AppShell } from '@/components/cuna/app-shell'
import { getAccount, getCtx } from '@/lib/ctx'
import { roleLabelFor } from '@/lib/rules'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await getAccount())) redirect('/acceso')
  const ctx = await getCtx()
  if (!ctx) redirect('/personal')

  return (
    <AppShell
      name={ctx.name}
      roleLabel={
        ctx.role === 'matrona' && !ctx.isAdmin
          ? `${roleLabelFor(ctx.role, ctx.isAdmin)} · ${ctx.unit === 'maternidad' ? 'Maternidad' : 'Neonatología'}`
          : roleLabelFor(ctx.role, ctx.isAdmin)
      }
      canClinical={ctx.canClinical}
      canPanel={ctx.canPanel}
      canReports={ctx.canReports}
      canAdmin={ctx.canAdmin}
      canBook={ctx.canBook}
    >
      {children}
    </AppShell>
  )
}
