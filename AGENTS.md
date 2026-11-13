# Hot Compress

Read PROJECT.md and STATUS.md before changes. Work on `dev`; use a PR for future promotion to `main`. Publish or deploy only when explicitly requested. Preserve user changes and never commit secrets.

- Install: `npm ci --ignore-scripts`
- Build: `npm run build`
- Type check: `npm run check`
- Test: `npm test` (requires ImageMagick, LibRaw dcraw_emu/raw-identify, FFmpeg, ffprobe, zip; optional JPEG XL tools and localhost binding)
- Preview: `npm start` (127.0.0.1:4318; use the session link printed in the terminal)
- CLI: `node bin/hot-compress.mjs --help`
- Skill installation: `node scripts/install-skill.mjs` (refuses replacement)

Shared engine in `src/engine.ts`; CLI/server in `src/`; browser UI in `web/src/` (build to `web-dist/`), dated platform/codec guidance in `src/guidance.ts`, research in `docs/OUTPUT-RESEARCH.md`; Action in `action.yml`; skill in `skills/hot-compress/`; integration tests in `test/`. No runtime npm dependencies in the server/CLI; the static GUI is bundled from React, shadcn/Radix and Tailwind using Vite. Never silently discard alpha, animation, source files, or originals. A partial batch failure must preserve successful results, identify each exception and exit nonzero in CLI/CI. Avoid shell interpolation of media filenames. Keep docs honest about system codec requirements and unverified platforms.

Optional environment variables: `HOT_COMPRESS_HOME` locates the engine for the skill; `CODEX_HOME` changes skill installation root. `HOT_INPUTS`, `HOT_OUTPUT`, `HOT_FORMAT`, `HOT_PRESET`, `HOT_RESPONSIVE`, `HOT_OPTIONS` are Action inputs; `GITHUB_OUTPUT` and `GITHUB_STEP_SUMMARY` are GitHub-provided output paths.
