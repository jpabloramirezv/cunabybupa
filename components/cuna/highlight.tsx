import { findRanges } from '@/lib/search'

/** Marca en el texto las palabras buscadas, sin importar tildes ni mayúsculas. */
export function Highlight({
  text,
  terms,
  ignorePunct,
}: {
  text: string | null | undefined
  terms: string[]
  ignorePunct?: boolean
}) {
  if (!text) return null
  if (terms.length === 0) return <>{text}</>
  const ranges = findRanges(text, terms, ignorePunct)
  if (ranges.length === 0) return <>{text}</>
  const out: React.ReactNode[] = []
  let at = 0
  ranges.forEach(([s, e], i) => {
    if (s > at) out.push(text.slice(at, s))
    out.push(
      <mark key={i} className="rounded-sm bg-primary/15 px-0.5 text-inherit">
        {text.slice(s, e)}
      </mark>,
    )
    at = e
  })
  if (at < text.length) out.push(text.slice(at))
  return <>{out}</>
}
