import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePanelRef } from 'react-resizable-panels'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { TooltipProvider } from '@/components/ui/tooltip'
import Editor, { type EditorHandle } from '@/components/Editor'
import Header, { type ViewMode } from '@/components/Header'
import Preview from '@/components/Preview'
import { builtinThemes, type Theme } from '@/lib/themes'
import { loadPlugins, type PluginEntry } from '@/lib/plugins'
import { buildExportHtml } from '@/lib/export'
import { buildSyntaxGuide } from '@/lib/syntaxGuide'
import type { MdPlugin } from '@/lib/markdown'
import type { MenuAction } from '../../main/menu'

const WELCOME = `# Hello mdeditor

支援 GFM、程式碼高亮與 mermaid：

\`\`\`ts
const greet = (name: string) => \`Hello, \${name}\`
\`\`\`

\`\`\`mermaid
graph LR
  A[Markdown] --> B(unified) --> C[HTML / PDF]
\`\`\`

| 功能 | 狀態 |
| --- | --- |
| 自訂 theme | ✅ |
| LaTeX | ✅ |
| plugin | ✅ |

行內公式 $E = mc^2$，區塊公式：

$$
\\int_0^1 x^2\\,dx = \\frac{1}{3}
$$

:::chart{type=bar title="月營收"}
| 月份 | 2024 | 2025 |
| --- | --- | --- |
| 1 月 | 10 | 12 |
| 2 月 | 20 | 18 |
| 3 月 | 15 | 25 |
:::

:::note
這是內建的 \`:::note\` 提示區塊。
:::
`

const THEME_KEY = 'mdeditor.theme'
const DISABLED_PLUGINS_KEY = 'mdeditor.disabledPlugins'

