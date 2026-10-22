import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { LANGUAGES, LANGUAGE_NAMES, type LanguageSetting } from '../../../../shared/i18n'
import DefaultAppGuide from './DefaultAppGuide'

interface Props {
  language: LanguageSetting
  onLanguageChange: (setting: LanguageSetting) => void
}

export default function GeneralTab({ language, onLanguageChange }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const [guideOpen, setGuideOpen] = useState(false)

  return (
    <div className="grid gap-5">
      <section className="grid gap-1.5">
        <label htmlFor="settings-language" className="text-sm font-medium">
          {t('settings.general.language')}
        </label>
        <Select id="settings-language" value={language} onChange={(e) => onLanguageChange(e.target.value as LanguageSetting)}>
          <option value="system">{t('settings.general.system')}</option>
          {/* Each language in its own script, so a language you cannot read is still findable. */}
          {LANGUAGES.map((value) => (
            <option key={value} value={value}>
              {LANGUAGE_NAMES[value]}
            </option>
          ))}
        </Select>
        <p className="text-sm text-muted-foreground">{t('settings.general.hint')}</p>
      </section>

      <section className="grid gap-1.5">
        <h3 className="text-sm font-medium">{t('settings.general.defaultApp.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('settings.general.defaultApp.hint')}</p>
        <div>
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setGuideOpen(true)}>
            {t('settings.general.defaultApp.button')}
          </Button>
        </div>
      </section>

      <DefaultAppGuide open={guideOpen} onOpenChange={setGuideOpen} />
    </div>
  )
}
