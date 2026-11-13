# Hot Compress

Local image, camera RAW and video preparation for web delivery and sharing. The CLI, Codex skill, local browser GUI and GitHub Action share one engine. Originals are retained; each run gets its own batch folder.

## Run

```sh
npm ci --ignore-scripts
npm run build
npm start
```

Use the authorized localhost link printed in the terminal. **Use defaults** shows file/folder selection and one compression button. **Customize** adds directory input, RAW white balance, destination guidance, image/video format and compression settings, dimensions, responsive widths and output directory.

Node 24 is recommended (minimum 22.18). Install system tools:

```sh
# Mac
brew install imagemagick ffmpeg libraw jpeg-xl
# Ubuntu / Debian
sudo apt-get update
sudo apt-get install -y imagemagick ffmpeg zip libraw-bin libjxl-tools
```

ImageMagick 7 is preferred; 6 is supported through convert/identify fallback. HEIC/AVIF require libheif in that build. LibRaw supplies dcraw_emu for RAW development and raw-identify for frame inspection. JPEG XL uses cjxl/djxl/jxlinfo independently of ImageMagick's optional JXL support. FFmpeg needs the selected encoder (libx264, libx265, libvpx-vp9 or libsvtav1). Missing GUI encoders are disabled after capability detection; CLI failures are reported per file. `hot-compress doctor` checks required tools; JPEG XL is optional.

The server and CLI have no runtime npm package imports. React, shadcn/Radix, Tailwind and Vite are development/build dependencies; the server serves the compiled static interface from `web-dist/`.

## CLI

The command is installed on this Mac. To install from another checkout, run `npm link --ignore-scripts` after building. Without installation, replace `hot-compress` with `node bin/hot-compress.mjs`.

```sh
hot-compress ./assets
hot-compress ./shoot --responsive
hot-compress ./shoot --destination instagram
hot-compress ./footage --destination youtube
hot-compress ./photos --format preserve --quality 92
hot-compress ./raw --format tiff --tiff-compression lzw
hot-compress ./graphics --format webp --lossless
hot-compress ./photos --format jxl --lossless
hot-compress ./videos --video-format av1 --video-crf 24
hot-compress ./assets --resize original
hot-compress ./assets --max-width 1600 --output ./ready
hot-compress doctor
hot-compress gui
```

`--help` lists all controls. `--json` writes a report to stdout. Partial failures keep successful results and exit nonzero. Source files are never overwritten or staged/committed. Format-preserving output **re-encodes**; it does not guarantee unchanged bytes or zero quality loss. Source references need deliberate updates because output filenames change.

## Defaults and destinations

The default destination is self-hosted web: balanced WebP for opaque images, lossless PNG for alpha, and fast-start H.264 MP4 with AAC audio. Image long edge is capped at 2560 px; video at 1920 px and 30 fps. Images are auto-oriented and rendered into sRGB, metadata is removed, and no pipeline upscales or crops.

Customize destinations: **Self-hosted website, App / image CDN origin, Instagram / Reels, Facebook, TikTok, YouTube, X, Files / general sharing**. Upload presets retain more detail and recorded motion; they are not merely web-size presets under different names. For example, YouTube retains source fps with a 3840 px long-edge cap; an app/CDN image origin retains image dimensions. Explicit settings override presets. Guidance is reviewed November 13, 2026 and includes linked official and Reddit sources. API versus consumer-app distinctions and product choices are labeled.

Read [the output research](docs/OUTPUT-RESEARCH.md) for evidence, caveats and current JPEG XL support. No platform upload, recompression bypass, target bitrate/file-size guarantee, or perceptual quality score is claimed.

## Customize formats and algorithms

| Image output | Controls / use |
| --- | --- |
| Auto | Destination recommendation; alpha stays PNG. |
| Preserve | JPEG, PNG, WebP, AVIF, TIFF, HEIC, JXL, static GIF/BMP where supported; RAW renders to TIFF. |
| JPEG | Lossy quality, progressive encoding, 4:2:0 or 4:4:4 color sampling. |
| PNG | Lossless DEFLATE effort 0–9; no palette quantization. |
| WebP | Lossy quality or lossless prepared pixels. |
| AVIF | AV1 still-image quality. |
| TIFF | ZIP/LZW lossless, JPEG lossy, or uncompressed interchange. |
| HEIC | Compatible device workflows, system encoder required. |
| JPEG XL | Quality or lossless via dedicated tools; check downstream clients. |

