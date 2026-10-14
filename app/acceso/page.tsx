import { redirect } from 'next/navigation'
import { AccessForm } from '@/components/cuna/access-form'
import { Brand } from '@/components/cuna/brand'
import { UNIT_EMAIL } from '@/lib/config'
import { getAccount } from '@/lib/ctx'
import { ensureDemo } from '@/lib/seed'
import { DEMO_PASSWORD } from '@/lib/seed-data'

export const dynamic = 'force-dynamic'

export default async function AccesoPage() {
  await ensureDemo()
  if (await getAccount()) redirect('/')

  return (
    <main className="flex min-h-dvh items-center justify-center bg-navy px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl sm:p-8">
        <Brand />
        <h1 className="mt-6 text-2xl font-bold text-navy text-balance">Ingreso de la unidad</h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          Esta cuenta es compartida por el equipo. Después te pediremos tu nombre y tu PIN personal.
        </p>
        <AccessForm email={UNIT_EMAIL} demoPassword={DEMO_PASSWORD} />
      </div>
    </main>
  )
}
