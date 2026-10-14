import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ReportsHub } from '@/components/cuna/insights/reports-hub'
import { getCtx } from '@/lib/ctx'

export const metadata: Metadata = { title: 'Informes estadísticos' }
export const dynamic = 'force-dynamic'

export default async function InsightsPage() {
  const ctx = await getCtx()
  if (!ctx?.canReports) redirect('/pizarra')
  return <ReportsHub />
}
