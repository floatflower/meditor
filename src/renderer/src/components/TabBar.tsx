import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TabInfo {
  id: number
  name: string
  path: string | null
  dirty: boolean
}

interface Props {
  tabs: TabInfo[]
  activeId: number
  onSelect: (id: number) => void
  onClose: (id: number) => void
}

/** The folder a file sits in, shown only to tell apart tabs that share a file name. */
const parentOf = (path: string | null): string => {
  const parts = (path ?? '').split(/[\\/]/).filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 2] : ''
}

export default function TabBar({ tabs, activeId, onSelect, onClose }: Props): React.JSX.Element {
  const list = useRef<HTMLDivElement>(null)

  // Keep the active tab in view when there are more tabs than room.
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeId, tabs.length])

  const nameCount = new Map<string, number>()
  for (const t of tabs) nameCount.set(t.name, (nameCount.get(t.name) ?? 0) + 1)

  return (
    <div ref={list} role="tablist" aria-label="開啟的檔案" className="flex shrink-0 overflow-x-auto border-b bg-muted/40">
      {tabs.map((tab) => {
        const active = tab.id === activeId
        const hint = (nameCount.get(tab.name) ?? 0) > 1 ? parentOf(tab.path) : ''
        return (
          <div
            key={tab.id}
            role="tab"
            tabIndex={0}
            aria-selected={active}
            data-active={active}
            title={tab.path ?? tab.name}
            onClick={() => onSelect(tab.id)}
            // Middle click closes, as in most editors.
            onAuxClick={(e) => e.button === 1 && onClose(tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(tab.id)
              }
            }}
            className={cn(
              'group/tab flex h-9 max-w-52 min-w-24 shrink-0 cursor-pointer items-center gap-1 border-r pr-1 pl-3 text-sm select-none',
              active
                ? 'bg-background text-foreground shadow-[inset_0_2px_0_0_var(--color-primary)]'
                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
            )}
          >
            <span className="truncate">
              {tab.name}
              {hint && <span className="ml-1.5 text-xs opacity-60">{hint}</span>}
            </span>
            <button
              type="button"
              aria-label={tab.dirty ? `關閉 ${tab.name}（尚未儲存）` : `關閉 ${tab.name}`}
              onClick={(e) => {
                e.stopPropagation()
                onClose(tab.id)
              }}
              className="group/close ml-auto grid size-5 shrink-0 cursor-pointer place-items-center rounded-sm hover:bg-accent"
            >
              {tab.dirty ? (
                <>
                  {/* Unsaved: a dot that turns into the close cross when the pointer is on it. */}
                  <span className="size-2 rounded-full bg-foreground/70 group-hover/close:hidden" />
                  <X className="hidden size-3.5 group-hover/close:block" />
                </>
              ) : (
                <X className="size-3.5 opacity-0 group-hover/tab:opacity-100 group-data-[active=true]/tab:opacity-100" />
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
