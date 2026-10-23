import { useEffect, useState } from 'react'
import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { STRINGS, initialLang, type Lang } from '@/lib/i18n'
import { REPO_URL } from '@/lib/releases'
import { cn } from '@/lib/utils'

export function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  )
}

/** The page's language, remembered between visits and shared by every page of the site. */
export function useLang(): [Lang, (lang: Lang) => void] {
  const [lang, setLang] = useState<Lang>(initialLang)
  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem('meditor.site.lang', lang)
    } catch {
      // not saved
    }
  }, [lang])
  return [lang, setLang]
}

interface HeaderProps {
  lang: Lang
  onLang: (lang: Lang) => void
  /** Where the site root is from this page: '' on the home page, '../' one folder down. */
  root: string
  current: 'home' | 'syntax'
}

export function SiteHeader({ lang, onLang, root, current }: HeaderProps) {
  const s = STRINGS[lang]
  const link = 'hidden rounded-md px-3 py-1.5 hover:text-foreground sm:block'
  return (
    <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
        <a href={`${root || './'}`} className="flex items-center gap-2.5 font-semibold">
          <img src={`${root}icon.png`} alt="" className="size-7 rounded-md" />
          MEditor
        </a>
        <nav className="flex items-center gap-1 text-sm">
          <a href={`${root}#features`} className={cn(link, 'text-muted-foreground')}>
            {s.nav.features}
          </a>
          <a
            href={`${root}syntax/`}
            aria-current={current === 'syntax' ? 'page' : undefined}
            className={cn(link, current === 'syntax' ? 'font-medium text-foreground' : 'text-muted-foreground')}
          >
            {s.nav.syntax}
          </a>
          <a href={`${root}#download`} className={cn(link, 'text-muted-foreground')}>
            {s.nav.download}
          </a>
          <Button variant="ghost" size="sm" onClick={() => onLang(lang === 'zh-TW' ? 'en' : 'zh-TW')} aria-label="Language">
            <Languages />
            {lang === 'zh-TW' ? 'EN' : '中文'}
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              <GitHubMark className="size-4" />
              <span className="hidden sm:inline">{s.nav.github}</span>
            </a>
          </Button>
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter({ lang, root }: { lang: Lang; root: string }) {
  const s = STRINGS[lang]
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <img src={`${root}icon.png`} alt="" className="size-5 rounded" />
          MEditor · {s.footer.license}
        </div>
        <div className="flex items-center gap-4">
          <a href={`${root}syntax/`} className="hover:text-foreground">
            {s.nav.syntax}
          </a>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-foreground">
            GitHub
          </a>
          <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer" className="hover:text-foreground">
            {s.footer.issues}
          </a>
        </div>
      </div>
    </footer>
  )
}
