# Sheaf website

The product page for [Sheaf](https://github.com/floatflower/sheaf). This is an orphan branch: it shares no history
with `main`, which holds the app itself.

Vite, React, Tailwind v4 and shadcn/ui. Download links come from the GitHub Releases API at page load (no token is
needed for a public repository), so the page never has to be rebuilt for a new release.

```
npm install
npm run dev       # develop
npm run build     # type-check, then build into docs/
```

`docs/` is the build output and **is committed**: GitHub Pages serves it directly, so rebuild before pushing.

## Publishing

Repository Settings → Pages → Build and deployment → Source: **Deploy from a branch**, branch **`website`**, folder
**`/docs`**. The site is at **https://sheaf.floatflower.me** (`public/CNAME` holds the domain and every build copies it into
`docs/`). Every link is relative, so it also works at `https://<user>.github.io/sheaf/`.

## Editing

- Copy and translations (繁體中文 and English): `src/lib/i18n.ts`, including the slogan.
- The syntax guide: its text is `src/lib/syntax.*.json`, and the code samples are the `.md` files in `src/examples/`.
  The pictures in `public/examples/` were rendered from those same files by the app, so re-take them if a sample changes.
- Screenshots: `public/screens/`.
- Release lookup and which file is which platform: `src/lib/releases.ts`.
