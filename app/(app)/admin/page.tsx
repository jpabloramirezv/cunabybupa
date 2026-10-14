import type { Metadata } from 'next'
import { AdminView } from '@/components/cuna/admin/admin-view'

export const metadata: Metadata = { title: 'Administración' }

export default function AdminPage() {
  return <AdminView />
}
