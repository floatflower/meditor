# Third-party notices

Folio's own code is released under the MIT License (see `LICENSE`). It bundles the following
material under its own terms, which is not covered by that license.

## Noto Sans and Noto Serif

`resources/fonts/` contains Noto Sans and Noto Serif (Latin, Traditional Chinese, Simplified Chinese,
Japanese and Korean), converted to WOFF2 by `scripts/make-fonts.py`. Exported documents embed subsets of
them. The fonts are copyright The Noto Project Authors and licensed under the
[SIL Open Font License 1.1](https://openfontlicense.org); the licence texts are the `OFL-*.txt` files in
that folder and ship with the app.

## npm dependencies

The libraries the app is built from (Electron, React, CodeMirror, unified and others) are distributed
under their own licenses, mostly MIT. See each package in `node_modules` for its license text.
