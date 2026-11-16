---
name: hot-compress
description: Optimize local images and videos for web delivery in batches, preserving originals and image transparency. Use for compressing asset folders, HEIC conversion, responsive image exports, and preparing web media before a PR.
---

# Hot Compress

Run the shared local engine rather than recreating conversion commands. Use the folder or files from the request. If the input path is missing and cannot be inferred from attached files or project context, ask for it.

Use `scripts/compress.sh <file-or-folder> [...]`. Default output is a new batch under `./optimized`; originals are never replaced. Default is balanced WebP for opaque images, lossless PNG for transparent images, and H.264 MP4 for video. Camera RAW develops through LibRaw using sensor data; unsupported cameras/variants are reported. Animated images, HDR video and alpha video are not optimized; retain sources and report these exceptions.

- For responsive web images, add `--responsive`; optionally `--widths 480,768,1280,1920` and `--sizes '(max-width: 768px) 100vw, 1280px'`. Widths are image pixels, not inferred CSS breakpoints. No upscaling. Video variants are not generated.
- Use `--destination app|instagram|facebook|tiktok|youtube|x|sharing` for the intended pipeline. Social upload presets retain more quality/motion than the web default. Read the repository’s `docs/OUTPUT-RESEARCH.md` when platform-specific acceptance or latest format guidance matters; guidance is dated, not a live policy guarantee.
- Use `--format preserve` to retain the source image format while re-encoding; RAW renders to TIFF. Custom formats include JPEG/PNG/WebP/AVIF/TIFF/HEIC/JXL; codec tools must be installed. `--tiff-compression zip|lzw|jpeg|none`, `--quality`, `--lossless`, `--video-format`, `--video-crf` and `--frame-rate` expose the shared engine settings. Never describe preservation as an unchanged file.
- Use `--format avif` if smaller/slower export is requested. Use `--preset smaller` or `--preset quality` when the request favors size or fidelity.
- Use `--json` to inspect the report programmatically; `doctor` checks codec dependencies; `gui` opens the Mac's local web interface.

Report the output directory, actual byte savings (or growth), and every skipped/failed item. Generated `snippets.html` includes image dimensions and responsive markup. Review `sizes` for the actual layout, add meaningful alt text, and use eager loading/fetchpriority for an LCP hero. Do not replace project references or commit generated assets unless the user's request includes that step.

The downloadable skill includes its built engine under `resources/engine/`; no repository checkout or npm build is needed. It requires Node (24 recommended) and system codecs: on Mac, `brew install node imagemagick ffmpeg libraw jpeg-xl`. The Mac app bundles Node; the launcher can use that runtime when installed in Applications.

If a repository-installed launcher cannot find the engine, set `HOT_COMPRESS_HOME` to the Hot Compress repository and run `npm ci && npm run build` there. Codec installation is documented in that repository's README.
