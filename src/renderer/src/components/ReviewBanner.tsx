import { ChevronDown, ChevronUp, GitCompare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface Props {
  /** Changes waiting for a decision in the document being shown. */
  changes: number
  onPrevious: () => void
  onNext: () => void
  onAcceptAll: () => void
  onRejectAll: () => void
}

/** Sits above the editor while the AI's changes are being reviewed: whole-file accept / reject. */
export default function ReviewBanner({ changes, onPrevious, onNext, onAcceptAll, onRejectAll }: Props): React.JSX.Element | null {
  const { t } = useTranslation()
  if (changes === 0) return null

  return (
    <div
      role="status"
      data-slot="review-banner"
      className="flex shrink-0 items-center gap-2 border-b bg-amber-50 px-3 py-1.5 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <GitCompare className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{t('review.banner', { n: changes })}</span>
      <Button variant="ghost" size="icon-sm" className="cursor-pointer" aria-label={t('review.prev')} title={t('review.prev')} onClick={onPrevious}>
        <ChevronUp />
      </Button>
      <Button variant="ghost" size="icon-sm" className="cursor-pointer" aria-label={t('review.next')} title={t('review.next')} onClick={onNext}>
        <ChevronDown />
      </Button>
      <Button variant="outline" size="sm" className="cursor-pointer" onClick={onRejectAll}>
        {t('review.rejectAll')}
      </Button>
      <Button size="sm" className="cursor-pointer" onClick={onAcceptAll}>
        {t('review.acceptAll')}
      </Button>
    </div>
  )
}
