# MEditor website

The product page for [MEditor](https://github.com/floatflower/meditor). This is an orphan branch: it shares no history
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
**`/docs`**. The site is then at `https://<user>.github.io/meditor/`. Every link is relative, so a custom domain works
without changes.

## Editing

- Copy and translations (繁體中文 and English): `src/lib/i18n.ts`, including the slogan.
- Screenshots: `public/screens/`.
- Release lookup and which file is which platform: `src/lib/releases.ts`.
