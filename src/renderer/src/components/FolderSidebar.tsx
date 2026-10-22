import { ChevronRight, FileText, Folder, FolderOpen, RefreshCw, X } from 'lucide-react'
import type { FolderScan, TreeNode } from '../../../main/folder'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  width: number
  className?: string
  scan: FolderScan
  currentPath: string | null
  expanded: ReadonlySet<string>
  onToggle: (path: string) => void
  onOpen: (path: string) => void
  onRefresh: () => void
  onClose: () => void
}

interface RowProps extends Pick<Props, 'currentPath' | 'expanded' | 'onToggle' | 'onOpen'> {
  node: TreeNode
  depth: number
}

function Row({ node, depth, currentPath, expanded, onToggle, onOpen }: RowProps): React.JSX.Element {
  const open = expanded.has(node.path)
  const selected = !node.dir && node.path === currentPath
  const Icon = node.dir ? (open ? FolderOpen : Folder) : FileText

  return (
    <li>
      <button
        type="button"
        title={node.path}
        aria-expanded={node.dir ? open : undefined}
        aria-current={selected ? 'true' : undefined}
        onClick={() => (node.dir ? onToggle(node.path) : onOpen(node.path))}
        style={{ paddingLeft: 6 + depth * 14 }}
        className={cn(
          'flex w-full cursor-pointer items-center gap-1.5 rounded-sm py-1 pr-2 text-left text-sm outline-none',
          'hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring',
          selected && 'bg-accent font-medium text-accent-foreground'
        )}
      >
        {/* Files get an empty slot so their names line up with sibling folders. */}
        <ChevronRight
          className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90', !node.dir && 'invisible')}
        />
        <Icon className={cn('size-4 shrink-0', node.dir ? 'text-muted-foreground' : 'text-foreground/70')} />
        <span className="truncate">{node.name}</span>
      </button>
      {node.dir && open && node.children && (
        <ul>
          {node.children.map((child) => (
            <Row key={child.path} node={child} depth={depth + 1} currentPath={currentPath} expanded={expanded} onToggle={onToggle} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function FolderSidebar({ width, className, scan, currentPath, expanded, onToggle, onOpen, onRefresh, onClose }: Props): React.JSX.Element {
  return (
    <aside className={cn('flex h-full shrink-0 flex-col border-r', className)} style={{ width, maxWidth: '85%' }} aria-label="資料夾">
      <div className="flex items-center gap-1 border-b py-1 pl-3 pr-1">
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={scan.root}>
          {scan.name}
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="重新整理" title="重新整理" onClick={onRefresh}>
          <RefreshCw />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="關閉資料夾" title="關閉資料夾" onClick={onClose}>
          <X />
        </Button>
      </div>

      <nav className="min-h-0 flex-1 overflow-auto p-1">
        {scan.tree.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">這個資料夾裡沒有 .md 檔案</p>
        ) : (
          <ul>
            {scan.tree.map((node) => (
              <Row key={node.path} node={node} depth={0} currentPath={currentPath} expanded={expanded} onToggle={onToggle} onOpen={onOpen} />
            ))}
          </ul>
        )}
        {scan.truncated && <p className="px-3 py-2 text-xs text-muted-foreground">檔案太多，只顯示部分</p>}
      </nav>
    </aside>
  )
}
