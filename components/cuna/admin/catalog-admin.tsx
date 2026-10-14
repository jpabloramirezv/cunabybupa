'use client'

import { useState } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { CATALOG_KINDS } from '@/lib/config'
import { ApiError, fetcher, send } from '@/lib/fetcher'
import type { CatalogsPayload } from '@/lib/types'
import { haystackOf, matchesAll, parseQuery } from '@/lib/search'
import { Highlight } from '@/components/cuna/highlight'
import { ChipToggle, SearchField } from '@/components/cuna/search-field'
import { Choice, Notice, PrimaryButton, Section, TextField } from '@/components/cuna/ui'

const KIND_OPTIONS = [
  ...CATALOG_KINDS.map((k) => ({ value: k.key as string, label: k.label })),
  { value: 'diagnosis', label: 'Diagnósticos' },
]

export function CatalogAdmin() {
  const { data } = useSWR<CatalogsPayload>('/api/catalogs', fetcher)
  const [kind, setKind] = useState<string | null>('prevision')
  const [label, setLabel] = useState('')
  const [code, setCode] = useState('')
  const [synonyms, setSynonyms] = useState('')
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null)

  const [editId, setEditId] = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editSynonyms, setEditSynonyms] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'activo' | 'inactivo' | null>(null)

  const isDx = kind === 'diagnosis'
  const isDoctors = kind === 'profesional'
  const allRows = isDx
    ? (data?.diagnoses ?? []).map((d) => ({
        id: d.id,
        code: d.code,
        name: d.name,
        synonyms: d.synonyms,
        text: `${d.code} · ${d.name}`,
        search: `${d.code} ${d.name} ${d.synonyms.join(' ')}`,
        active: d.active,
      }))
    : (data?.items ?? [])
        .filter((i) => i.kind === kind)
        .map((i) => ({
          id: i.id,
          code: '',
          name: i.label,
          synonyms: [] as string[],
          text: i.label,
          search: i.label,
          active: i.active,
        }))
  const terms = parseQuery(query)
  const rows = allRows.filter(
    (r) =>
      (!statusFilter || (statusFilter === 'activo') === r.active) &&
      matchesAll(haystackOf(r.search, true), terms),
  )

  async function run(fn: () => Promise<unknown>, ok: string) {
    setMessage(null)
    try {
      await fn()
      await globalMutate('/api/catalogs')
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
      <Choice
        label="Catálogo"
        columns={2}
        options={KIND_OPTIONS}
        value={kind}
        onChange={(v) => {
          setKind(v)
          setEditId(null)
          setQuery('')
          setStatusFilter(null)
        }}
      />

      <Section title="Opciones" hint="Desactivar oculta la opción en los formularios; los registros antiguos la conservan.">
        {allRows.length > 0 ? (
          <div className="flex flex-col gap-3">
            <SearchField
              id="catalog-search"
              label="Buscar opciones"
              placeholder={isDx ? 'Buscar por código, nombre o sinónimo' : 'Buscar opción'}
              value={query}
              onChange={setQuery}
            />
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por estado">
              <ChipToggle pressed={statusFilter === 'activo'} onClick={() => setStatusFilter(statusFilter === 'activo' ? null : 'activo')}>
                Activas
              </ChipToggle>
              <ChipToggle pressed={statusFilter === 'inactivo'} onClick={() => setStatusFilter(statusFilter === 'inactivo' ? null : 'inactivo')}>
                Inactivas
              </ChipToggle>
              <span className="ml-1 text-sm text-muted-foreground" aria-live="polite">
                {rows.length} de {allRows.length}
              </span>
            </div>
          </div>
        ) : null}
        <ul className="flex flex-col divide-y divide-border">
          {allRows.length === 0 ? <li className="py-4 text-sm text-muted-foreground">Sin opciones todavía.</li> : null}
          {allRows.length > 0 && rows.length === 0 ? (
            <li className="py-4 text-sm text-muted-foreground">Ninguna opción coincide con la búsqueda.</li>
          ) : null}
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className={r.active ? 'text-base text-foreground' : 'text-base text-muted-foreground line-through'}>
                  <Highlight text={r.text} terms={terms} ignorePunct={isDx} />
                </span>
                <div className={isDoctors ? 'hidden' : 'flex flex-wrap gap-2'}>
                  <PrimaryButton
                    variant="outline"
                    className="h-11 px-4 text-sm"
                    onClick={() => {
                      if (editId === r.id) {
                        setEditId(null)
                        return
                      }
                      setEditId(r.id)
                      setEditLabel(r.name)
                      setEditCode(r.code)
                      setEditSynonyms(r.synonyms.join(', '))
                    }}
                  >
                    Editar
                  </PrimaryButton>
                  <PrimaryButton
                    variant="ghost"
                    className="h-11 px-4 text-sm"
                    onClick={() =>
                      run(
                        () => send('/api/admin/catalog', 'PATCH', { kind, id: r.id, active: !r.active }),
                        r.active ? 'Opción desactivada.' : 'Opción activada.',
                      )
                    }
                  >
                    {r.active ? 'Desactivar' : 'Activar'}
                  </PrimaryButton>
                </div>
              </div>
              {editId === r.id ? (
                <div className="flex flex-col gap-3 rounded-lg bg-muted p-4">
                  {isDx ? <TextField label="Código" required maxLength={12} value={editCode} onChange={setEditCode} /> : null}
                  <TextField label="Nombre" required value={editLabel} onChange={setEditLabel} />
                  {isDx ? (
                    <TextField label="Sinónimos" hint="Separados por coma." value={editSynonyms} onChange={setEditSynonyms} />
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <PrimaryButton
                      disabled={!editLabel.trim() || (isDx && !editCode.trim())}
                      onClick={async () => {
                        const body = isDx
                          ? {
                              kind,
                              id: r.id,
                              code: editCode,
                              name: editLabel,
                              synonyms: editSynonyms.split(',').map((s) => s.trim()).filter(Boolean),
                            }
                          : { kind, id: r.id, label: editLabel }
                        if (await run(() => send('/api/admin/catalog', 'PATCH', body), 'Opción actualizada.')) setEditId(null)
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
            </li>
          ))}
        </ul>
      </Section>

      {isDoctors ? (
        <Notice tone="info" title="Los médicos tratantes se administran en Personal">
          Solo aparecen las personas inscritas con rol Médico o Médico Jefe. Para agregar, renombrar o desactivar un
          médico, hazlo en la pestaña Personal.
        </Notice>
      ) : null}

      <Section title="Agregar opción" className={isDoctors ? 'hidden' : undefined}>
        {isDx ? (
          <>
            <TextField label="Código" required maxLength={12} value={code} onChange={setCode} placeholder="P07.3" />
            <TextField label="Nombre" required value={label} onChange={setLabel} />
            <TextField
              label="Sinónimos"
              hint="Separados por coma. Ayudan a encontrar el diagnóstico al escribir."
              value={synonyms}
              onChange={setSynonyms}
            />
          </>
        ) : (
          <TextField label="Nombre" required value={label} onChange={setLabel} />
        )}
        <PrimaryButton
          disabled={!kind || !label.trim() || (isDx && !code.trim())}
          onClick={async () => {
            const body = isDx
              ? { kind, code, name: label, synonyms: synonyms.split(',').map((s) => s.trim()).filter(Boolean) }
              : { kind, label }
            if (await run(() => send('/api/admin/catalog', 'POST', body), 'Opción agregada.')) {
              setLabel('')
              setCode('')
              setSynonyms('')
            }
          }}
        >
          Agregar
        </PrimaryButton>
      </Section>
    </div>
  )
}
