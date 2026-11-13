# Hot Compress product plan

## Accepted scope

Build a low-instruction batch image/video optimizer accessible through a shared CLI, Codex skill, GitHub Action, and drag-and-drop GUI. The user approved local web GUI first, TypeScript/npm, the existing folder, local-only development, WebP/PNG/MP4 defaults, optional AVIF, preserved originals, and camera RAW later. Video belongs in v0.1. Native Mac packaging and hosted web delivery follow the local version.

## Architecture

- `src/engine.ts`: filesystem discovery, options, ImageMagick conversion, FFmpeg conversion, reporting, responsive HTML.
- `src/cli.ts`: command arguments and human/JSON reports.
- `src/server.ts`: local HTTP server, streaming uploads, directory jobs, progress, authorized result downloads/ZIP.
- `web/`: static, dependency-free browser interface.
- `skills/hot-compress/`: reusable skill and launcher.
- `action.yml`, `scripts/action.mjs`: reusable composite Action; source code runs against system codecs.
- `test/`: real media and server integration checks.

ImageMagick provides HEIC through libheif and wide still-image input support, avoiding the standard Sharp binary's HEIC limitation. FFmpeg provides video decoding, H.264/AAC export, scaling and fast-start MP4. No runtime npm dependencies or paid services. IM6 fallback supports the standard Linux package; IM7 is preferred on Mac. One engine ensures entry points share rules.

## v0.1 behavior

Balanced quality, bounded dimensions, no crop/upscale, metadata removal, auto-orientation/sRGB for images. Alpha images use lossless PNG; opaque images use WebP with optional AVIF. Output batches never overwrite sources or previous runs. Report every processed result and actual byte changes. Responsive image widths plus editable sizes attribute and HTML snippets. Video preserves first audio track, max 30 fps, H.264 MP4. Animated/multipage images, alpha video, HDR video, corrupt files and unavailable codecs produce explicit errors without partial outputs. Quality choices are presets, not automatic perceptual analysis.

## Next milestones

1. Visual GUI QA in enabled browsers; collect representative real-camera samples, especially wide-gamut HEIC and very large TIFF. Validate Linux codec coverage and GitHub workflows in a published repo.
2. Incremental hashing/cache, cancellation and queue management; image preview and comparison; target-byte budgets and perceptual scoring to justify automatic quality selection.
3. Signed Mac app packaging with bundled/versioned codecs, Finder drops, OS folder permission handling, updater and license notices. Reuse the engine and interface; choose wrapper after packaging/license review.
4. Hosted web delivery: evaluate browser-local WASM for supported formats, with explicit coverage and memory limits. For full HEIC/large-video parity, provide an opt-in upload backend with resource limits, job isolation, automatic deletion and clear privacy language. Hosting/domain/provider remain undecided; local-only approval does not authorize deployment.
5. Camera RAW via a tested RAW pipeline; HDR tone mapping, WebM alpha video, animation, poster frames, responsive video, CSS breakpoint import and art direction.

## Sources behind technical decisions

- https://sharp.pixelplumbing.com/install/ — standard binary input coverage.
- https://sharp.pixelplumbing.com/api-output/ — HEIC requires a custom libvips build.
- https://imagemagick.org/script/formats.php/ — format/delegate coverage.
- https://ffmpeg.org/ffmpeg-formats.html — containers and muxer options.
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows — available automation events.

No cloud service, repo publication, or domain setup is included in the approved local-first implementation.
