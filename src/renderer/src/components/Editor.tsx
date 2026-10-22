import { useEffect, useImperativeHandle, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState, type ChangeSpec, type Extension } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { wrap, type EditorCommand } from '@/lib/editorCommands'
import { acceptAll, countChanges, dispatchReviewed, goToChange, rejectAll, reviewExtension, reviewField } from '@/lib/review'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'

export interface EditorHandle {
  /** Run a toolbar command against the editor and give focus back to it. */
  exec: (command: EditorCommand) => void
  /** Run `fn` against the view without moving focus (used for edits that do not come from the user). */
  withView: <T,>(fn: (view: EditorView) => T) => T | undefined
  /** Drop what is remembered about a document that has been closed. */
  forget: (docKey: string) => void
  /** Apply an edit that does not come from the user. With `review` on, it is shown as a diff to accept or reject. */
  applyEdit: (changes: ChangeSpec, review: boolean) => void
  acceptAll: () => void
  rejectAll: () => void
  goToChange: (direction: 1 | -1) => void
}

interface Props {
  ref?: React.Ref<EditorHandle>
  /** Only read the first time a `docKey` is seen; after that the editor owns that document's text. */
  value: string
  docKey: string
  onChange: (value: string) => void
  /** How many changes are waiting for review in this document. */
  onReview?: (docKey: string, changes: number) => void
}

interface Remembered {
  state: EditorState
  scrollTop: number
}

export default function Editor({ ref, value, docKey, onChange, onReview }: Props): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const extensions = useRef<Extension[]>([])
  // Each open document keeps its own state, so undo history and cursor survive switching tabs.
  const remembered = useRef(new Map<string, Remembered>())
  const currentKey = useRef(docKey)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onReviewRef = useRef(onReview)
  onReviewRef.current = onReview

  useImperativeHandle(ref, () => ({
    exec: (command) => {
      const v = view.current
      if (!v) return
      command(v)
      v.focus()
    },
    withView: (fn) => (view.current ? fn(view.current) : undefined),
    forget: (key) => {
      remembered.current.delete(key)
    },
    applyEdit: (changes, review) => {
      if (view.current) dispatchReviewed(view.current, changes, review)
    },
    acceptAll: () => view.current && acceptAll(view.current),
    rejectAll: () => view.current && rejectAll(view.current),
    goToChange: (direction) => view.current && goToChange(view.current, direction)
  }))

  useEffect(() => {
    extensions.current = [
      keymap.of([
        { key: 'Mod-b', run: (v) => (wrap('**')(v), true) },
        { key: 'Mod-i', run: (v) => (wrap('*')(v), true) },
        indentWithTab
      ]),
      basicSetup,
      reviewExtension,
      markdown({ codeLanguages: languages }),
      EditorView.lineWrapping,
      EditorView.theme({
        '&': { height: '100%', fontSize: '14px' },
        '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
      }),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) onChangeRef.current(u.state.doc.toString())
        if (u.docChanged || u.startState.field(reviewField) !== u.state.field(reviewField)) {
          onReviewRef.current?.(currentKey.current, countChanges(u.state))
        }
      })
    ]
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({ doc: value, extensions: extensions.current })
    })
    view.current = v
    return () => v.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Switching documents swaps the whole state; replacing it does not count as an edit.
  useEffect(() => {
    const v = view.current
    if (!v || currentKey.current === docKey) return
    remembered.current.set(currentKey.current, { state: v.state, scrollTop: v.scrollDOM.scrollTop })
    const next = remembered.current.get(docKey)
    v.setState(next?.state ?? EditorState.create({ doc: value, extensions: extensions.current }))
    currentKey.current = docKey
    onReviewRef.current?.(docKey, countChanges(v.state)) // setState does not notify listeners
    requestAnimationFrame(() => {
      v.scrollDOM.scrollTop = next?.scrollTop ?? 0
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey])

  return <div ref={host} className="h-full overflow-hidden [&_.cm-editor]:h-full" />
}
