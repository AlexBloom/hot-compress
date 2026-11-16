# Status

Updated November 16, 2026, America/New_York. Built directly on Alex's Mac at `/Users/alexbloom/Documents/GitHub/hot-compress`. Branch `dev`. No GitHub remote, publication or deployment.

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
- System codecs and installed CLI/skill remain available. Live GitHub execution and Linux codecs are not verified.

## Preview

- Running command: `npm start`.
- Base URL: `http://127.0.0.1:4318/`; use the authorized link printed by the server. Session tokens are not committed.
- Current process PID 7496, persistent command session 87159. Console output is captured in the command session; no disk logfile configured.
- Restart: stop the current process, then `hot-compress gui` or `npm start`. Build frontend changes with `npm run build` and reload; restart for backend changes.
- Production: not deployed.

## Boundaries / next work

The first preview can be slower for large RAW images or slow encoders because full output is encoded before cropping. The canvas lists at most 2000 files; folder export still processes all supported files. Preview frame bytes are not a full-video file-size estimate. Prepared-source/thumbnail disk caches last for the session; large selections can consume disk space.

Camera-mode support depends on LibRaw. Multi-shot RAW, animation optimization, HDR processing and video alpha remain unimplemented and reported. Preserve format re-encodes prepared copies. No arbitrary byte budget, perceptual quality score, platform-upload A/B experiment, universal account validator or live policy refresh is claimed.

Native Mac packaging and hosted web delivery remain future work. Validate Linux/live GitHub before publishing the Action. Additional camera samples and controlled platform tests would improve future guidance.
