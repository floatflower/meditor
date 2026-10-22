import { StateEffect, StateField, Text, type ChangeSpec, type EditorState, type Range } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'
import { i18n } from '@/i18n'
import { acceptChange, computeUnits, rejectChange, type Unit } from './reviewCore'

/*
 * Shows the difference between the document and a baseline, git-diff style, with accept / reject
 * on every changed line. The baseline lives in the editor state, so each open tab keeps its own.
 * The comparison itself is in reviewCore.ts.
 */

/** Start (or, with null, end) a review against this text. */
export const setBaseline = StateEffect.define<Text | null>()

interface Review {
  base: Text | null
  baseLines: string[]
  docLines: string[]
  units: Unit[]
  decorations: DecorationSet
}

const NONE: Review = { base: null, baseLines: [], docLines: [], units: [], decorations: Decoration.none }

const sameUnit = (a: Unit, b: Unit): boolean => a.kind === b.kind && a.a === b.a && a.b === b.b

function controls(view: EditorView, unit: Unit): HTMLElement {
  const box = document.createElement('span')
  box.className = 'cm-review-controls'
  const button = (cls: string, glyph: string, label: string, action: (v: EditorView, u: Unit) => void): HTMLElement => {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = cls
    el.textContent = glyph
    el.title = label
    el.setAttribute('aria-label', label)
    el.addEventListener('mousedown', (e) => e.preventDefault()) // keep the cursor where it is
    el.addEventListener('click', (e) => {
      e.preventDefault()
      action(view, unit)
    })
    return el
  }
  box.append(
    button('cm-review-accept', '✓', i18n.t('review.acceptLine'), acceptUnit),
    button('cm-review-reject', '✕', i18n.t('review.rejectLine'), rejectUnit)
  )
  return box
}

/** The accept / reject buttons at the end of a changed line. */
class ControlsWidget extends WidgetType {
  constructor(readonly unit: Unit) {
    super()
  }
  eq(other: ControlsWidget): boolean {
    return sameUnit(this.unit, other.unit)
  }
  toDOM(view: EditorView): HTMLElement {
    return controls(view, this.unit)
  }
  ignoreEvent(): boolean {
    return true
  }
}

/** A line the baseline has and the document does not (or has changed), shown above where it was. */
class OldLineWidget extends WidgetType {
  constructor(
    readonly text: string,
    readonly unit: Unit
  ) {
    super()
  }
  eq(other: OldLineWidget): boolean {
    return this.text === other.text && sameUnit(this.unit, other.unit)
  }
  toDOM(view: EditorView): HTMLElement {
    const row = document.createElement('div')
    row.className = 'cm-review-old'
    const text = document.createElement('span')
    text.className = 'cm-review-old-text'
    text.textContent = this.text === '' ? ' ' : this.text
    row.append(text)
    // A replaced line is decided on its new line below; only a pure deletion has buttons here.
    if (this.unit.kind === 'del') row.append(controls(view, this.unit))
    return row
  }
  ignoreEvent(): boolean {
    return true
  }
  get estimatedHeight(): number {
    return 22
  }
}

function decorate(doc: Text, baseLines: string[], units: Unit[]): DecorationSet {
  const ranges: Range<Decoration>[] = []
  for (const u of units) {
    if (u.kind !== 'del') {
      const line = doc.line(u.b + 1)
      ranges.push(Decoration.line({ class: 'cm-review-added' }).range(line.from))
      ranges.push(Decoration.widget({ widget: new ControlsWidget(u), side: 1 }).range(line.to))
    }
    if (u.kind !== 'add') {
      const before = u.b < doc.lines
      ranges.push(
        Decoration.widget({ widget: new OldLineWidget(baseLines[u.a], u), block: true, side: before ? -1 : 1 }).range(
          before ? doc.line(u.b + 1).from : doc.length
        )
      )
    }
  }
  return Decoration.set(ranges, true)
}

