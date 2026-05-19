# Gnomad Capture

Full-page screen capture for Chrome — scroll, stitch, redact, and export to PNG or PDF. All processing stays in your browser.

## Features

- **Full-page stitching** — scrolls the page (or main scroll container), captures tiles, and merges them in the editor
- **Sticky/fixed hiding** — optionally hides fixed and sticky elements so headers do not repeat in every slice
- **Redaction** — drag black boxes over sensitive areas before export
- **Export** — PNG download, clipboard copy, single-page PDF, or paginated A4 PDF
- **Privacy-first** — no servers; captures live in extension storage until you export

## Install (development)

1. Clone [github.com/davidthegnomad/gnomad_capture](https://github.com/davidthegnomad/gnomad_capture)
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. **Load unpacked** → select this folder (must contain `manifest.json`)

## Usage

1. Open a normal website (not `chrome://` or the Web Store).
2. Click the Gnomad Capture toolbar icon → **Capture Full Page**.
3. Wait for the progress badge on the icon.
4. The **editor** tab opens when stitching is ready.
5. Drag to redact, then **Save PNG**, **Copy**, or **Export PDF**.

Right-click any page → **Gnomad: Capture Full Page**.

## Tests

```bash
npm test
```

Runs unit tests for scroll-position and stitch math (`lib/stitch.test.js`).

## Troubleshooting

| Issue | Fix |
|--------|-----|
| “Cannot capture this page” | Use a regular `https://` page, not Chrome settings or extensions |
| Blank or short capture | Increase **Load Delay** in the popup (try 800–1200 ms on heavy sites) |
| Repeated header in slices | Enable **Hide Sticky Elements** |
| Editor shows “No capture data” | Capture may have failed — check badge showed ERR and retry |

## Tech

Manifest V3 service worker, injected content script (single listener per tab), `chrome.tabs.captureVisibleTab`, Canvas stitch, jsPDF.

## License

MIT © 2026 David the Gnomad Inc.
