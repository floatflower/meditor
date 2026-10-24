import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePanelRef } from 'react-resizable-panels'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import Editor, { type EditorHandle } from '@/components/Editor'
import Header, { type ViewMode } from '@/components/Header'
import ImageDialog from '@/components/ImageDialog'
import UpdateNotice from '@/components/UpdateNotice'
import { insertImages, type ImageItem } from '@/lib/editorCommands'
import FolderSidebar from '@/components/FolderSidebar'
import SettingsDialog from '@/components/SettingsDialog'
import ReviewBanner from '@/components/ReviewBanner'
import TabBar from '@/components/TabBar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import type { FolderScan, TreeNode } from '../../main/folder'
import Preview from '@/components/Preview'
import { builtinThemes, type Theme } from '@/lib/themes'
import { loadPlugins, type PluginEntry } from '@/lib/plugins'
import { buildExportHtml } from '@/lib/export'
import { buildSyntaxGuide } from '@/lib/syntaxGuide'
import { setLanguage } from '@/i18n'
import { dispatchReviewed } from '@/lib/review'
import type { LanguageSetting } from '../../shared/i18n'
import type { UpdateState } from '../../shared/update'
import type { MdPlugin } from '@/lib/markdown'
import type { MenuAction } from '../../main/menu'

interface Tab {
  id: number
  path: string | null
  name: string
  text: string
  /** Edited since it was opened or last saved. */
  dirty: boolean
}

type SaveChoice = 'save' | 'discard' | 'cancel'

const THEME_KEY = 'sheaf.theme'
const DISABLED_PLUGINS_KEY = 'sheaf.disabledPlugins'
// Below this window width the sidebar is tucked away and slides over the editor on demand.
const NARROW_WIDTH = 900
const isNarrow = (): boolean => window.innerWidth < NARROW_WIDTH
const SIDEBAR_KEY = 'sheaf.sidebarWidth'
const SIDEBAR_MIN = 160
const SIDEBAR_MAX = 520

/** Settings used to be stored under `folio.*`, `meditor.*` and `mdeditor.*`; read those too so nothing is lost by the renames. */
function readSetting(key: string): string | null {
  try {
    const rest = key.replace(/^sheaf\./, '')
    return (
      localStorage.getItem(key) ??
      localStorage.getItem(`folio.${rest}`) ??
      localStorage.getItem(`meditor.${rest}`) ??
      localStorage.getItem(`mdeditor.${rest}`)
    )
  } catch {
    return null
  }
}

function readSidebarWidth(): number {
  const saved = Number(readSetting(SIDEBAR_KEY))
  return saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX ? saved : 260
}

