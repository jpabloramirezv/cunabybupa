'use client'

import { useMemo, useState } from 'react'
import { FilePlus2, Link2, X } from 'lucide-react'
import { BOOK_SECTION_LABEL, type BookSection } from '@/lib/book-fields'
import { linkCode, type SectionProgress } from '@/lib/book-flow'
import { haystackOf, matchesAll, parseQuery } from '@/lib/search'
import type { BookRecordOut } from '@/lib/server/book'
import { cn } from '@/lib/utils'
import { PrimaryButton } from '@/components/cuna/ui'
import { SearchField } from '@/components/cuna/search-field'

export type LinkCandidate = { record: BookRecordOut; progress: SectionProgress }

const motherOf = (v: Record<string, string>) =>
  [v.nombre, v.ap_paterno, v.ap_materno].filter(Boolean).join(' ') || 'Madre sin nombre'

/**
 * Paso previo a crear una fila: muestra las filas que están esperando la parte de quien registra,
 * para que Maternidad y Neonatología completen la misma fila en cualquier orden.
 */
export function RecordLinker({
  section,
  candidates,
  onPick,
  onNew,
  onCancel,
}: {
  section: BookSection
  candidates: LinkCandidate[]
  onPick: (r: BookRecordOut) => void
  onNew: () => void
  onCancel: () => void
}) {
  const [q, setQ] = useState('')
  const other = section === 'neonatal' ? 'Maternidad' : 'Neonatología'
  const terms = parseQuery(q)

  const shown = useMemo(() => {
    const rank = (c: LinkCandidate) => (c.progress.state === 'pendiente' ? 0 : 1)
    return [...candidates]
      .filter((c) =>
        matchesAll(
          haystackOf(`${Object.values(c.record.values).join(' ')} ${linkCode(c.record.seq)} ${c.record.episodeCode ?? ''}`),
          terms,
        ),
      )
      .sort((a, b) => rank(a) - rank(b) || b.record.seq - a.record.seq)
      .slice(0, q ? 20 : 6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, q])

  return (
    <section
      aria-label="Elegir fila existente o crear una nueva"
      className="flex flex-col gap-5 rounded-2xl border border-primary/30 bg-card p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            Antes de empezar · {BOOK_SECTION_LABEL[section]}
          </p>
          <h2 className="mt-1 text-xl font-bold text-navy text-balance">¿Esta fila ya la empezó {other}?</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
            Una fila es un recién nacido. Si {other} ya empezó a llenarla, elígela y continúa donde quedó. Si no, crea una
            fila nueva; la otra unidad podrá completarla después.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancelar"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <SearchField
        id="book-link-search"
        label="Buscar la fila"
        placeholder="RUT, nombre o apellido de la madre, fecha o código (LP-00012)"
        value={q}
        onChange={setQ}
      />

      <ul className="flex flex-col gap-2">
        {shown.length === 0 ? (
          <li className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            {q ? 'Ninguna fila pendiente coincide. Prueba con otro dato o crea una fila nueva.' : 'No hay filas esperando.'}
          </li>
        ) : null}
        {shown.map(({ record: r, progress }) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onPick(r)}
              className="flex w-full items-center gap-4 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-xs font-bold tabular-nums text-muted-foreground">{linkCode(r.seq)}</span>
                  <span className="truncate text-base font-semibold text-foreground">{motherOf(r.values)}</span>
                  {r.values.rut ? <span className="text-sm text-muted-foreground">{r.values.rut}</span> : null}
                </span>
                <span className="text-sm text-muted-foreground">
                  {[r.values.fecha, r.values.hora, r.values.tipo_parto, r.episodeCode ? `UCI ${r.episodeCode}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span
                className={cn(
                  'shrink-0 rounded-full px-3 py-1 text-xs font-semibold',
                  progress.state === 'pendiente' ? 'bg-warning text-warning-foreground' : 'bg-secondary text-secondary-foreground',
                )}
              >
                {progress.state === 'pendiente'
                  ? `Falta ${BOOK_SECTION_LABEL[section]}`
                  : `${BOOK_SECTION_LABEL[section]} ${progress.filled}/${progress.total}`}
              </span>
              <Link2 className="size-5 shrink-0 text-primary" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {!q && candidates.length > 6 ? (
        <p className="text-sm text-muted-foreground">
          Mostrando las 6 más recientes de {candidates.length}. Usa el buscador para encontrar otra.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <PrimaryButton variant="accent" onClick={onNew}>
          <FilePlus2 className="size-5" aria-hidden />
          Es un registro nuevo
        </PrimaryButton>
        <PrimaryButton variant="ghost" onClick={onCancel}>
          Cancelar
        </PrimaryButton>
      </div>
    </section>
  )
}
