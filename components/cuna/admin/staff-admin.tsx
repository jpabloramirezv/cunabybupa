'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ApiError, fetcher, send } from '@/lib/fetcher'
import { fmtDateTime } from '@/lib/time'
import { haystackOf, matchesAll, parseQuery } from '@/lib/search'
import { Highlight } from '@/components/cuna/highlight'
import { ChipToggle, SearchField } from '@/components/cuna/search-field'
import { Choice, Notice, PrimaryButton, Section, TextField } from '@/components/cuna/ui'

type StaffRow = { id: number; name: string; role: string; isAdmin: boolean; active: boolean; lockedUntil: string | null }

const ADMIN_OPTIONS = [
  { value: 'no', label: 'No' },
  { value: 'si', label: 'Sí, con permisos de Jefatura' },
]

const ROLES = [
  { value: 'matrona', label: 'Matrona' },
  { value: 'medico', label: 'Médico' },
  { value: 'medico_jefe', label: 'Médico Jefe' },
  { value: 'jefatura', label: 'Jefatura' },
  { value: 'analista', label: 'Analista' },
]
const roleLabel = (r: string) => ROLES.find((x) => x.value === r)?.label ?? r

export function StaffAdmin() {
  const { data, mutate } = useSWR<StaffRow[]>('/api/admin/staff', fetcher)
  const [name, setName] = useState('')
  const [role, setRole] = useState<string | null>('matrona')
  const [pin, setPin] = useState('')
  const [adminNew, setAdminNew] = useState<string | null>('no')
  const [editAdmin, setEditAdmin] = useState<string | null>('no')
  const [resetId, setResetId] = useState<number | null>(null)
  const [resetPin, setResetPin] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'activo' | 'inactivo' | null>(null)

  const terms = parseQuery(query)
  const visible = (data ?? []).filter((s) => {
    if (roleFilter && s.role !== roleFilter) return false
    if (statusFilter && (statusFilter === 'activo') !== s.active) return false
    return matchesAll(haystackOf(`${s.name} ${roleLabel(s.role)} ${s.active ? 'activo' : 'inactivo'}`), terms)
  })
  const filtering = terms.length > 0 || !!roleFilter || !!statusFilter

  async function run(fn: () => Promise<unknown>, ok: string) {
    setMessage(null)
    try {
      await fn()
      await mutate()
      setMessage({ tone: 'success', text: ok })
      return true
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof ApiError ? e.message : 'No pudimos guardar el cambio.' })
      return false
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {message ? <Notice tone={message.tone} title={message.text} /> : null}

      <Section title="Personal de la unidad" hint="Desactivar quita el acceso sin borrar el historial.">
        <div className="flex flex-col gap-3">
          <SearchField
            id="staff-search"
            label="Buscar personal"
            placeholder="Buscar por nombre, rol o estado"
            value={query}
            onChange={setQuery}
          />
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros de personal">
            {ROLES.map((r) => (
              <ChipToggle key={r.value} pressed={roleFilter === r.value} onClick={() => setRoleFilter(roleFilter === r.value ? null : r.value)}>
                {r.label}
              </ChipToggle>
            ))}
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            <ChipToggle pressed={statusFilter === 'activo'} onClick={() => setStatusFilter(statusFilter === 'activo' ? null : 'activo')}>
              Activos
            </ChipToggle>
            <ChipToggle pressed={statusFilter === 'inactivo'} onClick={() => setStatusFilter(statusFilter === 'inactivo' ? null : 'inactivo')}>
              Inactivos
            </ChipToggle>
            {filtering ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setRoleFilter(null)
                  setStatusFilter(null)
                }}
                className="h-9 rounded-full px-3 text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
              >
                Limpiar
              </button>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {visible.length} de {data?.length ?? 0} personas
          </p>
        </div>
        <ul className="flex flex-col divide-y divide-border">
          {data && visible.length === 0 ? (
            <li className="py-6 text-center text-sm text-muted-foreground">Nadie coincide con la búsqueda.</li>
          ) : null}
          {visible.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-foreground">
                    <Highlight text={s.name} terms={terms} />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {roleLabel(s.role)}
                    {s.role === 'matrona' && s.isAdmin ? ' · Permisos de Jefatura' : ''} · {s.active ? 'Activo' : 'Inactivo'}
                    {s.lockedUntil && new Date(s.lockedUntil) > new Date() ? ` · Bloqueado hasta ${fmtDateTime(s.lockedUntil)}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PrimaryButton
                    variant="outline"
                    className="h-11 px-4 text-sm"
                    onClick={() => {
                      if (editId === s.id) {
                        setEditId(null)
                        return
                      }
                      setEditId(s.id)
                      setEditName(s.name)
                      setEditRole(s.role)
                      setEditAdmin(s.isAdmin ? 'si' : 'no')
                      setResetId(null)
                    }}
                  >
                    Editar
                  </PrimaryButton>
                  <PrimaryButton
                    variant="outline"
                    className="h-11 px-4 text-sm"
                    onClick={() => {
                      setEditId(null)
                      setResetId(resetId === s.id ? null : s.id)
                      setResetPin('')
                    }}
                  >
                    Cambiar PIN
                  </PrimaryButton>
                  <PrimaryButton
                    variant="ghost"
                    className="h-11 px-4 text-sm"
                    onClick={() =>
                      run(() => send('/api/admin/staff', 'PATCH', { id: s.id, active: !s.active }), s.active ? 'Persona desactivada.' : 'Persona activada.')
                    }
                  >
                    {s.active ? 'Desactivar' : 'Activar'}
                  </PrimaryButton>
                </div>
              </div>
              {editId === s.id ? (
                <div className="flex flex-col gap-3 rounded-lg bg-muted p-4">
                  <TextField label="Nombre" required maxLength={80} value={editName} onChange={setEditName} />
                  <Choice label="Cargo (rol)" required columns={2} options={ROLES} value={editRole} onChange={setEditRole} />
                  {editRole === 'matrona' ? (
                    <Choice
                      label="¿Tiene permisos de Jefatura?"
                      columns={2}
                      options={ADMIN_OPTIONS}
                      value={editAdmin}
                      onChange={setEditAdmin}
                      hint="Sigue figurando solo como Matrona en sus registros, con los mismos permisos que una Jefatura."
                    />
                  ) : null}
                  <p className="text-sm text-muted-foreground">
                    El cambio se aplica a todos los dispositivos. Lo ya firmado en registros anteriores conserva el nombre con que se guardó.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <PrimaryButton
                      disabled={
                        !editName.trim() ||
                        !editRole ||
                        (editName.trim() === s.name && editRole === s.role && (editRole !== 'matrona' || (editAdmin === 'si') === s.isAdmin))
                      }
                      onClick={async () => {
                        const body: Record<string, unknown> = { id: s.id }
                        if (editName.trim() !== s.name) body.name = editName.trim()
                        if (editRole !== s.role) body.role = editRole
                        if (editRole === 'matrona' && (editAdmin === 'si') !== s.isAdmin) body.isAdmin = editAdmin === 'si'
                        if (await run(() => send('/api/admin/staff', 'PATCH', body), 'Datos de la persona actualizados.')) setEditId(null)
                      }}
                    >
                      Guardar cambios
                    </PrimaryButton>
                    <PrimaryButton variant="ghost" onClick={() => setEditId(null)}>
                      Cancelar
                    </PrimaryButton>
                  </div>
                </div>
              ) : null}
              {resetId === s.id ? (
                <div className="flex flex-col gap-3 rounded-lg bg-muted p-4 sm:flex-row sm:items-end">
                  <div className="sm:flex-1">
                    <TextField
                      label="Nuevo PIN (4 o 6 dígitos)"
                      inputMode="numeric"
                      maxLength={6}
                      type="password"
                      autoComplete="new-password"
                      value={resetPin}
                      onChange={(v) => setResetPin(v.replace(/\D/g, ''))}
                    />
                  </div>
                  <PrimaryButton
                    disabled={resetPin.length !== 4 && resetPin.length !== 6}
                    onClick={async () => {
                      if (await run(() => send('/api/admin/staff', 'PATCH', { id: s.id, pin: resetPin }), 'PIN actualizado.')) {
                        setResetId(null)
                        setResetPin('')
                      }
                    }}
                  >
                    Guardar PIN
                  </PrimaryButton>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Agregar persona">
        <TextField label="Nombre" required value={name} onChange={setName} />
        <Choice label="Rol" required columns={2} options={ROLES} value={role} onChange={setRole} />
        {role === 'matrona' ? (
          <Choice
            label="¿Tiene permisos de Jefatura?"
            columns={2}
            options={ADMIN_OPTIONS}
            value={adminNew}
            onChange={setAdminNew}
            hint="Sigue figurando solo como Matrona, con los mismos permisos que una Jefatura."
          />
        ) : null}
        <TextField
          label="PIN inicial (4 o 6 dígitos)"
          required
          inputMode="numeric"
          maxLength={6}
          type="password"
          autoComplete="new-password"
          value={pin}
          onChange={(v) => setPin(v.replace(/\D/g, ''))}
        />
        <PrimaryButton
          disabled={!name.trim() || !role || (pin.length !== 4 && pin.length !== 6)}
          onClick={async () => {
            if (await run(() => send('/api/admin/staff', 'POST', { name, role, pin, isAdmin: role === 'matrona' && adminNew === 'si' }), 'Persona agregada.')) {
              setName('')
              setAdminNew('no')
              setPin('')
            }
          }}
        >
          Agregar
        </PrimaryButton>
      </Section>
    </div>
  )
}
