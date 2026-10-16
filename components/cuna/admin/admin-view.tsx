'use client'

import { useState } from 'react'
import { useMe } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { Notice } from '@/components/cuna/ui'
import { StaffAdmin } from '@/components/cuna/admin/staff-admin'
import { CatalogAdmin } from '@/components/cuna/admin/catalog-admin'
import { BookFieldsAdmin } from '@/components/cuna/admin/book-fields-admin'
import { PanelTargetsAdmin } from '@/components/cuna/admin/panel-targets-admin'
import { AuditAdmin, SettingsAdmin } from '@/components/cuna/admin/settings-audit-admin'

const TABS = [
  { key: 'personal', label: 'Personal' },
  { key: 'catalogos', label: 'Catálogos' },
  { key: 'libro', label: 'Libro de Partos' },
  { key: 'ajustes', label: 'Ajustes' },
  { key: 'auditoria', label: 'Auditoría' },
] as const

export function AdminView() {
  const { data: me } = useMe()
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('personal')

  if (me && !me.canAdmin) return <Notice tone="danger" title="Solo jefatura puede entrar a Administración." />

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-navy sm:text-3xl">Administración</h1>
      <div role="tablist" aria-label="Administración" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'h-12 shrink-0 rounded-full border px-5 text-base font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
              tab === t.key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-card text-foreground hover:bg-muted',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'personal' ? <StaffAdmin /> : null}
        {tab === 'catalogos' ? <CatalogAdmin /> : null}
        {tab === 'libro' ? <BookFieldsAdmin /> : null}
        {tab === 'ajustes' ? (
          <div className="flex flex-col gap-6">
            <SettingsAdmin />
            <PanelTargetsAdmin />
          </div>
        ) : null}
        {tab === 'auditoria' ? <AuditAdmin /> : null}
      </div>
    </div>
  )
}