function readDisabledPlugins(): Set<string> {
  try {
    return new Set(JSON.parse(readSetting(DISABLED_PLUGINS_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

function readSavedTheme(): string {
  return readSetting(THEME_KEY) ?? 'Default'
}

/** Directories on the way to `path`, so the sidebar can reveal the file that is open. */
function ancestorsOf(tree: TreeNode[], path: string): string[] {
  for (const node of tree) {
    if (node.path === path) return []
    if (node.dir && node.children) {
      const inner = ancestorsOf(node.children, path)
      if (inner.length || node.children.some((c) => c.path === path)) return [node.path, ...inner]
    }
  }
  return []
}

const countNodes = (tree: TreeNode[]): number => tree.reduce((n, node) => n + 1 + (node.children ? countNodes(node.children) : 0), 0)
const allDirectories = (tree: TreeNode[]): string[] =>
  tree.flatMap((node) => (node.dir ? [node.path, ...allDirectories(node.children ?? [])] : []))

export default function App(): React.JSX.Element {
  const { t } = useTranslation()
  const [languageSetting, setLanguageSetting] = useState<LanguageSetting>('system')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [update, setUpdate] = useState<UpdateState | null>(null)
  /** Changes waiting for review, per tab id. */
  const [reviewCounts, setReviewCounts] = useState<Record<number, number>>({})
  const [appInfo, setAppInfo] = useState<{ version: string; packaged: boolean; name: string; platform: string } | null>(null)
  const [tabs, setTabs] = useState<Tab[]>(() => [{ id: 1, path: null, name: 'untitled.md', text: '', dirty: false }])
  const [activeId, setActiveId] = useState(1)
  const nextTabId = useRef(2)
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs
  const doc = tabs.find((t) => t.id === activeId) ?? tabs[0]
  const activeIdRef = useRef(doc.id)
  activeIdRef.current = doc.id
  const text = doc.text
  const dirty = doc.dirty
  // Set while the "save before closing?" dialog is up; answering resolves the promise `askSave` returned.
  const [savePrompt, setSavePrompt] = useState<{ name: string } | null>(null)
  const savePromptResolve = useRef<((choice: SaveChoice) => void) | null>(null)
  const saveButton = useRef<HTMLButtonElement>(null)
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
  const [imageOpen, setImageOpen] = useState(false)
  const [mode, setMode] = useState<ViewMode>('split')
  useEffect(() => {
    void window.api.getUpdate().then(setUpdate)
    return window.api.onUpdateState(setUpdate)
  }, [])
  const textRef = useRef(text)
  textRef.current = text
  const editor = useRef<EditorHandle>(null)
  const [workspace, setWorkspace] = useState<FolderScan | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth)
  const [narrow, setNarrow] = useState(isNarrow)
  const [sidebarOpen, setSidebarOpen] = useState(() => !isNarrow())
  const editorPanel = usePanelRef()
  const previewPanel = usePanelRef()

  const themes = useMemo(() => [...builtinThemes, ...userThemes], [userThemes])
  const theme = themes.find((t) => t.name === themeName) ?? themes[0]

  const reloadExtensions = useCallback(async () => {
    const [list, entries] = await Promise.all([window.api.listThemes(), loadPlugins(disabledPlugins.current)])
    setUserThemes(list.map((t: { name: string; css: string }) => ({ name: t.name, css: t.css })))
    setPluginEntries(entries)
    const failed = entries
      .filter((e) => e.error)
      .map((e) => `${e.builtin ? t(`plugins.${e.file.replace('builtin:', '')}`) : e.name}: ${e.error}`)
    setStatus(failed.length ? t('status.pluginErrors', { list: failed.join(t('status.listSeparator')) }) : '')
  }, [t])

  useEffect(() => {
    reloadExtensions()
  }, [reloadExtensions])

  useEffect(() => {
    document.title = `${doc.name}${dirty ? ' •' : ''}`
  }, [doc.name, dirty])

  useEffect(() => {
    void window.api.getLanguage().then(({ setting }) => setLanguageSetting(setting))
    void window.api.getAppInfo().then(setAppInfo)
  }, [])

  const openExtensionFolder = useCallback(async (kind: 'themes' | 'plugins') => {
    await window.api.openPath((await window.api.userPaths())[kind])
  }, [])

  /** Save the choice in the main process (which relabels the native menu), then switch this window too. */
  const changeLanguage = useCallback(async (setting: LanguageSetting) => {
    const { setting: saved, resolved } = await window.api.setLanguage(setting)
    setLanguageSetting(saved)
    await setLanguage(resolved)
  }, [])

  // --- tabs ----------------------------------------------------------------------------------
  /** Open a document in a tab, or switch to the tab that already has it. */
  const openTab = useCallback((path: string | null, name: string, content: string) => {
    const existing = path ? tabsRef.current.find((t) => t.path === path) : undefined
    if (existing) {
      setActiveId(existing.id)
      return
    }
    const fresh: Tab = { id: nextTabId.current++, path, name, text: content, dirty: false }
    // An untouched blank tab is replaced rather than left sitting next to the real file.
    const only = tabsRef.current.length === 1 ? tabsRef.current[0] : undefined
    const replaceable = !!path && !!only && only.path === null && !only.dirty && only.text === ''
    if (replaceable) editor.current?.forget(String(only.id))
    setTabs((ts) => (replaceable ? [fresh] : [...ts, fresh]))
    setActiveId(fresh.id)
  }, [])

  const newFile = useCallback(() => {
    const names = new Set(tabsRef.current.map((t) => t.name))
    let name = 'untitled.md'
    for (let n = 2; names.has(name); n++) name = `untitled-${n}.md`
    openTab(null, name, '')
  }, [openTab])

  const open = useCallback(async () => {
    const file = await window.api.openFile()
    if (file) openTab(file.path, file.name, file.content)
  }, [openTab])

  /** Save one tab (not necessarily the visible one). Resolves false if the user backed out. */
  const saveTab = useCallback(async (id: number, asNew = false): Promise<boolean> => {
    const tab = tabsRef.current.find((t) => t.id === id)
    if (!tab) return false
    const savedText = tab.text
    const saved = await window.api.saveFile(asNew ? null : tab.path, savedText)
    if (!saved) return false
    // Typing may have continued while a save dialog was open: stay dirty if the text moved on.
    setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, path: saved.path, name: saved.name, dirty: t.text !== savedText } : t)))
    setStatus(t('status.saved', { name: saved.name }))
    return true
  }, [t])

  const askSave = useCallback(
    (tab: Tab) =>
      new Promise<SaveChoice>((resolve) => {
        savePromptResolve.current = resolve
        setSavePrompt({ name: tab.name })
      }),
    []
  )

  const answerSave = useCallback((choice: SaveChoice) => {
    savePromptResolve.current?.(choice) // a second answer (the dialog closing itself) finds nothing to resolve
    savePromptResolve.current = null
    setSavePrompt(null)
  }, [])

  const closeTab = useCallback(
    async (id: number) => {
      const tab = tabsRef.current.find((t) => t.id === id)
      if (!tab) return
      if (tab.dirty) {
        const choice = await askSave(tab)
        if (choice === 'cancel') return
        if (choice === 'save' && !(await saveTab(id))) return
      }
      const all = tabsRef.current
      const index = all.findIndex((t) => t.id === id)
      const rest = all.filter((t) => t.id !== id)
      editor.current?.forget(String(id))
      setReviewCounts(({ [id]: _closed, ...others }) => others)

      if (rest.length === 0) {
        // Never leave the editor without a document.
        const blank: Tab = { id: nextTabId.current++, path: null, name: 'untitled.md', text: '', dirty: false }
        setTabs([blank])
        setActiveId(blank.id)
        return
      }
      setTabs(rest)
      if (id === activeIdRef.current) setActiveId(rest[Math.min(index, rest.length - 1)].id)
    },
    [askSave, saveTab]
  )

  // --- open-folder mode ----------------------------------------------------------------------
  const openWorkspace = useCallback(async (root: string) => {
    try {
      const scan = await window.api.scanFolder(root)
      setWorkspace(scan)
      setSidebarOpen(true)
      // A small tree opens fully; a large one stays collapsed until the user digs in.
      setExpanded(new Set(countNodes(scan.tree) <= 40 ? allDirectories(scan.tree) : []))
    } catch (err) {
      setStatus(t('status.openFolderFailed', { error: err instanceof Error ? err.message : String(err) }))
    }
  }, [t])

  const refreshWorkspace = useCallback(async () => {
    if (!workspace) return
    try {
      setWorkspace(await window.api.scanFolder(workspace.root))
    } catch {
      setWorkspace(null) // the folder is gone
    }
  }, [workspace])

  const closeWorkspace = useCallback(() => {
    window.api.stopWatchingFolder()
    setWorkspace(null)
  }, [])

  const toggleFolder = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const openFromTree = useCallback(
    async (path: string) => {
      if (narrow) setSidebarOpen(false)
      const existing = tabsRef.current.find((t) => t.path === path)
      if (existing) return setActiveId(existing.id)
      try {
        const file = await window.api.readFile(path)
        openTab(file.path, file.name, file.content)
      } catch (err) {
        setStatus(t('status.openFileFailed', { path, error: err instanceof Error ? err.message : String(err) }))
        void refreshWorkspace() // most likely the file was deleted
      }
    },
    [narrow, openTab, refreshWorkspace, t]
  )

  // Show where the open file lives, even in a collapsed tree.
  useEffect(() => {
    if (!workspace || !doc.path) return
    const parents = ancestorsOf(workspace.tree, doc.path)
    if (parents.length) setExpanded((prev) => (parents.every((p) => prev.has(p)) ? prev : new Set([...prev, ...parents])))
  }, [workspace, doc.path])

  // Crossing the breakpoint either way resets the sidebar: hidden when narrow, shown when wide.
  // Uses `resize` rather than a media-query listener because that fires without waiting for a paint.
  const wasNarrow = useRef(isNarrow())
  useEffect(() => {
    const onResize = (): void => {
      const now = isNarrow()
      if (now === wasNarrow.current) return
      wasNarrow.current = now
      setNarrow(now)
      setSidebarOpen(!now)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const overlayOpen = !!workspace && narrow && sidebarOpen
  useEffect(() => {
    if (!overlayOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlayOpen])

  const startSidebarDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const startX = e.clientX
      const startWidth = sidebarWidth
      let width = startWidth
      const move = (ev: PointerEvent): void => {
        width = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth + ev.clientX - startX))
        setSidebarWidth(width)
      }
      const up = (): void => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        try {
          localStorage.setItem(SIDEBAR_KEY, String(width))
        } catch {
          /* the width just won't be remembered */
        }
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      e.preventDefault()
    },
    [sidebarWidth]
  )

  const exportAs = useCallback(
    async (kind: 'html' | 'html-bundle' | 'pdf') => {
      setStatus(t('status.exporting'))
      try {
        const html = await buildExportHtml(textRef.current, doc.name, theme.css, plugins, doc.path)
        const ok =
          kind === 'pdf'
            ? await window.api.exportPdf(html)
            : kind === 'html-bundle'
              ? await window.api.exportHtmlBundle(html)
              : await window.api.exportHtml(html)
        setStatus(ok ? t('status.exported', { kind: kind === 'pdf' ? 'PDF' : 'HTML' }) : '')
      } catch (err) {
        setStatus(t('status.exportFailed', { error: err instanceof Error ? err.message : String(err) }))
      }
    },
    [doc.name, theme.css, plugins, t]
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
  const live = useRef({ doc, dirty, plugins, pendingReview: reviewCounts[doc.id] ?? 0 })
  live.current = { doc, dirty, plugins, pendingReview: reviewCounts[doc.id] ?? 0 }
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
        return { name: d.name, path: d.path, dirty: unsaved, pendingReview: live.current.pendingReview, content: textRef.current, ...where }
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
        const { find, replace, replaceAll, review } = args as { find: string; replace: string; replaceAll?: boolean; review?: boolean }
        const count = view.withView((v) => {
          const content = v.state.doc.toString()
          const at: number[] = []
          for (let i = content.indexOf(find); i !== -1; i = content.indexOf(find, i + find.length)) at.push(i)
          if (at.length === 0) throw new Error('找不到 find 指定的文字（必須逐字相同，包含空白與換行）')
          if (at.length > 1 && !replaceAll) {
            throw new Error(`find 在文件中出現 ${at.length} 次，請加長 find 讓它唯一，或設定 replaceAll`)
          }
          // One transaction, so a single undo reverts the whole change.
          dispatchReviewed(v, at.map((from) => ({ from, to: from + find.length, insert: replace })), review !== false)
          return at.length
        })
        return { ok: true, replaced: count }
      }

      case 'insert_text': {
        const { text, position, review } = args as { text: string; position: 'cursor' | 'start' | 'end'; review?: boolean }
        view.withView((v) => {
          const at = position === 'start' ? 0 : position === 'end' ? v.state.doc.length : v.state.selection.main.head
          dispatchReviewed(v, { from: at, insert: text }, review !== false)
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
      case 'save': return void saveTab(activeIdRef.current)
      case 'save-as': return void saveTab(activeIdRef.current, true)
      case 'close-tab': return void closeTab(activeIdRef.current)
      case 'export-html': return void exportAs('html')
      case 'export-html-bundle': return void exportAs('html-bundle')
      case 'export-pdf': return void exportAs('pdf')
      case 'notice': return setStatus(a.text)
      case 'open-settings': return setSettingsOpen(true)
      case 'open-workspace': return void openWorkspace(a.root)
      case 'close-workspace': return closeWorkspace()
      case 'workspace-changed': return void refreshWorkspace()
      case 'open-external': return openTab(a.path, a.name, a.content)
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
          onImage={() => setImageOpen(true)}
          enabledPlugins={enabledPlugins}
          sidebar={workspace ? { open: sidebarOpen, onToggle: () => setSidebarOpen((o) => !o) } : undefined}
        />

        <div className="relative flex min-h-0 flex-1">
          {workspace && sidebarOpen && !narrow && (
            <>
              <FolderSidebar
                width={sidebarWidth}
                scan={workspace}
                currentPath={doc.path}
                expanded={expanded}
                onToggle={toggleFolder}
                onOpen={(path) => void openFromTree(path)}
                onRefresh={() => void refreshWorkspace()}
                onClose={closeWorkspace}
              />
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={t('sidebar.resize')}
                onPointerDown={startSidebarDrag}
                className="-ml-0.5 w-1 shrink-0 cursor-col-resize touch-none bg-transparent hover:bg-ring/40 active:bg-ring/60"
              />
            </>
          )}
          {overlayOpen && workspace && (
            <div className="absolute inset-0 z-30 flex">
              <FolderSidebar
                width={sidebarWidth}
                className="bg-background shadow-xl"
                scan={workspace}
                currentPath={doc.path}
                expanded={expanded}
                onToggle={toggleFolder}
                onOpen={(path) => void openFromTree(path)}
                onRefresh={() => void refreshWorkspace()}
                onClose={closeWorkspace}
              />
              <button type="button" aria-label={t('sidebar.closeOverlay')} className="min-w-0 flex-1 cursor-default bg-black/30" onClick={() => setSidebarOpen(false)} />
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col">
          <TabBar tabs={tabs} activeId={doc.id} onSelect={setActiveId} onClose={(id) => void closeTab(id)} reviews={reviewCounts} />
          <ReviewBanner
            changes={reviewCounts[doc.id] ?? 0}
            onPrevious={() => editor.current?.goToChange(-1)}
            onNext={() => editor.current?.goToChange(1)}
            onAcceptAll={() => editor.current?.acceptAll()}
            onRejectAll={() => editor.current?.rejectAll()}
          />
          <div className="min-h-0 flex-1">
          <ResizablePanelGroup orientation="horizontal" className="h-full">
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
                value={doc.text}
                docKey={String(doc.id)}
                onChange={(v) => setTabs((ts) => ts.map((t) => (t.id === doc.id ? { ...t, text: v, dirty: true } : t)))}
                onReview={(key, changes) => setReviewCounts((prev) => ((prev[Number(key)] ?? 0) === changes ? prev : { ...prev, [Number(key)]: changes }))}
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
                docPath={doc.path}
                onRendered={(source, error) => {
                  rendered.current = { source, error }
                }}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
          </div>
          </div>
        </div>

        <footer className="flex items-center gap-3 border-t px-3 py-1 text-xs text-muted-foreground">
          <span className="min-w-0 flex-1 truncate">{status || t('status.characters', { n: text.length })}</span>
          {appInfo && (
            // The version is whatever the build stamped in: for a release, the git tag (v0.0.2-rc1 → "v0.0.2-rc1").
            <span
              className="shrink-0 select-text"
              title={appInfo.packaged ? t('status.version', { version: appInfo.version }) : `${t('status.version', { version: appInfo.version })} (${t('status.devBuild')})`}
            >
              v{appInfo.version}
              {!appInfo.packaged && ' · dev'}
            </span>
          )}
        </footer>
      </div>

      <ImageDialog
        open={imageOpen}
        onOpenChange={setImageOpen}
        docPath={doc.path}
        onInsert={(items: ImageItem[], skipped: number) => {
          editor.current?.exec(insertImages(items))
          setStatus(skipped ? t('image.skipped', { count: skipped }) : '')
        }}
      />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        language={languageSetting}
        onLanguageChange={(setting) => void changeLanguage(setting)}
        themes={themes}
        theme={theme.name}
        onPickTheme={pickTheme}
        plugins={pluginEntries}
        onTogglePlugin={togglePlugin}
        onOpenFolder={(kind) => void openExtensionFolder(kind)}
        onReload={() => void reloadExtensions()}
        update={update}
        onCheckUpdate={() => void window.api.checkUpdate()}
        onOpenUpdatePage={() => void window.api.openUpdatePage()}
        onAutoUpdate={(value) => void window.api.setAutoUpdate(value)}
      />

      {update?.notice && update.version && (
        <UpdateNotice version={update.version} onOpen={() => void window.api.openUpdatePage()} onClose={() => void window.api.dismissUpdate()} />
      )}

      <AlertDialog open={!!savePrompt} onOpenChange={(open) => !open && answerSave('cancel')}>
        <AlertDialogContent
          // Enter should save, never discard: put the focus on 儲存 instead of the dialog's default.
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            saveButton.current?.focus()
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{t('closeDialog.title', { name: savePrompt?.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t('closeDialog.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => answerSave('cancel')}>{t('closeDialog.cancel')}</AlertDialogCancel>
            <Button variant="outline" className="cursor-pointer" onClick={() => answerSave('discard')}>
              {t('closeDialog.discard')}
            </Button>
            <AlertDialogAction ref={saveButton} onClick={() => answerSave('save')}>
              {t('closeDialog.save')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}
