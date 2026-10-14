import { redirect } from 'next/navigation'
import { Brand } from '@/components/cuna/brand'
import { PersonPicker } from '@/components/cuna/person-picker'
import { getAccount, getCtx } from '@/lib/ctx'
import { DEMO_STAFF } from '@/lib/seed-data'

export const dynamic = 'force-dynamic'

const DEMO_PINS = Object.fromEntries(DEMO_STAFF.map((s) => [s.name, s.pin]))

export default async function PersonalPage() {
  if (!(await getAccount())) redirect('/acceso')
  if (await getCtx()) redirect('/')

  return (
    <main className="flex min-h-dvh items-center justify-center bg-navy px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl sm:p-8">
        <Brand />
        <PersonPicker demoPins={DEMO_PINS} />
      </div>
    </main>
  )
}
