import { ExternalLink, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { UpdateState } from '../../../../shared/update'
import ToggleRow from './ToggleRow'

interface Props {
  update: UpdateState | null
  onCheck: () => void
  onOpenPage: () => void
  onAutoCheck: (value: boolean) => void
}

export default function UpdateSection({ update, onCheck, onOpenPage, onAutoCheck }: Props): React.JSX.Element | null {
  const { t } = useTranslation()
  if (!update) return null

  const { status, version } = update
  const text: Record<string, string> = {
    unsupported: t('settings.general.updates.unsupported'),
    idle: t('settings.general.updates.idle'),
    checking: t('settings.general.updates.checking'),
    'up-to-date': t('settings.general.updates.upToDate'),
    available: t('settings.general.updates.available', { version }),
    error: t('settings.general.updates.error', { error: update.error })
  }

  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-medium">{t('settings.general.updates.title')}</h3>
      <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-sm">
        <div className="grid min-w-0 gap-0.5">
          <span className="font-medium">{t('settings.general.updates.current', { version: update.currentVersion })}</span>
          <span className={status === 'error' ? 'break-words text-destructive' : 'text-muted-foreground'} aria-live="polite">
            {text[status]}
          </span>
        </div>
        <div className="flex shrink-0 gap-1">
          {status === 'available' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon-sm" className="cursor-pointer" aria-label={t('settings.general.updates.openPage')} onClick={onOpenPage}>
                  <ExternalLink />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('settings.general.updates.openPage')}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                className="cursor-pointer"
                aria-label={t('settings.general.updates.check')}
                disabled={status === 'unsupported' || status === 'checking'}
                onClick={onCheck}
              >
                <RefreshCw className={status === 'checking' ? 'animate-spin' : undefined} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('settings.general.updates.check')}</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <ToggleRow
        id="settings-auto-update"
        title={t('settings.general.updates.auto')}
        hint={t('settings.general.updates.autoHint')}
        checked={update.autoCheck}
        disabled={status === 'unsupported'}
        onChange={onAutoCheck}
      />
    </section>
  )
}
