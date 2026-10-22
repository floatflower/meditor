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
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  chartBlock,
  codeBlock,
  heading,
  horizontalRule,
  image,
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
  label: string
  command: EditorCommand
  /** Built-in plugin id that must be enabled for this action to make sense. */
  requires?: string
}

const GROUPS: Action[][] = [
  [
    { icon: Heading1, label: '標題 1', command: heading(1) },
    { icon: Heading2, label: '標題 2', command: heading(2) },
    { icon: Heading3, label: '標題 3', command: heading(3) }
  ],
  [
    { icon: Bold, label: '粗體 (⌘B)', command: wrap('**') },
    { icon: Italic, label: '斜體 (⌘I)', command: wrap('*') },
    { icon: Strikethrough, label: '刪除線', command: wrap('~~') },
    { icon: Code, label: '行內程式碼', command: wrap('`', '`', 'code') }
  ],
  [
    { icon: List, label: '無序清單', command: toggleList('ul') },
    { icon: ListOrdered, label: '有序清單', command: toggleList('ol') },
    { icon: ListChecks, label: '待辦清單', command: toggleList('task') },
    { icon: Quote, label: '引用', command: toggleList('quote') }
  ],
  [
    { icon: Link, label: '連結', command: link },
    { icon: Image, label: '圖片', command: image },
    { icon: FileCode, label: '程式碼區塊', command: codeBlock },
    { icon: Table, label: '表格', command: table },
    { icon: Minus, label: '分隔線', command: horizontalRule },
    { icon: Sigma, label: '行內公式 ($)', command: inlineMath, requires: 'builtin:math' },
    { icon: SquareSigma, label: '區塊公式 ($$)', command: mathBlock, requires: 'builtin:math' },
    { icon: ChartColumn, label: '資料圖表', command: chartBlock, requires: 'builtin:chart' },
    { icon: Workflow, label: 'Mermaid 圖表', command: mermaidBlock, requires: 'builtin:mermaid' }
  ]
]

const MODES: { mode: ViewMode; icon: LucideIcon; label: string }[] = [
  { mode: 'editor', icon: PencilLine, label: '編輯模式' },
  { mode: 'split', icon: Columns2, label: '雙欄模式' },
  { mode: 'preview', icon: Eye, label: '預覽模式' }
]

interface Props {
  mode: ViewMode
  onModeChange: (mode: ViewMode) => void
  onCommand: (command: EditorCommand) => void
  /** Ids of the plugins that are currently enabled. */
  enabledPlugins: ReadonlySet<string>
}

export default function Header({ mode, onModeChange, onCommand, enabledPlugins }: Props): React.JSX.Element {
  const editing = mode !== 'preview'

  return (
    <header className="flex items-center justify-between gap-2 border-b px-2 py-1">
      <div className="flex items-center gap-1 overflow-x-auto">
        {GROUPS.map((group, i) => (
          <div key={i} className="flex items-center gap-0.5">
            {i > 0 && <Separator orientation="vertical" className="mx-1 h-5" />}
            {group.map(({ icon: Icon, label, command, requires }) => {
              const available = !requires || enabledPlugins.has(requires)
              return (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={label}
                    disabled={!editing || !available}
                    // Keep the editor's selection/focus when the button is pressed.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onCommand(command)}
                  >
                    <Icon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{available ? label : `${label}（對應的插件已停用）`}</TooltipContent>
              </Tooltip>
              )
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-0.5 rounded-md border p-0.5">
        {MODES.map(({ mode: m, icon: Icon, label }) => (
          <Tooltip key={m}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={label}
                aria-pressed={mode === m}
                className={cn(mode === m && 'bg-accent text-accent-foreground')}
                onClick={() => onModeChange(m)}
              >
                <Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </header>
  )
}
