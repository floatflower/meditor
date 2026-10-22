import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Theme } from '@/lib/themes'
import { cn } from '@/lib/utils'
import ExtensionFooter from './ExtensionFooter'

interface Props {
  themes: Theme[]
  current: string
  onPick: (name: string) => void
  onOpenFolder: () => void
  onReload: () => void
}

export default function AppearanceTab({ themes, current, onPick, onOpenFolder, onReload }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const builtin = themes.filter((th) => th.builtin)
  const custom = themes.filter((th) => !th.builtin)

  const list = (items: Theme[]): React.JSX.Element[] =>
    items.map((theme) => {
      const selected = theme.name === current
      return (
        <button
          key={theme.name}
          type="button"
          role="radio"
          aria-checked={selected}
          data-theme-name={theme.name}
          onClick={() => onPick(theme.name)}
          className={cn(
            'flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-left text-sm outline-none',
            'hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring',
            selected && 'border-primary bg-accent font-medium'
          )}
        >
          {theme.name}
          {selected && <Check className="size-4" />}
        </button>
      )
    })

  return (
    <div className="grid gap-4">
      <div role="radiogroup" aria-label={t('settings.tabs.appearance')} className="grid gap-4">
        <section className="grid gap-1.5">
          <h3 className="text-sm font-medium">{t('settings.appearance.builtin')}</h3>
          {list(builtin)}
        </section>
        <section className="grid gap-1.5">
          <h3 className="text-sm font-medium">{t('settings.appearance.custom')}</h3>
          {custom.length ? list(custom) : <p className="text-sm text-muted-foreground">{t('settings.appearance.noCustom')}</p>}
        </section>
      </div>
      <ExtensionFooter
        openLabel={t('settings.appearance.openFolder')}
        reloadLabel={t('settings.appearance.reload')}
        onOpen={onOpenFolder}
        onReload={onReload}
      />
    </div>
  )
}
