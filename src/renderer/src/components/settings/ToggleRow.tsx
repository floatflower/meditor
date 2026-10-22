import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

interface Props {
  id: string
  title: string
  hint?: string
  /** Shown under the hint in red, e.g. why a plugin failed to load. */
  problem?: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

/** A labelled on/off switch. Clicking the text toggles it too. */
export default function ToggleRow({ id, title, hint, problem, checked, disabled, onChange }: Props): React.JSX.Element {
  return (
    <div className={cn('flex items-start justify-between gap-4 rounded-md border px-3 py-2.5 text-sm', disabled && 'opacity-60')}>
      <label htmlFor={id} className={cn('grid min-w-0 gap-0.5', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
        <span className="font-medium">{title}</span>
        {hint && <span className="text-muted-foreground">{hint}</span>}
        {problem && <span className="break-words text-destructive">{problem}</span>}
      </label>
      <Switch id={id} data-setting={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  )
}
