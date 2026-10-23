import {
  Bold,
  ChartColumn,
  Code,
  Columns2,
  Eye,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Italic,
  Link,
  List,
  ListChecks,
  Menu,
  ListOrdered,
  Minus,
  PencilLine,
  Quote,
  Sigma,
  SquareSigma,
  Strikethrough,
  Table,
  Workflow,
  type LucideIcon
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  chartBlock,
  codeBlock,
  heading,
  horizontalRule,
  inlineMath,
  link,
  mathBlock,
  mermaidBlock,
  table,
  toggleList,
  wrap,
  type EditorCommand
} from '@/lib/editorCommands'
import { cn } from '@/lib/utils'

export type ViewMode = 'editor' | 'split' | 'preview'

interface Action {
  icon: LucideIcon
  /** Translation key of the tooltip. */
  label: string
  /** Run against the editor, or `'image'` to open the image dialog first. */
  command: EditorCommand | 'image'
  /** Built-in plugin id that must be enabled for this action to make sense. */
  requires?: string
}

const GROUPS: Action[][] = [
  [
    { icon: Heading1, label: 'header.h1', command: heading(1) },
    { icon: Heading2, label: 'header.h2', command: heading(2) },
    { icon: Heading3, label: 'header.h3', command: heading(3) }
  ],
  [
    { icon: Bold, label: 'header.bold', command: wrap('**') },
    { icon: Italic, label: 'header.italic', command: wrap('*') },
    { icon: Strikethrough, label: 'header.strike', command: wrap('~~') },
    { icon: Code, label: 'header.inlineCode', command: wrap('`', '`', 'code') }
  ],
  [
    { icon: List, label: 'header.ul', command: toggleList('ul') },
    { icon: ListOrdered, label: 'header.ol', command: toggleList('ol') },
    { icon: ListChecks, label: 'header.task', command: toggleList('task') },
    { icon: Quote, label: 'header.quote', command: toggleList('quote') }
  ],
  [
    { icon: Link, label: 'header.link', command: link },
    { icon: Image, label: 'header.image', command: 'image' },
    { icon: FileCode, label: 'header.codeBlock', command: codeBlock },
    { icon: Table, label: 'header.table', command: table },
    { icon: Minus, label: 'header.hr', command: horizontalRule },
    { icon: Sigma, label: 'header.inlineMath', command: inlineMath, requires: 'builtin:math' },
    { icon: SquareSigma, label: 'header.blockMath', command: mathBlock, requires: 'builtin:math' },
    { icon: ChartColumn, label: 'header.chart', command: chartBlock, requires: 'builtin:chart' },
    { icon: Workflow, label: 'header.mermaid', command: mermaidBlock, requires: 'builtin:mermaid' }
  ]
]

const MODES: { mode: ViewMode; icon: LucideIcon; label: string }[] = [
  { mode: 'editor', icon: PencilLine, label: 'header.modeEditor' },
  { mode: 'split', icon: Columns2, label: 'header.modeSplit' },
  { mode: 'preview', icon: Eye, label: 'header.modePreview' }
]

interface Props {
  mode: ViewMode
  onModeChange: (mode: ViewMode) => void
  onCommand: (command: EditorCommand) => void
  onImage: () => void
  /** Ids of the plugins that are currently enabled. */
  enabledPlugins: ReadonlySet<string>
  /** Present only while a folder is open: the sidebar toggle shown at the far left. */
  sidebar?: { open: boolean; onToggle: () => void }
}

export default function Header({ mode, onModeChange, onCommand, onImage, enabledPlugins, sidebar }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const editing = mode !== 'preview'

  return (
    <header className="flex items-center justify-between gap-2 border-b px-2 py-1">
      <div className="flex items-center gap-1 overflow-x-auto">
        {sidebar && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('header.sidebar')}
                  aria-expanded={sidebar.open}
                  onClick={sidebar.onToggle}
                >
                  <Menu />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{sidebar.open ? t('header.sidebarCollapse') : t('header.sidebarExpand')}</TooltipContent>
            </Tooltip>
            <Separator orientation="vertical" className="mx-1 h-5" />
          </>
        )}
        {GROUPS.map((group, i) => (
          <div key={i} className="flex items-center gap-0.5">
            {i > 0 && <Separator orientation="vertical" className="mx-1 h-5" />}
            {group.map(({ icon: Icon, label: labelKey, command, requires }) => {
              const label = t(labelKey)
              const available = !requires || enabledPlugins.has(requires)
              return (
              <Tooltip key={labelKey}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={label}
                    disabled={!editing || !available}
                    // Keep the editor's selection/focus when the button is pressed.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => (command === 'image' ? onImage() : onCommand(command))}
                  >
                    <Icon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{available ? label : t('header.pluginOff', { label })}</TooltipContent>
              </Tooltip>
              )
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-0.5 rounded-md border p-0.5">
        {MODES.map(({ mode: m, icon: Icon, label: labelKey }) => (
          <Tooltip key={m}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t(labelKey)}
                aria-pressed={mode === m}
                className={cn(mode === m && 'bg-accent text-accent-foreground')}
                onClick={() => onModeChange(m)}
              >
                <Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t(labelKey)}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </header>
  )
}
