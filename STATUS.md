# Status

Updated November 13, 2026, America/New_York. Built directly on Alex's Mac at `/Users/alexbloom/Documents/GitHub/hot-compress`. Branch `dev`. No GitHub remote, publication or deployment.

## v0.2 complete

- Neutral shadcn/Radix React GUI with Use defaults / Customize tabs. Defaults exposes selection and one compression CTA; Customize groups input, RAW white balance, destination, formats/compression, dimensions, responsive sizes and output directory. Benefits/marketing copy removed.
- Dated algorithm tooltips and clickable information popovers. Destination guidance for web, app/CDN, Instagram, Facebook, TikTok, YouTube, X and sharing. Official/API facts, product choices and community experience are separated; full research is in `docs/OUTPUT-RESEARCH.md`.
- LibRaw full-sensor RAW development with camera/auto white balance and multi-frame inspection. Common RAW extensions recognized; unsupported camera modes are reported. Preserve-format RAW renders to TIFF.
- Image auto/preserve/WebP/AVIF/JPEG/PNG/TIFF/HEIC/JXL, PNG effort, JPEG sampling, TIFF compression, WebP/JXL lossless prepared pixels.
- H.264/HEVC/VP9/AV1 and supported source codec/container preservation, CRF and frame-rate controls. Upload versus delivery presets use different quality/motion defaults.
- CLI, installed skill and composite Action expose the same options. The installed skill instructions were updated only after confirming there were no independent edits.

## Verified

- Build and backend/frontend TypeScript checks pass; skill validator and workflow/Action YAML checks pass.
- All 13 integration tests pass. Coverage includes alpha preservation, supported formats, lossless modes, TIFF compression, RAW sensor development, destination fps/dimensions, alternative video decoding, source preservation, repeat safety, output sharing the input directory, animation/HDR/alpha-video rejection and local API upload/download/ZIP flow.
- Public Canon CR2 fixture from rawpy's official test repository decoded successfully to WebP and TIFF LZW through the installed CLI. Fixture remains outside Git; no copyrighted RAW photograph was added to the repository.
- Action adapter smoke check passed with RAW input and JSON destination options. Live GitHub CI and Linux codecs are not verified.
- Browser QA is now available: checked the defaults screen at the existing narrow viewport, Customize controls, destination selection, official/community guidance, clickable RAW information and a completed JPEG + RAW DNG batch using a custom output directory. The final default screen is visible in the existing preview tab. No claim of exhaustive browser/device or drag-and-drop coverage.
- Screenshot: `.hot-compress/preview-defaults.jpg` (ignored local artifact).
- System tools installed/available: ImageMagick, FFmpeg/ffprobe, zip, LibRaw dcraw_emu/raw-identify and JPEG XL cjxl/djxl/jxlinfo. CLI remains installed using npm link.

## Preview

- Running command: `npm start`.
- Base URL: `http://127.0.0.1:4318/`; use the session link printed by the server. Session tokens are not committed.
- Current process PID 6583, persistent command session 42353. Output is captured in the command session; no disk logfile configured.
- Existing in-app browser refreshed on the final build and authorized session, with Use defaults selected.
- Restart: stop the current process, then `hot-compress gui` or `npm start` from this checkout. For source changes, run `npm run build` and reload; restart the server for backend changes.
- Production: not deployed.

## Limits / next work

Full camera-mode coverage depends on LibRaw version/build. Multi-shot RAW, animation, HDR processing and video alpha remain unimplemented and reported rather than flattened. Preserve format re-encodes prepared copies. No exact byte budget, perceptual quality guarantee, platform-upload A/B experiment, universal app/account acceptance validator or live policy refresh is claimed. Instagram consumer help and Facebook help were fetch/login limited; their uncertain values are not labeled as verified current universal limits.

Native Mac packaging and hosted web service remain future work. Validate Linux and live GitHub execution before publishing the Action. Additional representative RAW/HDR camera samples and controlled platform tests would improve future guidance.
