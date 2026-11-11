import { DEFAULT_BOOK_FIELDS } from '@/lib/book-fields'

/**
 * Preguntas que trae el libro desde el inicio. Otras partes del sistema las leen por su clave
 * (vínculo con la ficha, búsqueda de duplicados, informes), así que se pueden desactivar pero no eliminar.
 * `paridad_n` se agregó después con una migración.
 */
const PROTECTED = new Set<string>([...DEFAULT_BOOK_FIELDS.map((f) => f.key), 'paridad_n'])

export const isProtectedBookKey = (key: string) => PROTECTED.has(key)
