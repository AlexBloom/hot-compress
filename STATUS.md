# Status

Updated 2026-11-12, America/New_York. Built directly on Alex's Mac in `/Users/alexbloom/Documents/GitHub/hot-compress`. Local branch: `dev`. No GitHub remote, push, release, hosting, or domain configured.

## Complete and verified

- Shared TypeScript engine, CLI, local browser GUI with file/folder drops and pickers, directory input, polling, individual downloads, ZIP batches, savings and exception reports.
- ImageMagick/FFmpeg/ffprobe/zip found on this Mac. Real JPEG/TIFF/HEIC, alpha PNG, AVIF, EXIF rotation, no-upscale/responsive image sizes, H.264 video/audio/frame rate verified.
- Seven integration tests passed via `npm test`, including animation/APNG, alpha video and HDR rejection, partial-alpha preservation, output collisions, preservation of originals, repeat-run safety and server upload/auth/download/ZIP checks.
- `npm run check` and browser-JS syntax check passed. Skill validator passed. Action/workflow YAML parsed. Installed CLI and Action adapter smoke checks passed.
- CLI installed using `npm link --ignore-scripts`; `hot-compress --help` works.
- Skill installed at `~/.codex/skills/hot-compress`; start a new Codex chat for discovery. Installed launcher points to this checkout.
- Reusable composite Action and opt-in branch-push/manual workflow example prepared. Live GitHub execution and Linux codecs have not been verified.

## Preview

- Command: `npm start` from this project.
- Base URL: `http://127.0.0.1:4318/`. Use the authorized link printed by the running server; it contains the session token in its fragment. Tokens are not committed.
- Verified HTTP 200 and listening process PID 65786. Started in persistent command session 3313. The terminal session contains its output; no persistent logfile is configured. A detached nohup attempt did not survive and is not the active server.
- Restart: stop the existing process, then run `hot-compress gui` or `npm start`. The server opens the browser and prints a fresh authorized link.
- Browser automation could not inspect the interface because local browser use is disabled in Work settings. The HTTP/API flow is tested; visual layout and interactive drag-and-drop QA remain unverified.
- Production: not deployed.

## Scope boundaries / next work

The approved v0.1 is local-first. Native Mac packaging and hosted web delivery are planned in PROJECT.md. Camera RAW, animation optimization, alpha video, HDR tone mapping, responsive video, perceptual scoring and incremental caching are not implemented. Current preset recommendations do not guarantee optimal perceptual quality or smaller files. The report exposes actual savings/growth.

Next: visually review the running GUI and try representative camera originals. Before publishing the Action, verify Linux codec coverage and execute CI in GitHub. No need to create a remote or deploy until requested.