Video: H.264 MP4, HEVC MP4, VP9 WebM, AV1 MP4, or preserve a supported codec/container combination. Preservation supports H.264/HEVC/VP9/AV1 in compatible MOV/MP4/M4V/WebM/MKV; unsupported combinations are reported. CRF is codec-dependent, and lower usually means larger/clearer output. Frame rate can follow the destination, retain source rate, or cap at 30/60. Stereo audio is AAC (MP4) or Opus (WebM), resampled to 48 kHz. Additional audio tracks, chapters and subtitles are omitted in the prepared copy. Interlaced video is deinterlaced.

Alpha images use PNG even when a different format is explicitly selected; the report explains that adjustment. Lossless refers to pixels **after** RAW rendering, color conversion, resizing and other preparation. WebP is limited to 8-bit pixels. This is not archival preservation or a RAW round-trip tool.

## Camera RAW

CR2, CR3, CRW, NEF/NRW, ARW/SRF/SR2, DNG, RAF, RW2, ORF, PEF/PTX, SRW, RWL, 3FR/FFF/IIQ, KDC/DCR, MOS, MRW and X3F are recognized and routed through LibRaw. Support depends on camera model and compression variant; an extension is not a guarantee. The decoder uses sensor data, not an embedded preview, with camera or automatic white balance and a 16-bit sRGB intermediate. The rendering does not reproduce camera JPEG processing or an editor recipe. Preserve-format exports render to TIFF; the source RAW remains intact. Multi-shot merging and HDR tone mapping are not implemented.

## Batches and responsive delivery

Drop files/folders, use either picker, or enter a directory path under Customize. Directory scans recurse and skip symlinks, hidden subdirectories, `.git`, `node_modules`, `dist`, `web-dist`, and generated batch directories. Unsupported types in a scanned directory are ignored; explicit unsupported files are reported.

Each batch includes `report.json` and `snippets.html`. GUI downloads support individual results and ZIP. Output can grow for already optimized sources or lossless formats. The report uses actual bytes; responsive totals include every variant and do not describe a single page load.

`--responsive` generates widths below the bounded original plus its bounded width, without upscaling. Override them with `--widths 480,768,1280,1920` and set an appropriate `--sizes` expression. HTML includes srcset, sizes and dimensions for browser image formats. Add useful alt text and change lazy loading to eager/fetchpriority for a hero/LCP image. Non-universal still formats do not get misleading browser snippets. Responsive video, posters and art-directed cropping are future work.

## Skill and GitHub Action

The installed skill is `$hot-compress` in new Codex chats. Repository source is `skills/hot-compress/`; `node scripts/install-skill.mjs` installs it and refuses replacement. Set `HOT_COMPRESS_HOME` after moving the checkout. The skill invokes the same CLI, including RAW and destination options.

`action.yml` is a composite Action. It installs Linux codecs and builds from the lockfile; macOS runners need the system tools already installed. An optional JSON `options` input exposes all engine settings:

```yaml
- uses: ./
  with:
    paths: assets
    options: '{"destination":"instagram","format":"jpeg","quality":92}'
```

The local-only repo has not been published. For another repository to use this Action remotely, publish it first. `examples/compress-before-pr.yml` is an opt-in branch-push/manual workflow that produces artifacts. `examples/pre-push` is a local hook example. Neither edits project references, commits outputs or opens a PR automatically. There is no GitHub “before PR creation” event.

## Development and limits

```sh
npm run check
npm test
npm run build
npm start
```

Thirteen integration tests cover media conversion, PNG alpha, RAW DNG sensor rendering, lossless WebP/JXL, TIFF compression, HEIC/AVIF, alternative video codecs, orientation/dimensions, upload versus delivery frame rates, animation/HDR/alpha-video rejection, collisions, repeat safety and local API uploads/downloads. A public Canon CR2 was also manually decoded from rawpy's test corpus; it is not committed. Browser checks are recorded in STATUS.md.

The GUI binds to 127.0.0.1, requires a session token, and rejects foreign origins. File uploads stream to temporary storage, with a 4 GB per-file limit; directory input/CLI avoid that upload limit. Outputs persist. Uploaded inputs are deleted after the batch, although interrupted processes may leave temp files for OS cleanup. One GUI batch runs at a time. Per-command image timeout is two minutes, RAW decoding five minutes, video encoding thirty minutes. Video scaling is capped at an 8192 px long edge even if a higher custom maximum is requested.

Animated/multipage images (including APNG and animated JXL), transparent video and HDR video are reported without flattening. There is no arbitrary target-byte budget or exhaustive platform compliance validator. Native Mac packaging and hosted web service remain future work. No deployment is configured.
