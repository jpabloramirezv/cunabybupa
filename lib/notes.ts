export type NoteKind = 'siguiente' | 'recordatorio' | 'constancia'

export const NOTE_KINDS: readonly {
  value: NoteKind
  label: string
  hint: string
  /** Se puede marcar como hecho cuando alguien lo resuelve. */
  actionable: boolean
}[] = [
  {
    value: 'siguiente',
    label: 'Para el turno siguiente',
    hint: 'Algo que el próximo turno debe completar o tener presente.',
    actionable: true,
  },
  {
    value: 'recordatorio',
    label: 'Recordatorio',
    hint: 'Una tarea pendiente que no debe olvidarse.',
    actionable: true,
  },
  {
    value: 'constancia',
    label: 'Constancia',
    hint: 'Queda escrito para el equipo, como una anotación del libro.',
    actionable: false,
  },
]

export const NOTE_MAX_LENGTH = 500

export const isNoteKind = (v: unknown): v is NoteKind => NOTE_KINDS.some((k) => k.value === v)

export const noteKindLabel = (kind: string) => NOTE_KINDS.find((k) => k.value === kind)?.label ?? kind

export const isActionable = (kind: string) => NOTE_KINDS.find((k) => k.value === kind)?.actionable ?? false

/** Patrón de RUT chileno: el mural es visible para todo el equipo y no debe contener identificación. */
export const RUT_LIKE = /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/

export type Note = {
  id: number
  kind: NoteKind
  body: string
  shiftKey: string
  authorName: string
  authorRole: string | null
  createdAt: string
  resolvedAt: string | null
  resolvedByName: string | null
  mine: boolean
  read: boolean
  canDelete: boolean
}

export type NotesPayload = {
  notes: Note[]
  unread: number
}
