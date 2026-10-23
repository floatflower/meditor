import { useEffect, useMemo, useState } from 'react'
import {
  Bot,
  ChartColumn,
  Download as DownloadIcon,
  Eye,
  FileOutput,
  FolderTree,
  ImagePlus,
  Laptop,
  Monitor,
  Palette,
  Scale,
  Terminal,
  Type,
  type LucideIcon
} from 'lucide-react'
import { GitHubMark, SiteFooter, SiteHeader, useLang } from '@/components/Chrome'
import Demo from '@/components/Demo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { STRINGS } from '@/lib/i18n'
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
  const [lang, setLang] = useLang()
  const [release, setRelease] = useState<Release | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [detected, setDetected] = useState<Detected>({ platform: null, arch: null })
  const s = STRINGS[lang]
  useReveal(release, loaded)

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
      <SiteHeader lang={lang} onLang={setLang} root="" current="home" />

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

      <SiteFooter lang={lang} root="" />
    </div>
  )
}
