import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { PluginEntry } from '@/lib/plugins'
import type { Theme } from '@/lib/themes'
import type { LanguageSetting } from '../../../shared/i18n'
import AiTab from './settings/AiTab'
import AppearanceTab from './settings/AppearanceTab'
import GeneralTab from './settings/GeneralTab'
import PluginsTab from './settings/PluginsTab'

const TABS = ['general', 'appearance', 'plugins', 'ai'] as const
type TabName = (typeof TABS)[number]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  language: LanguageSetting
  onLanguageChange: (setting: LanguageSetting) => void
  themes: Theme[]
  theme: string
  onPickTheme: (name: string) => void
  plugins: PluginEntry[]
  onTogglePlugin: (file: string, enabled: boolean) => void
  /** Open the themes or plugins folder in the file manager. */
  onOpenFolder: (kind: 'themes' | 'plugins') => void
  onReload: () => void
}

export default function SettingsDialog({
  open,
  onOpenChange,
  language,
  onLanguageChange,
  themes,
  theme,
  onPickTheme,
  plugins,
  onTogglePlugin,
  onOpenFolder,
  onReload
}: Props): React.JSX.Element {
  const { t } = useTranslation()
  const [tab, setTab] = useState<TabName>('general')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('settings.close')} className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('settings.title')}</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as TabName)}>
          <TabsList className="w-full">
            {TABS.map((name) => (
              <TabsTrigger key={name} value={name} className="cursor-pointer">
                {t(`settings.tabs.${name}`)}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="general" className="mt-3 min-h-64">
            <GeneralTab language={language} onLanguageChange={onLanguageChange} />
          </TabsContent>
          <TabsContent value="appearance" className="mt-3 min-h-64">
            <AppearanceTab
              themes={themes}
              current={theme}
              onPick={onPickTheme}
              onOpenFolder={() => onOpenFolder('themes')}
              onReload={onReload}
            />
          </TabsContent>
          <TabsContent value="plugins" className="mt-3 min-h-64">
            <PluginsTab entries={plugins} onToggle={onTogglePlugin} onOpenFolder={() => onOpenFolder('plugins')} onReload={onReload} />
          </TabsContent>
          <TabsContent value="ai" className="mt-3 min-h-64">
            <AiTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
