# CDNHFX - HtmlForgeX CDN Assets

CDNHFX hosts the Scripts/Styles/Images/Fonts used by HtmlForgeX. It is a mirror
repository that is published to multiple CDNs so HtmlForgeX can serve assets
reliably worldwide.

## CDN endpoints

- Custom domain (recommended): https://cdnhfx.evotec.xyz
- GitHub Pages (latest): https://evotecit.github.io/CDNHFX
- jsDelivr (tagged, immutable): https://cdn.jsdelivr.net/gh/evotecit/cdnhfx@<TAG>/

## Versioning model

- Latest (unversioned): `/Scripts`, `/Styles`, `/Images`, `/Fonts`
- Versioned: `/v/<VERSION>/Scripts`, `/v/<VERSION>/Styles`, `/v/<VERSION>/Images`, `/v/<VERSION>/Fonts`

HtmlForgeX defaults to versioned URLs using the `HfxVersion` baked into the library.

## Examples

Versioned:

- https://cdnhfx.evotec.xyz/v/0.3.2/Scripts/dataTables.min.js
- https://cdnhfx.evotec.xyz/v/0.3.2/Styles/hfx-theme.css

Latest:

- https://cdnhfx.evotec.xyz/Scripts/dataTables.min.js
- https://cdnhfx.evotec.xyz/Styles/hfx-theme.css

jsDelivr:

- https://cdn.jsdelivr.net/gh/evotecit/cdnhfx@0.3.2/Scripts/dataTables.min.js
- https://cdn.jsdelivr.net/gh/evotecit/cdnhfx@0.3.2/Fonts/fontawesome-6/fa-solid-900.woff2

## Sync model

- Assets are synced from the HtmlForgeX repository (`HtmlForgeX/Resources/**`).
- GitHub Actions copies assets to both the latest (root) and versioned (`/v/<VERSION>`) paths.
- Manual export uses `Build/ExportCdn.ps1` from the HtmlForgeX repo when needed.

## Why this repo exists

Some HtmlForgeX assets are large, customized, or not hosted elsewhere. CDNHFX
keeps a single source of truth and provides consistent URLs for HtmlForgeX.
