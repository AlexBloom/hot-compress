# Hot Compress product plan

## Accepted scope

Build a low-instruction batch image/video optimizer accessible through a shared CLI, Codex skill, GitHub Action, and drag-and-drop GUI. The user approved local web GUI first, TypeScript/npm, the existing folder, local-only development, WebP/PNG/MP4 defaults, optional AVIF, preserved originals, and camera RAW later. Video belongs in v0.1. On November 13 the user expanded scope to RAW now, a neutral shadcn defaults/customize interface, additional output formats/compression settings, and researched channel guidance with tooltips and Reddit evidence. Native Mac packaging and hosted web delivery follow the local version.

## Architecture

- `src/engine.ts`: filesystem discovery, options, ImageMagick conversion, FFmpeg conversion, reporting, responsive HTML.
- `src/cli.ts`: command arguments and human/JSON reports.
- `src/server.ts`: local HTTP server, streaming uploads, directory jobs, progress, authorized result downloads/ZIP.
- `web/src/`: React/shadcn/Radix interface with Tailwind neutral tokens. Vite builds static assets into `web-dist/`.
- `src/guidance.ts`: shared dated codec and platform dataset; `docs/OUTPUT-RESEARCH.md`: evidence, current platform distinctions and research limitations.
- `skills/hot-compress/`: reusable skill and launcher.
- `action.yml`, `scripts/action.mjs`: reusable composite Action; source code runs against system codecs.
- `test/`: real media and server integration checks.

ImageMagick provides HEIC through libheif and wide still-image input support, avoiding the standard Sharp binary's HEIC limitation. FFmpeg provides video decoding, H.264/AAC export, scaling and fast-start MP4. No server/CLI runtime npm dependencies or paid services; GUI libraries are bundled at build time. LibRaw develops sensor RAW, and dedicated libjxl tools provide JXL independently of ImageMagick. IM6 fallback supports the standard Linux package; IM7 is preferred on Mac. One engine ensures entry points share rules.

## v0.1 behavior

Balanced quality, bounded dimensions, no crop/upscale, metadata removal, auto-orientation/sRGB for images. Alpha images use lossless PNG; opaque images use WebP with optional AVIF. Output batches never overwrite sources or previous runs. Report every processed result and actual byte changes. Responsive image widths plus editable sizes attribute and HTML snippets. Video preserves first audio track, max 30 fps, H.264 MP4. Animated/multipage images, multi-shot RAW, alpha video, HDR video, corrupt files and unavailable codecs produce explicit errors without partial outputs. Quality choices are presets, not automatic perceptual analysis.

## v0.2 additions (implemented)

- Neutral shadcn interface with Use defaults / Customize tabs. Defaults has file selection and one compression CTA. Customize groups input, RAW white balance, destination, image/video outputs, compression, resizing, responsive variants and output folder. Marketing/benefits copy was removed.
- RAW sensor development using LibRaw, with frame-count inspection and camera/auto white balance. Preserve-format RAW renders to TIFF. Synthetic CFA DNG tests plus a real Canon CR2 smoke check; full camera-mode coverage remains build-specific.
- Image auto/preserve/WebP/AVIF/JPEG/PNG/TIFF/HEIC/JXL. PNG effort, JPEG sampling, TIFF ZIP/LZW/JPEG/none, WebP/JXL lossless. Alpha policy still uses PNG.
- Video H.264/HEVC/VP9/AV1, supported codec/container preservation, CRF and source/30/60 fps choices. Destination upload presets retain more quality/motion than self-hosted web defaults.
- Self-hosted web, app/CDN origin, Instagram, Facebook, TikTok, YouTube, X and general-sharing destinations. Dated official/community source links; separate API/app facts from product choices. Algorithm tooltips work on hover/focus and click. Presets are not exhaustive compliance validators or guarantees of platform behavior.
- Existing CLI, installed skill and Action expose the same new settings.

## Layout follow-up

Restored the original hotcompress wordmark with its arrow mark, broad header/title spacing, and 1.45:1 desktop input/control split. Shadcn controls, neutral styling, Use defaults / Customize and reduced instructional copy remain. The layout stacks below 760 px; custom input controls stay in the input pane.

## Next milestones

1. Collect representative samples across current camera modes, especially compressed RAW/DNG, pixel shift and wide-gamut/HDR inputs. Validate Linux codecs and GitHub workflows in a published repo. Run controlled upload experiments rather than deriving stronger claims from Reddit.
2. Incremental hashing/cache, cancellation/queues, before/after previews, target-byte budgets and perceptual scoring on a representative corpus.
3. Signed Mac app with bundled/versioned codecs, Finder drops, OS permissions, updater and license notices. Reuse the engine and interface; select wrapper after packaging review.
4. Hosted web delivery: evaluate browser-local WASM for supported formats and memory limits; opt-in isolated upload processing for full HEIC/large-video parity. Provider/domain remain undecided; local-only authorization does not authorize deployment.
5. HDR tone mapping, alpha video, animation, multi-shot RAW selection/merging, posters, responsive video, CSS breakpoint import and art direction.

Technical and platform sources are maintained in `docs/OUTPUT-RESEARCH.md` and `src/guidance.ts`. No cloud service, repo publication or domain setup is included in this local implementation.
