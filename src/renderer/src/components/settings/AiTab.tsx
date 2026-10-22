import { useEffect, useRef, useState } from 'react'
import { Copy, KeyRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AiPatch, AiState } from '../../../../shared/ai'
import ToggleRow from './ToggleRow'

/** The MCP server: whether it runs, what the AI may do, and how to connect a client. */
export default function AiTab(): React.JSX.Element {
  const { t } = useTranslation()
  const [ai, setAi] = useState<AiState | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [confirmingToken, setConfirmingToken] = useState(false)
  const noteTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    void window.api.getAi().then(setAi)
    return () => window.clearTimeout(noteTimer.current)
  }, [])

  if (!ai) return <div />

  const change = (patch: AiPatch): void => void window.api.setAi(patch).then(setAi)
  const tell = (text: string): void => {
    setNote(text)
    window.clearTimeout(noteTimer.current)
    noteTimer.current = window.setTimeout(() => setNote(null), 4000)
  }
  const copy = async (what: 'command' | 'json'): Promise<void> => {
    await (what === 'command' ? window.api.copyAiCommand() : window.api.copyAiJson())
    tell(t('settings.ai.copied'))
  }
  const regenerate = async (): Promise<void> => {
    setConfirmingToken(false)
    await window.api.regenerateAiToken()
    tell(t('dialog.token.done'))
  }

  const status = ai.error
    ? t('settings.ai.status.failed', { error: ai.error })
    : ai.running
      ? t('settings.ai.status.running', { port: ai.port })
      : t('settings.ai.status.off')

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{t('settings.ai.intro')}</p>

      <p data-slot="ai-status" className="flex items-center gap-2 text-sm">
        <span className={cn('size-2 shrink-0 rounded-full', ai.error ? 'bg-destructive' : ai.running ? 'bg-green-500' : 'bg-muted-foreground/50')} />
        {status}
      </p>

      <div className="grid gap-1.5">
        <ToggleRow id="ai-enable" title={t('settings.ai.enable')} checked={ai.enabled} onChange={(enabled) => change({ enabled })} />
        <ToggleRow
          id="ai-allow-write"
          title={t('settings.ai.allowWrite')}
          hint={t('settings.ai.allowWriteHint')}
          checked={ai.allowWrite}
          disabled={!ai.enabled}
          onChange={(allowWrite) => change({ allowWrite })}
        />
        <ToggleRow
          id="ai-direct-write"
          title={t('settings.ai.directWrite')}
          hint={t('settings.ai.directWriteHint')}
          checked={ai.directWrite}
          disabled={!ai.allowWrite}
          onChange={(directWrite) => change({ directWrite })}
        />
      </div>

      <section className="grid gap-1.5">
        <h3 className="text-sm font-medium">{t('settings.ai.connect')}</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="cursor-pointer" disabled={!ai.running} onClick={() => void copy('command')}>
            <Copy /> {t('settings.ai.copyCommand')}
          </Button>
          <Button variant="outline" size="sm" className="cursor-pointer" disabled={!ai.running} onClick={() => void copy('json')}>
            <Copy /> {t('settings.ai.copyJson')}
          </Button>
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setConfirmingToken(true)}>
            <KeyRound /> {t('settings.ai.regenerate')}
          </Button>
        </div>
        <p role="status" className="min-h-5 text-sm text-muted-foreground">
          {note}
        </p>
      </section>

      <AlertDialog open={confirmingToken} onOpenChange={setConfirmingToken}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialog.token.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('dialog.token.detail')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialog.token.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void regenerate()}>{t('dialog.token.regenerate')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