export const reviewField = StateField.define<Review>({
  create: () => NONE,
  update(value, tr) {
    let base = value.base
    for (const effect of tr.effects) if (effect.is(setBaseline)) base = effect.value
    // Edited back to the baseline (or the last change was rejected): nothing left to review.
    if (base && tr.docChanged && base.eq(tr.newDoc)) base = null
    if (base === value.base && !tr.docChanged) return value
    if (!base) return NONE

    const baseLines = base.toJSON()
    const docLines = tr.newDoc.toJSON()
    const units = computeUnits(baseLines, docLines) ?? []
    return { base, baseLines, docLines, units, decorations: decorate(tr.newDoc, baseLines, units) }
  },
  provide: (field) => EditorView.decorations.from(field, (review) => review.decorations)
})

const theme = EditorView.baseTheme({
  '.cm-review-added': { backgroundColor: 'rgba(46, 160, 67, 0.15)', boxShadow: 'inset 3px 0 0 #2ea043' },
  '.cm-review-old': {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '0 2px 0 6px', // the right padding matches the buttons on the added lines
    color: '#82071e',
    backgroundColor: 'rgba(248, 81, 73, 0.14)',
    boxShadow: 'inset 3px 0 0 #f85149'
  },
  '.cm-review-old-text': { whiteSpace: 'pre-wrap', wordBreak: 'break-word', textDecoration: 'line-through', textDecorationColor: 'rgba(130, 7, 30, 0.4)' },
  '.cm-review-controls': { display: 'inline-flex', gap: '2px', float: 'right', marginLeft: '8px', userSelect: 'none', fontFamily: 'system-ui, sans-serif' },
  '.cm-review-old .cm-review-controls': { float: 'none', flex: 'none' },
  // Sized in em and border-box so a button is always shorter than the line it floats in: a float taller
  // than its line spills into the next one and pushes that line's own controls (or row) sideways.
  '.cm-review-controls button': {
    boxSizing: 'border-box',
    width: '1.3em',
    height: '1.3em',
    padding: '0',
    lineHeight: '1',
    fontSize: '0.85em',
    cursor: 'pointer',
    border: '1px solid rgba(0, 0, 0, 0.18)',
    borderRadius: '4px',
    backgroundColor: '#fff'
  },
  '.cm-review-accept': { color: '#1a7f37' },
  '.cm-review-reject': { color: '#cf222e' },
  '.cm-review-accept:hover': { backgroundColor: '#dcfce7' },
  '.cm-review-reject:hover': { backgroundColor: '#fee2e2' }
})

export const reviewExtension = [reviewField, theme]

export const countChanges = (state: EditorState): number => state.field(reviewField).units.length

/**
 * Apply an edit. With `review` on, the text before it becomes the baseline (unless a review is
 * already open), in the same transaction, so there is no moment with a baseline and no edit.
 */
export function dispatchReviewed(view: EditorView, changes: ChangeSpec, review: boolean): void {
  const needsBaseline = review && !view.state.field(reviewField).base
  view.dispatch({ changes, effects: needsBaseline ? setBaseline.of(view.state.doc) : [] })
}

export function acceptUnit(view: EditorView, unit: Unit): void {
  const { base, baseLines, docLines } = view.state.field(reviewField)
  if (!base) return
  const next = Text.of(acceptChange(baseLines, docLines, unit))
  view.dispatch({ effects: setBaseline.of(next.eq(view.state.doc) ? null : next) })
}

export function rejectUnit(view: EditorView, unit: Unit): void {
  const { base, baseLines, docLines } = view.state.field(reviewField)
  if (!base) return
  view.dispatch({ changes: rejectChange(baseLines, docLines, unit), userEvent: 'revert' })
}

export const acceptAll = (view: EditorView): void => view.dispatch({ effects: setBaseline.of(null) })

export function rejectAll(view: EditorView): void {
  const { base } = view.state.field(reviewField)
  if (base) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: base.toString() }, userEvent: 'revert' })
}

/** Move the cursor to the next (1) or previous (-1) change, wrapping around. */
export function goToChange(view: EditorView, direction: 1 | -1): void {
  const { units } = view.state.field(reviewField)
  if (!units.length) return
  const here = view.state.doc.lineAt(view.state.selection.main.head).number - 1
  const target =
    direction === 1 ? (units.find((u) => u.b > here) ?? units[0]) : ([...units].reverse().find((u) => u.b < here) ?? units[units.length - 1])
  const line = view.state.doc.line(Math.min(target.b, view.state.doc.lines - 1) + 1)
  view.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: 'center' }) })
  view.focus()
}
