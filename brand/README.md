# OpenLifeModel brand assets

The OpenLifeModel logo is a survival curve: flat through most of life, then
falling, with a dot at the median age. It is used by both the open-source
project and openlifemodel.com.

| File | Use |
| --- | --- |
| `openlifemodel-mark.svg` | Master logo (rounded square). Also `web/app/icon.svg`. |
| `openlifemodel-mark-square.svg` | Full-bleed variant for platforms that round corners themselves (Apple touch icon, GitHub avatar). |
| `openlifemodel-mark-maskable.svg` | Android maskable icon with the safe-zone padding. |
| `png/openlifemodel-mark-1024.png` | High-resolution PNG for documents and slides. |
| `png/github-avatar-512.png` | GitHub organization avatar. |
| `png/social-preview-1200x630.png` | GitHub repository social preview; same as the site's share image. |
| `og-image.tsx` | Source for `web/app/opengraph-image.png` (instructions inside). |

Colours: teal `#14b8a6` → `#0f766e` gradient, accent `#0d9488`, white mark.
Typeface: Inter (SIL Open Font License).

The web icons (`web/app/favicon.ico`, `apple-icon.png`, `web/public/icon-*.png`)
were rendered from these SVGs with `sharp` and `png-to-ico`.

## Using the logo

The files are in this repository so the reference app works out of the box, but
the OpenLifeModel name and logo are trademarks and are not licensed by the
Apache License (see [TRADEMARKS.md](../TRADEMARKS.md)). You may use the logo to
refer to the project, for example in an article or next to "compatible with
OpenLifeModel". If you host a fork publicly, replace the logo and name.
