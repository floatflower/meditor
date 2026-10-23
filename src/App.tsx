import { useEffect, useMemo, useState } from 'react'
import {
  Bot,
  ChartColumn,
  Download as DownloadIcon,
  Eye,
  FileOutput,
  FolderTree,
  ImagePlus,
  Languages,
  Laptop,
  Monitor,
  Palette,
  Scale,
  Terminal,
  Type,
  type LucideIcon
} from 'lucide-react'
import Demo from '@/components/Demo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { STRINGS, initialLang, type Lang } from '@/lib/i18n'
import {
  RELEASES_URL,
  REPO_URL,
  detectPlatform,
  fetchRelease,
  formatSize,
  type Detected,
  type Download,
  type Platform,
  type Release
} from '@/lib/releases'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = {
  eye: Eye,
  chart: ChartColumn,
  palette: Palette,
  bot: Bot,
  export: FileOutput,
  folder: FolderTree,
  image: ImagePlus,
  type: Type,
  scale: Scale
}

const PLATFORM_ICON: Record<Platform, LucideIcon> = { mac: Laptop, win: Monitor, linux: Terminal }

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  )
}

/**
 * Fades elements in as they scroll into view. Without script they stay visible. Some elements only appear
 * once the release has been fetched, so the page is scanned again whenever `watch` changes.
 */
function useReveal(...watch: unknown[]): void {
  useEffect(() => {
    document.documentElement.classList.add('js')
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.12 }
    )
    document.querySelectorAll('.reveal:not(.in), .tilt:not(.in)').forEach((el) => io.observe(el))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, watch)
}

function pickPrimary(release: Release | null, detected: Detected): Download | null {
  if (!release || !detected.platform) return null
  const options = release.downloads.filter((d) => d.platform === detected.platform)
  if (detected.platform === 'mac') return options.find((d) => d.kind === (detected.arch ?? 'arm64')) ?? options[0] ?? null
  return options.find((d) => d.kind === 'installer' || d.kind === 'appimage') ?? options[0] ?? null
}

