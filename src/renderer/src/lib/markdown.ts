import { unified, type PluggableList } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeShiki from '@shikijs/rehype'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'

export interface DirectiveContext {
  name: string
  kind: 'text' | 'leaf' | 'container'
  attributes: Record<string, string>
}

export interface DirectiveOutput {
  tagName: string
  properties?: Record<string, unknown>
}

/** Shape a user plugin (an ES module's default export) must have. */
export interface MdPlugin {
  name: string
  /** `:::name{attr=1}` style syntax → an HTML element. Children are rendered inside it. */
  directives?: Record<string, (ctx: DirectiveContext) => DirectiveOutput>
  remarkPlugins?: PluggableList
  /** rehype steps that run before code highlighting (needed when they consume `pre > code` blocks). */
  rehypePluginsBeforeHighlight?: PluggableList
  /** rehype steps that run after code highlighting. */
  rehypePlugins?: PluggableList
  /** Stylesheet, or a function of the rendered HTML so it can be left out when unused. */
  css?: string | ((html: string) => string)
  /** Markdown that explains this plugin's syntax to an AI assistant (shown by the MCP syntax guide). */
  docs?: string
  /** Runs on the rendered DOM (preview and export), e.g. to draw diagrams into placeholders. */
  postRender?: (root: HTMLElement, ctx: RenderContext) => void | Promise<void>
}

export interface RenderContext {
  themeCss: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = any

const callout = (kind: string, title?: string): DirectiveOutput => ({
  tagName: 'div',
  properties: { className: ['callout', `callout-${kind}`], dataTitle: title ?? kind }
})

function remarkDirectiveComponents(plugins: MdPlugin[]) {
  const handlers: NonNullable<MdPlugin['directives']> = {
    // Built in: `::pagebreak` on its own line.
    pagebreak: () => ({ tagName: 'div', properties: { className: ['page-break'], ariaHidden: 'true' } }),
    // Built in: `:::note` / `:::warning`, with `{title="..."}` to change the heading.
    note: ({ attributes }) => callout('note', attributes.title),
    warning: ({ attributes }) => callout('warning', attributes.title)
  }
  for (const p of plugins) Object.assign(handlers, p.directives)

  return (tree: AnyNode): void => {
    visit(tree, (node: AnyNode, index: number | undefined, parent: AnyNode) => {
      const type: string = node.type
      if (type !== 'textDirective' && type !== 'leafDirective' && type !== 'containerDirective') return
      const handler = handlers[node.name]

      if (!handler) {
        // `foo:bar` in prose parses as a text directive; give the text back instead of dropping it.
        if (type === 'textDirective' && parent && index !== undefined) {
          parent.children[index] = { type: 'text', value: `:${node.name}` }
        } else {
          node.data = {
            hName: 'div',
            hProperties: { className: ['directive', `directive-${node.name}`] }
          }
        }
        return
      }

      const out = handler({
        name: node.name,
        kind: type.replace('Directive', '') as DirectiveContext['kind'],
        attributes: node.attributes ?? {}
      })
      node.data = { hName: out.tagName, hProperties: out.properties ?? {} }
    })
  }
}

/**
 * A paragraph that holds nothing but an image (optionally wrapped in a link) becomes
 * `<figure>…<figcaption>alt</figcaption></figure>`. Themes that do not want captions can hide them
 * with `figcaption { display: none }`.
 */
function rehypeFigure() {
  const isBlank = (c: AnyNode): boolean => c.type === 'text' && !c.value.trim()
  return (tree: AnyNode): void => {
    visit(tree, 'element', (node: AnyNode, index: number | undefined, parent: AnyNode) => {
      if (node.tagName !== 'p' || !parent || index === undefined) return
      const kids = node.children.filter((c: AnyNode) => !isBlank(c))
      if (kids.length !== 1) return

      const only = kids[0]
      const inner = only.tagName === 'a' ? only.children.filter((c: AnyNode) => !isBlank(c)) : [only]
      const img = inner.length === 1 && inner[0].tagName === 'img' ? inner[0] : null
      const caption = String(img?.properties?.alt ?? '').trim()
      if (!img || !caption) return

      parent.children[index] = {
        type: 'element',
        tagName: 'figure',
        properties: {},
        children: [only, { type: 'element', tagName: 'figcaption', properties: {}, children: [{ type: 'text', value: caption }] }]
      }
    })
  }
}

export async function renderMarkdown(source: string, plugins: MdPlugin[] = []): Promise<string> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkDirectiveComponents, plugins)
  for (const p of plugins) if (p.remarkPlugins) processor.use(p.remarkPlugins)

  processor.use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw).use(rehypeFigure)
  // Math and diagrams must be handled before Shiki, which would otherwise treat them as code.
  for (const p of plugins) if (p.rehypePluginsBeforeHighlight) processor.use(p.rehypePluginsBeforeHighlight)
  processor.use(rehypeShiki, {
    themes: { light: 'github-light', dark: 'github-dark' },
    // CSS variables only (no inline colours), so a theme can restyle code blocks freely.
    defaultColor: false,
    fallbackLanguage: 'text'
  })
  for (const p of plugins) if (p.rehypePlugins) processor.use(p.rehypePlugins)

  const file = await processor.use(rehypeStringify).process(source)
  return String(file)
}

export async function runPostRender(root: HTMLElement, plugins: MdPlugin[], ctx: RenderContext): Promise<void> {
  for (const p of plugins) await p.postRender?.(root, ctx)
}

export function pluginCss(plugins: MdPlugin[], html: string): string {
  return plugins.map((p) => (typeof p.css === 'function' ? p.css(html) : (p.css ?? ''))).join('\n')
}
