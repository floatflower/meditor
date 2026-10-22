import { diff } from '@codemirror/merge'

/*
 * Line-level review of the changes between a baseline and the document.
 *
 * Every changed line is a unit that can be accepted (it becomes part of the baseline) or rejected
 * (the document is put back the way the baseline had it):
 *   mod  an old line replaced by a new one      accept: baseline takes the new line  reject: document takes the old line
 *   add  a line that only exists in the document  accept: baseline gains it             reject: line is removed
 *   del  a line that only exists in the baseline  accept: baseline drops it             reject: line is put back
 * Units are recomputed from the two texts after every operation, so nothing here keeps state.
 */

export type UnitKind = 'mod' | 'add' | 'del'

export interface Unit {
  kind: UnitKind
  /** Baseline line: the old line (mod, del), or where an accepted line would be inserted (add). */
  a: number
  /** Document line: the new line (mod, add), or the line a deleted row is shown above (del). */
  b: number
}

export interface TextChange {
  from: number
  to: number
  insert: string
}

// Each distinct line becomes one character so a character diff is a line diff. Surrogates are skipped.
const FIRST_CHAR = 0x100
const MAX_DISTINCT_LINES = 0xd7ff - FIRST_CHAR

function encode(lines: readonly string[], ids: Map<string, number>): string {
  let out = ''
  const codes: number[] = []
  const flush = (): void => {
    out += String.fromCharCode(...codes)
    codes.length = 0
  }
  for (const line of lines) {
    let id = ids.get(line)
    if (id === undefined) {
      id = ids.size
      ids.set(line, id)
    }
    codes.push(FIRST_CHAR + id)
    if (codes.length >= 8192) flush() // spreading a huge array into one call would overflow the stack
  }
  flush()
  return out
}

/** The reviewable units, in document order. Null when the texts have too many distinct lines to compare. */
export function computeUnits(base: readonly string[], doc: readonly string[]): Unit[] | null {
  const ids = new Map<string, number>()
  const a = encode(base, ids)
  const b = encode(doc, ids)
  if (ids.size > MAX_DISTINCT_LINES) return null
  if (a === b) return []

  const units: Unit[] = []
  for (const c of diff(a, b, { scanLimit: 5000 })) {
    const removed = c.toA - c.fromA
    const added = c.toB - c.fromB
    const paired = Math.min(removed, added)
    for (let i = 0; i < paired; i++) units.push({ kind: 'mod', a: c.fromA + i, b: c.fromB + i })
    for (let i = paired; i < added; i++) units.push({ kind: 'add', a: c.toA, b: c.fromB + i })
    for (let i = paired; i < removed; i++) units.push({ kind: 'del', a: c.fromA + i, b: c.toB })
  }
  return units
}

/** Accepting changes the baseline only; this returns the new baseline lines. */
export function acceptChange(base: readonly string[], doc: readonly string[], u: Unit): string[] {
  const next = [...base]
  if (u.kind === 'mod') next[u.a] = doc[u.b]
  else if (u.kind === 'add') next.splice(u.a, 0, doc[u.b])
  else next.splice(u.a, 1)
  return next.length ? next : [''] // an empty text is still one (empty) line
}

/** Rejecting changes the document only; this returns the edit to make to the document text. */
export function rejectChange(base: readonly string[], doc: readonly string[], u: Unit): TextChange {
  const start = (line: number): number => doc.slice(0, line).reduce((n, l) => n + l.length + 1, 0)
  const end = start(doc.length) - 1 // length of the whole text (every line but the last is followed by "\n")

  if (u.kind === 'mod') {
    const from = start(u.b)
    return { from, to: from + doc[u.b].length, insert: base[u.a] }
  }
  if (u.kind === 'add') {
    if (u.b < doc.length - 1) return { from: start(u.b), to: start(u.b + 1), insert: '' }
    // The last line has no newline after it, so take the one before it instead.
    return doc.length === 1 ? { from: 0, to: end, insert: '' } : { from: start(u.b) - 1, to: end, insert: '' }
  }
  // del: put the old line back above document line `b`, or at the very end
  return u.b < doc.length
    ? { from: start(u.b), to: start(u.b), insert: `${base[u.a]}\n` }
    : { from: end, to: end, insert: `\n${base[u.a]}` }
}

export const applyChange = (text: string, c: TextChange): string => text.slice(0, c.from) + c.insert + text.slice(c.to)
