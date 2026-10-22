import { useEffect, useState } from 'react'
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

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * An app cannot make itself the default for a file type: the operating system keeps that choice
 * for the user. So this says how, for the system the app is running on.
 */
export default function DefaultAppGuide({ open, onOpenChange }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const [info, setInfo] = useState<{ name: string; packaged: boolean; platform: string } | null>(null)

  useEffect(() => {
    if (open) void window.api.getAppInfo().then(setInfo)
  }, [open])

  const platform = info?.platform === 'darwin' ? 'mac' : info?.platform === 'win32' ? 'win' : 'other'
  const devNote = info && !info.packaged ? `\n\n${t('dialog.defaultApp.devNote')}` : ''

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(`dialog.defaultApp.${platform}.message`)}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line" data-slot="default-app-steps">
            {info ? t(`dialog.defaultApp.${platform}.detail`, { name: info.name, devNote }) : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {platform === 'win' ? (
            <>
              <AlertDialogCancel>{t('dialog.defaultApp.close')}</AlertDialogCancel>
              <AlertDialogAction onClick={() => void window.api.openDefaultAppsSettings()}>
                {t('dialog.defaultApp.openSettings')}
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogAction>{t('dialog.defaultApp.ok')}</AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
