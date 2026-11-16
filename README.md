# Optimakerpro

A fast, lightweight PC optimizer built with **Tauri 2** (Rust + HTML/CSS/JS).
Small installer, tiny memory footprint, no background bloat.

![Optimakerpro icon](ui/logo.png)

## What it does

- **Junk cleanup** — scans user/system temp folders, Windows Update leftovers,
  browser caches, shader caches, thumbnail caches and crash dumps, then removes
  what you select. Only files older than an hour are touched; locked files are
  skipped automatically.
- **Memory boost** — trims the working sets of memory-hungry processes to push
  reclaimable pages back to the system (measured, not magic).
- **Game Mode** — detects installed games (Steam, Epic, Riot or any .exe you
  add), applies per-game tweaks the moment a game launches, and offers real
  Windows optimizations organized by category:
  - *Game-specific:* Disable CPU 0, Disable E-Cores, Disable SMT/Hyperthreading
    (applied live via `SetProcessAffinityMask`), Disable Fullscreen
    Optimizations (per-game compatibility flag).
  - *FPS & Latency:* Windows Game Mode, Game DVR off, High performance power
    plan, mouse acceleration off, hardware-accelerated GPU scheduling.
  - *Network & Ping:* network throttling off, system responsiveness, Games task
    priority, Nagle's algorithm off.
  - *Quality of Life:* window animations off, startup delay removed,
    background apps disabled.
  - *Privacy & Security:* advertising ID, typing personalisation, tailored
    experiences, diagnostic data policy.
  - Modes: **Balanced**, **Performance**, **Custom**. Tweak cards show
    Safe/Advanced badges and restart requirements; admin tweaks ask once
    through a single UAC prompt and are verified after applying.
- **Auto Cleanup** — runs the safe sweep on your schedule (2/6/12/24 h).
- **Auto Memory Boost** — kicks in by itself when memory usage passes 85%.
- **Silent / Game Mode** — pauses all background activity and notifications.
- **Startup apps** — view and remove registry startup entries.
- **In-app updates** — the app checks GitHub releases and installs signed
  updates in one click.

Everything runs locally. No accounts, no telemetry, no paid unlocks.

## Platforms

| Platform | Status |
|----------|--------|
| Windows 10/11 x64  | ✅ NSIS installer |
| Windows 10/11 x86 (32-bit) | ✅ NSIS installer |
| macOS (Apple Silicon) | ✅ DMG |
| Linux (deb, AppImage) | ✅ Built, Windows is the focus |

## Build from source

Requirements: **Node.js 18+**, **Rust stable** (1.77.2+), and on Windows the
**MSVC Build Tools**.

```bash
npm install

npm run dev          # run the app in dev mode
npm run tauri build  # installer for your host architecture

# Windows installers:
npm run build:x64    # 64-bit NSIS installer
npm run build:x86    # 32-bit NSIS installer
```

The frontend is plain HTML/CSS/JS in [`ui/`](ui) — no bundler, no framework.
The backend lives in [`src-tauri/src/`](src-tauri/src).

## Releases & auto-updates

Releases are built by GitHub Actions (`.github/workflows/release.yml`) on tag
pushes (`v1.0.1`, ...) or manual dispatch. One release contains:

- `Optimakerpro_<version>_x64-setup.exe` (64-bit)
- `Optimakerpro_<version>_x86-setup.exe` (32-bit)
- macOS DMG, Linux deb/AppImage
- `latest.json` — the update manifest (both Windows entries merged, signatures
  from the build)

The app points at
`https://github.com/Makerxm800/Optimakerpro/releases/latest/download/latest.json`.

Update artifacts are signed with minisign. Store these two repository secrets:

| Secret | Value |
|--------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | The private signing key (minisign format) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Leave empty (the project key has no password) |

The public key is baked into `src-tauri/tauri.conf.json`. Regenerate a keypair
with:

```bash
npx tauri signer generate -w ~/.tauri/optimakerpro.key --password ""
```

## Repo layout

```
ui/                  frontend (index.html, style.css, main.js, logo.png)
src-tauri/
  src/               Rust backend (commands, cleaner, guard, updater glue)
  capabilities/      Tauri permission set
  icons/             generated icon set (from appicon-src.png)
scripts/             release helper (merges 32-bit entry into latest.json)
.github/workflows/   checks.yml (cargo check) + release.yml (installer builds)
```

## License

MIT — see the repo settings, or ask the maintainer if you need a different
arrangement.
