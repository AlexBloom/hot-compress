# Hot Compress

Local-first image and video optimization for the web. One TypeScript engine powers a Mac browser GUI, command line, Codex skill, and GitHub Action. No accounts or cloud uploads. Originals are preserved; every run writes a unique folder under `optimized/`.

## Start on this Mac

```sh
npm ci
npm run build
npm start
```

The terminal prints an authorized localhost link and opens your browser. Drop files or folders, use either picker, or paste an absolute directory path. Click **Lighten the load**. Download individual results or the batch ZIP; the output folder also contains `report.json` and `snippets.html`.

Node 24 is recommended (minimum 22.18). System codecs:

```sh
# macOS
brew install imagemagick ffmpeg

# Ubuntu / Debian (ImageMagick 6 or 7)
sudo apt-get update
sudo apt-get install -y imagemagick ffmpeg zip
```

HEIC/AVIF decoding requires ImageMagick's libheif delegate. Codec availability varies by installed build; `hot-compress doctor` checks executables and actual conversion errors appear per file. `magick identify -list format` lists this installation's format support. RAW development is outside v0.1.

## Command line

```sh
# Optional: install the hot-compress command from this checkout
npm link --ignore-scripts

hot-compress ./assets
hot-compress ./shoot ./hero.mov --output ./web-ready
hot-compress ./assets --responsive
hot-compress ./assets --responsive --widths 480,768,1280,1920 \
  --sizes '(max-width: 768px) 100vw, 1280px'
hot-compress ./photos --format avif --preset smaller
hot-compress doctor
hot-compress gui
```

Without installing the command, use `node bin/hot-compress.mjs` in its place. Use `--help` for all flags and `--json` for a machine-readable report. Partial failures produce a report, keep successful outputs, and exit nonzero. Unsupported files passed explicitly are reported; unsupported file types inside scanned directories are ignored. Symlinks, hidden subdirectories, `node_modules`, `.git`, `dist`, and generated batch directories are not traversed.

## Defaults that need no prompt

| Output | Recommendation | Behavior |
| --- | --- | --- |
| WebP | Recommended for most web images. | Default for opaque still images. |
| PNG | Preserves transparency and crisp graphics. | Automatic for images with alpha; lossless encoding, no palette quantization. |
| AVIF | Smaller images; slower to export. | Optional opaque-image output. |
| MP4 | Recommended for web video. | H.264 with AAC audio and fast-start playback. |

**Balanced** is the default. **Smaller** trades detail for fewer bytes. **Higher quality** keeps more detail at a larger size. These are fixed encoder presets, not perceptual quality scoring or a guarantee of savings. PNG compression remains lossless across presets. Existing alpha channels are treated conservatively even if every pixel is opaque.

Images are auto-oriented, converted to sRGB, stripped of metadata, and fit within a 2560 px long edge. Video fits within 1920 px, retains the first audio track, caps frame rate at 30 fps, and removes metadata and chapters. `--max-width` overrides the maximum long edge (video has a 3840 px safety cap). Neither pipeline upscales or crops. Video output is SDR only; HDR inputs are reported rather than incorrectly converted. Subtitles and additional audio tracks are not included in the web copy.

PNG encoding is lossless **after** the web preparation step: resizing, color conversion, and normalization can change original pixel values/bit depth. This is a web publishing tool, not archival preservation. Originals remain available.

Supported inputs: JPEG, PNG, TIFF, HEIC/HEIF/HIF, WebP, AVIF, BMP, static GIF; MP4, MOV, M4V, WebM, MKV, AVI, MTS/M2TS video, subject to installed decoder support. Animated or multipage images, camera RAW, alpha video, and HDR video are not optimized in v0.1. Errors preserve the source and never publish a partial output.

Results can be larger than the source, particularly for already optimized assets or lossless PNG. Reports show actual bytes. Responsive summaries count **all variants**, so do not equate the batch total to a single page download.

## Responsive delivery

`--responsive` generates 480, 768, 1280, and 1920 px widths below the bounded original width, plus that bounded width itself. You can override widths and `sizes`; no variant is upscaled. Exported HTML includes `srcset`, `sizes`, dimensions, lazy loading, and async decoding. Paths are relative to the batch folder. Set useful alt text and adapt `sizes` to your CSS layout. For a hero/LCP image, replace lazy loading with eager loading and `fetchpriority="high"`.

Video variants, poster frames, art-directed crops, and parsing a project's CSS breakpoints are future work. The current width option applies to images only.

## Skill

The validated skill lives at `skills/hot-compress/`. Install it with:

```sh
node scripts/install-skill.mjs
```

The installer refuses to replace an existing skill. Start a new Codex chat to discover `$hot-compress`, then ask “compress ./assets for the web” or “make responsive versions of ./photos.” The installed launcher points to this checkout. After moving the checkout, set `HOT_COMPRESS_HOME` or update the installed `engine-path` file. The repository copy of the skill also works directly.

## GitHub and PR preparation

`action.yml` is a reusable composite Action for Linux and macOS. Linux installs codec packages; macOS runners need ImageMagick and FFmpeg available. Since this project is local-only, using it from another repository requires publishing it to GitHub first. No remote repository, marketplace listing, or deployment has been created.

`examples/compress-before-pr.yml` is an opt-in workflow for this repository: copy it into `.github/workflows/` and adjust `assets` to your source path. It runs on branch pushes or manually and uploads generated outputs as an artifact. It does not edit references, commit files, or open a PR. There is no GitHub “before PR creation” event; a branch push can prepare assets before opening a PR.

For local preparation, run `hot-compress ./assets --responsive` before creating a PR. `examples/pre-push` is an optional hook example. Review output and update source references deliberately; format conversion changes filenames. There is no automatic in-place rewriting.

## Development and boundaries

```sh
npm run build
npm run check
npm test
npm run dev
```

The integration suite creates actual codec fixtures and verifies HEIC/TIFF/JPEG, alpha PNG, responsive sizes, AVIF, orientation, H.264/audio/frame rate, partial failures, source preservation, repeat runs, generated-directory exclusion, server access controls, upload validation, downloads, and ZIP generation. Local network access is needed for the server test.

The GUI binds only to `127.0.0.1`, requires a session token, rejects foreign origins, and serves only generated result files. Uploads stream to temporary storage (4 GB per file); directory paths and CLI avoid the upload limit. Batch output persists in `optimized/`. Temporary uploads are removed after processing, but interrupted processes may leave temporary files for OS cleanup. One GUI batch runs at a time. Video encoding has a 30-minute per-file timeout, images two minutes per external command. Large batches can use substantial disk space.

Current delivery is a local browser app on Mac. A signed desktop application, hosted web service, intelligent quality scoring, RAW, HDR/alpha video, and incremental caching are planned in `PROJECT.md`. Browser visual QA and live GitHub CI are tracked separately in `STATUS.md`.
