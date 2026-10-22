import { useEffect, useImperativeHandle, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { Annotation } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { wrap, type EditorCommand } from '@/lib/editorCommands'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'

/** Marks a transaction that swaps in a whole new document, which is not a user edit. */
const documentSwap = Annotation.define<boolean>()

export interface EditorHandle {
  /** Run a toolbar command against the editor and give focus back to it. */
  exec: (command: EditorCommand) => void
  /** Run `fn` against the view without moving focus (used for edits that do not come from the user). */
  withView: <T,>(fn: (view: EditorView) => T) => T | undefined
}

interface Props {
  ref?: React.Ref<EditorHandle>
  /** Only read when `docKey` changes; afterwards the editor owns the text. */
  value: string
  docKey: string
  onChange: (value: string) => void
}

export default function Editor({ ref, value, docKey, onChange }: Props): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useImperativeHandle(ref, () => ({
    exec: (command) => {
      const v = view.current
      if (!v) return
      command(v)
      v.focus()
    },
    withView: (fn) => (view.current ? fn(view.current) : undefined)
  }))

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      doc: value,
      extensions: [
        keymap.of([
          { key: 'Mod-b', run: (v) => (wrap('**')(v), true) },
          { key: 'Mod-i', run: (v) => (wrap('*')(v), true) },
          indentWithTab
        ]),
        basicSetup,
        markdown({ codeLanguages: languages }),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': { height: '100%', fontSize: '14px' },
          '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
        }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged && !u.transactions.some((t) => t.annotation(documentSwap))) {
            onChangeRef.current(u.state.doc.toString())
          }
        })
      ]
    })
    view.current = v
    return () => v.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Swap the whole document when a different file is opened.
  useEffect(() => {
    const v = view.current
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value }, annotations: documentSwap.of(true) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey])

  return <div ref={host} className="h-full overflow-hidden [&_.cm-editor]:h-full" />
}
