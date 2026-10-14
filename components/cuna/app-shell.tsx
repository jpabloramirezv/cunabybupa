'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { send } from '@/lib/fetcher'
import { clearOutbox } from '@/lib/outbox'
import { authClient } from '@/lib/auth-client'
import { Brand } from '@/components/cuna/brand'
import { SyncStatus } from '@/components/cuna/sync-status'
import { SyncManager } from '@/components/cuna/sync-manager'

type Props = {
  name: string
  roleLabel: string
  canClinical: boolean
  canPanel: boolean
  canReports: boolean
  canAdmin: boolean
  canBook?: boolean
  children: ReactNode
}

export function AppShell({ name, roleLabel, canClinical, canPanel, canReports, canAdmin, canBook = false, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [leaving, setLeaving] = useState(false)
  const [confirmingExit, setConfirmingExit] = useState(false)
  const [exiting, setExiting] = useState(false)

  type NavLink = { href: string; label: string }
  const groups = [
    {
      caption: 'Neonatología',
      links: [
        canClinical ? { href: '/pizarra', label: 'Pizarra' } : null,
        canClinical ? { href: '/turno', label: 'Mi turno' } : null,
      ],
    },
    {
      caption: 'Todos los nacimientos',
      links: [canBook ? { href: '/libro', label: 'Libro de Partos' } : null],
    },
    {
      caption: 'Análisis',
      links: [
        canPanel ? { href: '/panel', label: 'Panel' } : null,
        canReports ? { href: '/informes', label: 'Informes' } : null,
      ],
    },
    {
      caption: 'Gestión',
      links: [canAdmin ? { href: '/admin', label: 'Administración' } : null],
    },
  ]
    .map((g) => ({ caption: g.caption, links: g.links.filter((l): l is NavLink => l !== null) }))
    .filter((g) => g.links.length > 0)

  async function leave() {
    setLeaving(true)
    try {
      await send('/api/session/logout', 'POST')
    } finally {
      clearOutbox()
      router.replace('/personal')
      router.refresh()
    }
  }

  async function signOutUnit() {
    setExiting(true)
    try {
      await send('/api/session/logout', 'POST')
    } catch {
      // La sesión personal también expira sola; igual cerramos la cuenta.
    }
    try {
      await authClient.signOut()
    } finally {
      clearOutbox()
      window.location.replace('/acceso')
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SyncManager />
      <header className="bg-navy text-navy-foreground">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3">
          <Brand inverted />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-semibold">{name}</p>
              <p className="text-xs text-navy-foreground/80">{roleLabel}</p>
            </div>
            {confirmingExit ? (
              <div
                role="alertdialog"
                aria-label="Confirmar cierre de sesión"
                className="flex flex-wrap items-center gap-2 rounded-lg border border-navy-foreground/40 bg-navy-foreground/10 px-3 py-1.5"
              >
                <p className="text-sm font-medium">¿Cerrar la sesión de la unidad?</p>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirmingExit(false)}
                  disabled={exiting}
                  className="h-9 rounded-md border border-navy-foreground/40 px-3 text-sm font-semibold hover:bg-navy-foreground/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={signOutUnit}
                  disabled={exiting}
                  className="flex h-9 items-center gap-2 rounded-md bg-magenta px-3 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40 disabled:opacity-60"
                >
                  <LogOut className="size-4" aria-hidden />
                  {exiting ? 'Cerrando…' : 'Cerrar sesión'}
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={leave}
                  disabled={leaving}
                  className="flex h-11 items-center gap-2 rounded-lg border border-navy-foreground/40 px-4 text-sm font-semibold hover:bg-navy-foreground/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40 disabled:opacity-60"
                >
                  <LogOut className="size-4" aria-hidden />
                  Cambiar persona
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingExit(true)}
                  className="flex h-11 items-center gap-2 rounded-lg bg-navy-foreground/10 px-4 text-sm font-semibold hover:bg-navy-foreground/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
                >
                  Cerrar sesión
                </button>
              </>
            )}
          </div>
        </div>
        <div className="border-t border-navy-foreground/15">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4">
            <nav aria-label="Principal" className="-mb-px flex flex-wrap gap-x-2">
              {groups.map((g, gi) => (
                <div
                  key={g.caption}
                  role="group"
                  aria-label={g.caption}
                  className={cn('flex flex-col pt-1.5', gi > 0 && 'border-l border-navy-foreground/15 pl-2')}
                >
                  <span className="px-4 text-[10px] font-bold uppercase tracking-wider text-navy-foreground/55">
                    {g.caption}
                  </span>
                  <div className="flex">
                    {g.links.map((l) => {
                      const active = pathname === l.href || pathname.startsWith(`${l.href}/`)
                      return (
                        <Link
                          key={l.href}
                          href={l.href}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex h-10 items-center border-b-4 px-4 text-base font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40',
                            active
                              ? 'border-magenta text-navy-foreground'
                              : 'border-transparent text-navy-foreground/75 hover:text-navy-foreground',
                          )}
                        >
                          {l.label}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>
            <SyncStatus />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  )
}
