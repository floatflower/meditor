import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  version: string
  /** Open the download page in the browser. */
  onOpen: () => void
  /** Close for good: it only comes back for a newer version. */
  onClose: () => void
}

/** A small notice in the bottom-right corner. Clicking it opens the download page; the cross closes it for good. */
export default function UpdateNotice({ version, onOpen, onClose }: Props): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div
      role="status"
      className="fixed right-4 bottom-10 z-50 flex w-72 items-start gap-1 rounded-lg border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 slide-in-from-bottom-2"
    >
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 cursor-pointer rounded-lg px-4 py-3 text-left hover:bg-accent">
        <span className="block text-sm font-medium">{t('updateNotice.title', { version })}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{t('updateNotice.body')}</span>
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('updateNotice.close')}
        title={t('updateNotice.close')}
        className="mt-2 mr-2 cursor-pointer rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
