# Status

Updated November 16, 2026, America/New_York. Built directly on Alex's Mac at `/Users/alexbloom/Documents/GitHub/hot-compress`. Branch `dev`. Public repository created at https://github.com/AlexBloom/hot-compress. Release v0.2.0-preview.1 published; HTTPS Pages download/setup site is live at https://alexbloom.design/hot-compress/.

## Current workbench

- Inspected sibling `spiro-craft` and `tesselate` layout source. Applied their compact header, central canvas and independent side-panel principles: input / media / settings on desktop, canvas-first stacking on narrow screens.
- The middle canvas shows lazy WebP thumbnails bounded to 280 × 200 px. Hover, focus or click selects an item. Matching before/after crops use the current shared encoder settings; center/corner crop positions are available. The source is resized to the export dimensions before comparing, and displayed crops scale down to fit small panes.
- RAW renders use the LibRaw sensor pipeline. Video comparison uses the first frame of a one-second encoded sample, with bytes explicitly labeled as a sample. Unsupported media is not silently flattened or routed into an unrelated image decoder.
- Preview rendering has a two-task concurrency limit, debouncing/stale-response protection, cached prepared sources/thumbnails and a bounded 16-sample encoded cache. Original full-resolution files are not served as browser thumbnails.
- Files upload once per selection, then remain available for previews and repeat exports. Replaced/cleared uploads are removed; previews remain in temporary session storage. Interrupted processes can leave temporary files for OS cleanup.
- Wordmark: Gooper Condensed 5 Bold from `/Users/alexbloom/Documents/Fonts/Gooper/desktop/GooperCondensed5-Bold.otf`. Outlined SVG only; no font binary included. The arrow mark is retained.
- Destination summaries and notes now use concise format/dimension/frame-rate descriptions. Both auto-format labels say Recommended. The factual source-review date remains November 13; this was a copy edit, not a new policy review.
- Neutral shadcn controls, Use defaults / Customize, all export formats, skill, CLI and Action behavior remain available.

## Verified

- Build and backend/frontend TypeScript checks pass; Git diff whitespace check passes.
- All 16 integration tests pass. Existing conversion, alpha, RAW, codec, orientation, responsive, repeat-safety and server checks pass after the source-preparation refactor.
- New tests verify bounded thumbnails, real encoder-quality changes in decoded crop pixels, identical before crops across quality changes, crop-position changes, original preservation, RAW/alpha/video samples, unsupported-file handling, authorized preview assets, directory listing and repeat exports from selected uploads.
- Browser checked at 1440 × 900: three columns (240 / 880 / 320 px), loaded thumbnails including RAW and transparency, Gooper wordmark, encoder selection, quality changes, crop navigation and a completed four-file export. Preview image URLs changed with quality and no browser errors were captured.
- Narrow 480 px viewport has no page horizontal overflow and places the canvas before input/settings. Temporary viewport override reset afterward.
- Final preview shows four generated test assets from `/private/tmp/hot-canvas-demo`, not user photographs. Select Clear selection or choose another folder to replace them.
- Screenshot: `.hot-compress/preview-canvas.jpg` (ignored local artifact).
- System codecs and installed CLI/skill remain available. GitHub macOS CI is verified; Linux codecs remain unverified.

## Preview

- Running command: `npm start`.
- Base URL: `http://127.0.0.1:4318/`; use the authorized link printed by the server. Session tokens are not committed.
- Current process PID 7496, persistent command session 87159. Console output is captured in the command session; no disk logfile configured.
- Restart: stop the current process, then `hot-compress gui` or `npm start`. Build frontend changes with `npm run build` and reload; restart for backend changes.
- Production: https://alexbloom.design/hot-compress/ (download/setup website; media processing stays local).

## Boundaries / next work

The first preview can be slower for large RAW images or slow encoders because full output is encoded before cropping. The canvas lists at most 2000 files; folder export still processes all supported files. Preview frame bytes are not a full-video file-size estimate. Prepared-source/thumbnail disk caches last for the session; large selections can consume disk space.

Camera-mode support depends on LibRaw. Multi-shot RAW, animation optimization, HDR processing and video alpha remain unimplemented and reported. Preserve format re-encodes prepared copies. No arbitrary byte budget, perceptual quality score, platform-upload A/B experiment, universal account validator or live policy refresh is claimed.

Mac developer preview and portable skill packages are implemented; Pages download/setup deployment is live. Validate Linux/live GitHub before publishing the Action. Additional camera samples and controlled platform tests would improve future guidance.


## Distribution verification (November 16)

- Native AppKit/WKWebView bundle includes Node, compiled engine and the existing workbench. Apple Silicon/macOS 14+ package; ad-hoc signature verified, no Developer ID or notarization. Codec tools remain system dependencies.
- Portable skill ZIP includes the compiled engine. Isolated installation, doctor and a four-file batch (including RAW/alpha) passed without a checkout or npm build; existing-skill overwrite is refused.
- Mac native window startup, native file picker, transparent PNG comparison/export and ZIP save were verified. Download navigation cancellation is handled without closing the app.
- Static Pages source contains download links, honest signing/codec requirements, local-processing boundaries and the workbench screenshot. It serves no compression API. HTTPS is enforced; this project inherits the account’s existing alexbloom.design Pages domain. No DNS changes were made.


## Published release

- Public repo: https://github.com/AlexBloom/hot-compress (default `dev`). `main` requires PR promotion; force pushes/deletion disabled. Development checkout remains on `dev`.
- Promotion: https://github.com/AlexBloom/hot-compress/pull/1 (merged).
- Release: https://github.com/AlexBloom/hot-compress/releases/tag/v0.2.0-preview.1 — Apple Silicon Mac ZIP, portable skill ZIP, SHA256SUMS.txt. Both public downloads match the locally tested packages byte for byte.
- CI: https://github.com/AlexBloom/hot-compress/actions/runs/43952963885 — check, 16 integration tests, website build and both distribution builds passed on GitHub macOS. PR CI also passed.
- Pages: https://github.com/AlexBloom/hot-compress/actions/runs/43953578097 — successful manual main-only deployment. Live HTML and browser render verified at https://alexbloom.design/hot-compress/.
- Mac preview screenshots and native ZIP smoke test are ignored under `.hot-compress/`. Native picker/export testing generated synthetic PNG outputs under the app’s default Pictures workspace; originals were not modified.
- Next distribution work: Developer ID/notarization, bundled/versioned codecs, Intel verification and installer/updater. Current downloads remain honestly labeled developer previews.