export default function App(): React.JSX.Element {
  const [lang, setLang] = useState<Lang>(initialLang)
  const [release, setRelease] = useState<Release | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [detected, setDetected] = useState<Detected>({ platform: null, arch: null })
  const s = STRINGS[lang]
  useReveal(release, loaded)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem('meditor.site.lang', lang)
    } catch {
      // not saved
    }
  }, [lang])

  useEffect(() => {
    void detectPlatform().then(setDetected)
    void fetchRelease().then((r) => {
      setRelease(r)
      setLoaded(true)
    })
  }, [])

  const primary = useMemo(() => pickPrimary(release, detected), [release, detected])
  const osName = detected.platform ? s.download[detected.platform] : null

  const groups = useMemo(
    () => (['mac', 'win', 'linux'] as Platform[]).map((p) => ({ platform: p, items: release?.downloads.filter((d) => d.platform === p) ?? [] })),
    [release]
  )

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
          <a href="#top" className="flex items-center gap-2.5 font-semibold">
            <img src="./icon.png" alt="" className="size-7 rounded-md" />
            MEditor
          </a>
          <nav className="flex items-center gap-1 text-sm">
            <a href="#features" className="hidden rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground sm:block">
              {s.nav.features}
            </a>
            <a href="#download" className="hidden rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground sm:block">
              {s.nav.download}
            </a>
            <Button variant="ghost" size="sm" onClick={() => setLang(lang === 'zh-TW' ? 'en' : 'zh-TW')} aria-label="Language">
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

      <main id="top">
        {/* Hero */}
        <section className="relative isolate">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="blob blob-a -top-24 -left-20 size-[420px]" />
            <div className="blob blob-b top-10 right-[-6rem] size-[460px]" />
            <div className="blob blob-c top-[22rem] left-1/3 size-[360px]" />
          </div>
          <div className="mx-auto max-w-6xl px-5 pt-16 pb-10 text-center sm:pt-24">
            <div className="rise flex justify-center" style={{ animationDelay: '0ms' }}>
              <Badge variant="outline" className="bg-background/60 backdrop-blur">
                {s.hero.badge}
              </Badge>
            </div>
            <h1 className="mx-auto mt-6 max-w-4xl text-5xl leading-[1.12] font-extrabold tracking-tight sm:text-7xl">
              <span className="rise block" style={{ animationDelay: '120ms' }}>
                {s.hero.slogan1}
              </span>
              <span className="rise block pb-2" style={{ animationDelay: '280ms' }}>
                <span className="shimmer-text">{s.hero.slogan2}</span>
              </span>
            </h1>
            <p className="rise mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground" style={{ animationDelay: '440ms' }}>
              {s.hero.subtitle}
            </p>
            <div className="rise mt-9 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: '600ms' }}>
              <Button size="lg" className="h-12 gap-2 px-6 text-base" asChild>
                <a href={primary?.url ?? '#download'}>
                  <DownloadIcon />
                  {osName ? s.hero.downloadFor(osName) : s.hero.download}
                </a>
              </Button>
              <Button size="lg" variant="outline" className="h-12 gap-2 bg-background/60 px-6 text-base backdrop-blur" asChild>
                <a href={REPO_URL} target="_blank" rel="noreferrer">
                  <GitHubMark className="size-4" />
                  {s.hero.viewSource}
                </a>
              </Button>
            </div>
            <p className="rise mt-4 text-sm text-muted-foreground" style={{ animationDelay: '700ms' }}>
              {s.hero.free}
            </p>

            <div className="rise mx-auto mt-14 max-w-4xl text-left" style={{ animationDelay: '820ms' }}>
              <div className="float">
                <Demo lang={lang} />
              </div>
              <p className="mt-4 text-center text-sm text-muted-foreground">{s.hero.demoTitle}</p>
            </div>
          </div>
        </section>

        {/* Marquee */}
        <section aria-hidden className="marquee border-y bg-muted/30 py-4">
          <div className="marquee-track">
            {[...s.marquee, ...s.marquee].map((item, i) => (
              <span key={i} className="mx-6 text-sm font-medium whitespace-nowrap text-muted-foreground">
                {item}
                <span className="ml-12 text-primary/40">✦</span>
              </span>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-14 px-5 py-24">
          <div className="reveal mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{s.features.title}</h2>
            <p className="mt-3 text-muted-foreground">{s.features.subtitle}</p>
          </div>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {s.features.items.map((f, i) => {
              const Icon = ICONS[f.icon]
              return (
                <Card
                  key={f.title}
                  className="glow-card reveal"
                  style={{ '--delay': `${(i % 3) * 90}ms` } as React.CSSProperties}
                  onMouseMove={(e) => {
                    const r = e.currentTarget.getBoundingClientRect()
                    e.currentTarget.style.setProperty('--x', `${e.clientX - r.left}px`)
                    e.currentTarget.style.setProperty('--y', `${e.clientY - r.top}px`)
                  }}
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle>{f.title}</CardTitle>
                  <CardDescription>{f.body}</CardDescription>
                </Card>
              )
            })}
          </div>
        </section>

        {/* Screenshots */}
        <section className="border-y bg-muted/30 py-24">
          <div className="mx-auto max-w-6xl px-5">
            <div className="reveal mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{s.showcase.title}</h2>
              <p className="mt-3 text-muted-foreground">{s.showcase.subtitle}</p>
            </div>
            <div className="mt-14 grid gap-10 lg:grid-cols-2">
              {[
                { src: './screens/editor.png', label: s.showcase.editor },
                { src: './screens/manuscript.png', label: s.showcase.manuscript }
              ].map((shot) => (
                <figure key={shot.src} className="tilt">
                  <img
                    src={shot.src}
                    alt={shot.label}
                    loading="lazy"
                    className="w-full rounded-xl border bg-card shadow-2xl shadow-primary/10"
                  />
                  <figcaption className="mt-3 text-center text-sm text-muted-foreground">{shot.label}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Download */}
        <section id="download" className="mx-auto max-w-5xl scroll-mt-14 px-5 py-24">
          <div className="reveal mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{s.download.title}</h2>
            <p className="mt-3 text-muted-foreground">{s.download.subtitle}</p>
            {release && (
              <p className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">{s.download.version(release.version)}</Badge>
                {release.prerelease && <Badge variant="outline">{s.download.prerelease}</Badge>}
                <span>{s.download.released(new Date(release.date).toLocaleDateString(lang))}</span>
                <a href={release.url} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-foreground">
                  {s.download.notes}
                </a>
              </p>
            )}
          </div>

          {!release && (
            <p className="reveal mt-10 text-center text-muted-foreground">
              {loaded ? s.download.noRelease : s.download.loading}
            </p>
          )}
          {!release && loaded && (
            <div className="mt-6 flex justify-center">
              <Button asChild>
                <a href={RELEASES_URL} target="_blank" rel="noreferrer">
                  {s.download.all}
                </a>
              </Button>
            </div>
          )}

          {release && (
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {groups.map(({ platform, items }, i) => {
                const Icon = PLATFORM_ICON[platform]
                const mine = detected.platform === platform
                return (
                  <Card
                    key={platform}
                    className={cn('reveal', mine && 'border-primary/60 ring-2 ring-primary/20')}
                    style={{ '--delay': `${i * 90}ms` } as React.CSSProperties}
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      <Icon className="size-5" />
                      {s.download[platform]}
                    </div>
                    <div className="flex flex-col gap-2">
                      {items.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
                      {items.map((d) => (
                        <Button key={d.name} variant={d === primary ? 'default' : 'outline'} className="h-auto justify-between gap-3 py-2.5" asChild>
                          <a href={d.url}>
                            <span className="flex items-center gap-2 text-left whitespace-normal">
                              <DownloadIcon />
                              {s.download[d.kind]}
                            </span>
                            <span className="text-xs opacity-70">{formatSize(d.size)}</span>
                          </a>
                        </Button>
                      ))}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}

          {detected.platform === null && loaded && <p className="mt-6 text-center text-sm text-muted-foreground">{s.download.mobile}</p>}

          <Card className="reveal mt-8">
            <CardTitle>{s.download.install.title}</CardTitle>
            <ul className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
              <li>{s.download.install.mac}</li>
              <li>{s.download.install.win}</li>
              <li>{s.download.install.linuxAppimage}</li>
              <li>{s.download.install.linuxDeb}</li>
            </ul>
          </Card>
          <p className="mt-6 text-center text-sm">
            <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="text-muted-foreground underline underline-offset-4 hover:text-foreground">
              {s.download.all}
            </a>
          </p>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src="./icon.png" alt="" className="size-5 rounded" />
            MEditor · {s.footer.license}
          </div>
          <div className="flex items-center gap-4">
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-foreground">
              GitHub
            </a>
            <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer" className="hover:text-foreground">
              {s.footer.issues}
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