function readDisabledPlugins(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISABLED_PLUGINS_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

function readSavedTheme(): string {
  try {
    return localStorage.getItem(THEME_KEY) ?? 'Default'
  } catch {
    return 'Default'
  }
}

export default function App(): React.JSX.Element {
  const [doc, setDoc] = useState({ id: 0, path: null as string | null, name: 'untitled.md', initial: WELCOME })
  const [text, setText] = useState(WELCOME)
  const [dirty, setDirty] = useState(false)
  const [userThemes, setUserThemes] = useState<Theme[]>([])
  const [themeName, setThemeName] = useState(readSavedTheme)
  const [pluginEntries, setPluginEntries] = useState<PluginEntry[]>([])
  const disabledPlugins = useRef(readDisabledPlugins())
  const enabledPlugins = useMemo(
    () => new Set(pluginEntries.filter((e) => e.enabled && !e.error).map((e) => e.file)),
    [pluginEntries]
  )
  const plugins = useMemo<MdPlugin[]>(
    () => pluginEntries.flatMap((e) => (e.plugin ? [e.plugin] : [])),
    [pluginEntries]
  )
  const [status, setStatus] = useState('')
  const [mode, setMode] = useState<ViewMode>('split')
  const textRef = useRef(text)
  textRef.current = text
  const editor = useRef<EditorHandle>(null)
  const editorPanel = usePanelRef()
  const previewPanel = usePanelRef()

  const themes = useMemo(() => [...builtinThemes, ...userThemes], [userThemes])
  const theme = themes.find((t) => t.name === themeName) ?? themes[0]

  const reloadExtensions = useCallback(async () => {
    const [list, entries] = await Promise.all([window.api.listThemes(), loadPlugins(disabledPlugins.current)])
    setUserThemes(list.map((t: { name: string; css: string }) => ({ name: t.name, css: t.css })))
    setPluginEntries(entries)
    const failed = entries.filter((e) => e.error).map((e) => `${e.name}: ${e.error}`)
    setStatus(failed.length ? `Plugin 錯誤：${failed.join('；')}` : '')
  }, [])

  useEffect(() => {
    reloadExtensions()
  }, [reloadExtensions])

  useEffect(() => {
    const dark = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => {
      document.documentElement.classList.toggle('dark', dark.matches)
    }
    apply()
    dark.addEventListener('change', apply)
    return () => dark.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    document.title = `${doc.name}${dirty ? ' •' : ''}`
  }, [doc.name, dirty])

  // Keep the native 外觀 / 插件 menus in sync with what is loaded.
  useEffect(() => {
    window.api.setMenuState({
      themes: themes.map((t) => t.name),
      currentTheme: theme.name,
      plugins: pluginEntries.map((e) => ({
        file: e.file,
        name: e.name,
        builtin: e.builtin,
        enabled: e.enabled,
        error: e.error
      }))
    })
  }, [themes, theme.name, pluginEntries])

  const confirmDiscard = useCallback(
    (): boolean => !dirty || window.confirm('目前的檔案有尚未儲存的變更，確定要捨棄嗎？'),
    [dirty]
  )

  const load = (path: string | null, name: string, content: string): void => {
    setDoc((d) => ({ id: d.id + 1, path, name, initial: content }))
    setText(content)
    setDirty(false)
  }

  const newFile = useCallback(() => {
    if (confirmDiscard()) load(null, 'untitled.md', '')
  }, [confirmDiscard])

  const open = useCallback(async () => {
    if (!confirmDiscard()) return
    const file = await window.api.openFile()
    if (file) load(file.path, file.name, file.content)
  }, [confirmDiscard])

  const save = useCallback(
    async (asNew: boolean) => {
      const saved = await window.api.saveFile(asNew ? null : doc.path, textRef.current)
      if (!saved) return
      setDoc((d) => ({ ...d, path: saved.path, name: saved.name }))
      setDirty(false)
      setStatus(`已儲存 ${saved.name}`)
    },
    [doc.path]
  )

  const exportAs = useCallback(
    async (kind: 'html' | 'pdf') => {
      setStatus('匯出中…')
      try {
        const html = await buildExportHtml(textRef.current, doc.name, theme.css, plugins)
        const ok = kind === 'html' ? await window.api.exportHtml(html) : await window.api.exportPdf(html)
        setStatus(ok ? `已匯出 ${kind.toUpperCase()}` : '')
      } catch (err) {
        setStatus(`匯出失敗：${err instanceof Error ? err.message : String(err)}`)
      }
    },
    [doc.name, theme.css, plugins]
  )

  // Collapse instead of unmounting so the editor keeps its undo history and cursor.
  useEffect(() => {
    const [edit, view] = [editorPanel.current, previewPanel.current]
    if (!edit || !view) return
    if (mode !== 'preview') edit.expand()
    if (mode !== 'editor') view.expand()
    if (mode === 'preview') edit.collapse()
    if (mode === 'editor') view.collapse()
  }, [mode, editorPanel, previewPanel])

  // Toggling a plugin persists the choice and reloads everything, so it takes effect immediately.
  const togglePlugin = useCallback(
    (file: string, enabled: boolean) => {
      const next = new Set(disabledPlugins.current)
      if (enabled) next.delete(file)
      else next.add(file)
      disabledPlugins.current = next
      try {
        localStorage.setItem(DISABLED_PLUGINS_KEY, JSON.stringify([...next]))
      } catch {
        /* the choice just won't survive a restart */
      }
      void reloadExtensions()
    },
    [reloadExtensions]
  )

  const pickTheme = useCallback((name: string) => {
    setThemeName(name)
    try {
      localStorage.setItem(THEME_KEY, name)
    } catch {
      /* theme choice just won't persist */
    }
  }, [])

  // --- requests from an AI assistant over MCP ------------------------------------------------
  const live = useRef({ doc, dirty, plugins })
  live.current = { doc, dirty, plugins }
  const rendered = useRef<{ source: string | null; error: string | null }>({ source: null, error: null })

  // The preview is debounced and diagrams load lazily, so wait until it matches the current text.
  const waitForRender = async (): Promise<void> => {
    const start = Date.now()
    while (rendered.current.source !== textRef.current) {
      if (Date.now() - start > 8000) throw new Error('預覽在時限內沒有完成渲染')
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  const mcpHandler = useRef<(method: string, args: unknown) => Promise<unknown>>(async () => null)
  mcpHandler.current = async (method, args) => {
    const view = editor.current
    if (!view) throw new Error('編輯器尚未就緒')

    switch (method) {
      case 'get_syntax_guide':
        return buildSyntaxGuide(live.current.plugins)

      case 'get_document': {
        const where = view.withView((v) => {
          const sel = v.state.selection.main
          const line = v.state.doc.lineAt(sel.head)
          return { cursor: { line: line.number, column: sel.head - line.from + 1 }, selection: v.state.sliceDoc(sel.from, sel.to) }
        })
        const { doc: d, dirty: unsaved } = live.current
        return { name: d.name, path: d.path, dirty: unsaved, content: textRef.current, ...where }
      }

      case 'get_render_errors': {
        await waitForRender()
        const errors = Array.from(document.querySelectorAll<HTMLElement>('.mermaid-error, .chart-error, .katex-error')).map(
          (el) =>
            el.classList.contains('katex-error')
              ? { kind: 'latex', message: el.getAttribute('title') ?? '', source: el.textContent ?? '' }
              : { kind: el.classList.contains('mermaid-error') ? 'mermaid' : 'chart', message: el.textContent ?? '', source: el.dataset.source ?? '' }
        )
        const renderError = rendered.current.error
        return { ok: errors.length === 0 && !renderError, errors, renderError }
      }

      case 'replace_text': {
        const { find, replace, replaceAll } = args as { find: string; replace: string; replaceAll?: boolean }
        const count = view.withView((v) => {
          const content = v.state.doc.toString()
          const at: number[] = []
          for (let i = content.indexOf(find); i !== -1; i = content.indexOf(find, i + find.length)) at.push(i)
          if (at.length === 0) throw new Error('找不到 find 指定的文字（必須逐字相同，包含空白與換行）')
          if (at.length > 1 && !replaceAll) {
            throw new Error(`find 在文件中出現 ${at.length} 次，請加長 find 讓它唯一，或設定 replaceAll`)
          }
          // One transaction, so a single undo reverts the whole change.
          v.dispatch({ changes: at.map((from) => ({ from, to: from + find.length, insert: replace })) })
          return at.length
        })
        return { ok: true, replaced: count }
      }

      case 'insert_text': {
        const { text, position } = args as { text: string; position: 'cursor' | 'start' | 'end' }
        view.withView((v) => {
          const at = position === 'start' ? 0 : position === 'end' ? v.state.doc.length : v.state.selection.main.head
          v.dispatch({ changes: { from: at, insert: text } })
        })
        return { ok: true }
      }
    }
    throw new Error(`未知的請求：${method}`)
  }

  useEffect(
    () =>
      window.api.onMcpRequest(async ({ id, method, args }) => {
        try {
          window.api.mcpRespond(id, { result: await mcpHandler.current(method, args) })
        } catch (err) {
          window.api.mcpRespond(id, { error: err instanceof Error ? err.message : String(err) })
        }
      }),
    []
  )

  // The menu listener is registered once; it always calls the latest handlers via this ref.
  const handlers = useRef<(a: MenuAction) => void>(() => {})
  handlers.current = (a) => {
    switch (a.type) {
      case 'new': return newFile()
      case 'open': return void open()
      case 'save': return void save(false)
      case 'save-as': return void save(true)
      case 'export-html': return void exportAs('html')
      case 'export-pdf': return void exportAs('pdf')
      case 'theme': return pickTheme(a.name)
      case 'plugin-toggle': return togglePlugin(a.file, a.enabled)
      case 'reload-extensions': return void reloadExtensions()
      case 'notice': return setStatus(a.text)
      case 'open-external': return void (confirmDiscard() && load(a.path, a.name, a.content))
      case 'open-folder': return void window.api.userPaths().then((p) => window.api.openPath(p[a.kind]))
    }
  }
  useEffect(() => window.api.onMenuAction((a) => handlers.current(a)), [])

  // Listeners are in place: let the main process deliver a file that was opened from outside.
  useEffect(() => {
    window.api.rendererReady()
  }, [])

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex h-screen flex-col">
        <Header
          mode={mode}
          onModeChange={setMode}
          onCommand={(c) => editor.current?.exec(c)}
          enabledPlugins={enabledPlugins}
        />

        <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
          <ResizablePanel
            panelRef={editorPanel}
            collapsible
            collapsedSize="0%"
            defaultSize="50%"
            minSize="20%"
            className="overflow-hidden"
            onResize={(size) => size.asPercentage === 0 && setMode((m) => (m === 'split' ? 'preview' : m))}
          >
            <Editor
              ref={editor}
              value={doc.initial}
              docKey={String(doc.id)}
              onChange={(v) => {
                setText(v)
                setDirty(true)
              }}
            />
          </ResizablePanel>
          <ResizableHandle withHandle className={mode !== 'split' ? 'pointer-events-none opacity-0' : ''} />
          <ResizablePanel
            panelRef={previewPanel}
            collapsible
            collapsedSize="0%"
            defaultSize="50%"
            minSize="20%"
            className="overflow-hidden"
            onResize={(size) => size.asPercentage === 0 && setMode((m) => (m === 'split' ? 'editor' : m))}
          >
            <Preview
              source={text}
              themeCss={theme.css}
              plugins={plugins}
              onRendered={(source, error) => {
                rendered.current = { source, error }
              }}
            />
          </ResizablePanel>
        </ResizablePanelGroup>

        <footer className="truncate border-t px-3 py-1 text-xs text-muted-foreground">
          {status || `${text.length} 字元`}
        </footer>
      </div>
    </TooltipProvider>
  )
}
