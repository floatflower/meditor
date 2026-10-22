import { useTranslation } from 'react-i18next'
import type { PluginEntry } from '@/lib/plugins'
import ExtensionFooter from './ExtensionFooter'
import ToggleRow from './ToggleRow'

interface Props {
  entries: PluginEntry[]
  onToggle: (file: string, enabled: boolean) => void
  onOpenFolder: () => void
  onReload: () => void
}

export default function PluginsTab({ entries, onToggle, onOpenFolder, onReload }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const builtin = entries.filter((e) => e.builtin)
  const custom = entries.filter((e) => !e.builtin)

  const row = (e: PluginEntry): React.JSX.Element => (
    <ToggleRow
      key={e.file}
      id={`plugin:${e.file}`}
      title={e.builtin ? t(`plugins.${e.file.replace('builtin:', '')}`) : e.name}
      problem={e.error ? t('settings.plugins.error', { error: e.error }) : undefined}
      checked={e.enabled}
      onChange={(enabled) => onToggle(e.file, enabled)}
    />
  )

  return (
    <div className="grid gap-4">
      <section className="grid gap-1.5">
        <h3 className="text-sm font-medium">{t('settings.plugins.builtin')}</h3>
        {builtin.map(row)}
      </section>
      <section className="grid gap-1.5">
        <h3 className="text-sm font-medium">{t('settings.plugins.custom')}</h3>
        {custom.length ? custom.map(row) : <p className="text-sm text-muted-foreground">{t('settings.plugins.noCustom')}</p>}
      </section>
      <ExtensionFooter
        openLabel={t('settings.plugins.openFolder')}
        reloadLabel={t('settings.plugins.reload')}
        onOpen={onOpenFolder}
        onReload={onReload}
      />
    </div>
  )
}
