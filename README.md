# Taurie V2 — Premium PC Optimizer (Beta)

Taurie V2 is the premium PC optimizer for **Optimakerpro** — a modern,
lightweight desktop app built with the **Tauri 2** framework. It works on both
**Windows and macOS**, with a clean, modern UI and a full set of optimization
features and toggles.

> **Beta notice:** Taurie V2 is in active beta. Expect ongoing refinements.

## Features

- **Dashboard** — live health score, CPU / RAM / disk telemetry, Smart Scan,
  quick actions and a recent-activity log
- **Deep Clean** — scans safe junk locations (temp folders, caches, leftover
  files) and reclaims disk space with per-item selection and a safe-cleaning
  guarantee
- **Memory Boost** — one-click standby-memory release, live RAM/Swap usage and
  an Auto Boost toggle
- **Startup Manager** — enable/disable apps that launch with your system
  (registry `Run` keys on Windows, LaunchAgents on macOS)
- **Protection** — real-time protection, auto-cleanup, silent / game mode and
  scheduled maintenance (Task Scheduler on Windows, LaunchAgent on macOS)
- **Settings** — system information, module list, privacy statement

All scanning and optimization happens locally — no telemetry is uploaded.

## Prerequisites

- **Node.js 18+** and npm
- **Rust 1.77+** (for the Tauri desktop shell)
- Tauri CLI is installed as a dev dependency (`npx tauri ...`)

## Run the desktop app (Windows / macOS)

```bash
npm install
npm run tauri dev
```

The app window opens with the full desktop experience. In dev, the UI runs in
the system webview and talks to the real Rust backend (real system stats, real
cleanup, real startup management).

## Build installers

```bash
# Windows: produces .msi / NSIS .exe under src-tauri/target/release/bundle/
npm run tauri build -- --bundles msi,nsis

# macOS: produces .dmg / .app under src-tauri/target/release/bundle/
npm run tauri build -- --bundles dmg
```

## Releases (GitHub Actions)

The repo ships a `Release` workflow (`.github/workflows/release.yml`) that
builds the desktop app and publishes the binaries to a **GitHub Release**:

- **Windows** — `.msi` installer + NSIS `.exe`
- **macOS** — `.dmg` disk image

To cut a release, push a version tag:

```bash
git tag v0.9.0-beta
git push origin v0.9.0-beta
```

The workflow automatically:

1. Builds the frontend and compiles the Tauri app on `windows-latest` and
   `macos-latest`
2. Attaches the Windows installer (`.msi`, `.exe`) and macOS image (`.dmg`)
   to the GitHub Release for the tag
3. Uploads the artifacts so they're also browsable from the Actions run

A `CI` workflow (`.github/workflows/ci.yml`) typechecks/builds the frontend
and runs `cargo check` on the Rust backend on every push and PR.

## Web preview (no Rust needed)

```bash
npm install
npm run dev
```

Opens the full UI in the browser at `http://localhost:1420`. The backend
commands fall back to a realistic simulation so every feature and toggle is
fully explorable without the desktop shell.

## Project layout

```
├── assets/                 # source logo
├── public/                 # web assets (logo / favicon)
├── src/                    # React + TypeScript + Tailwind frontend
│   ├── components/         # Sidebar + UI kit (Toggle, Badge, Ring, …)
│   ├── pages/              # Dashboard, Cleanup, Memory, Startup, Protection, Settings
│   └── lib/                # Tauri IPC bridge (with browser fallback) + helpers
└── src-tauri/              # Tauri 2 desktop shell (Rust)
    ├── src/commands/       # system stats, cleanup, startup, optimizer
    ├── capabilities/       # permissions for the main window
    └── icons/              # app icons (Windows .ico / macOS .icns)
```

## Logo

The Taurie V2 logo lives in `assets/taurie-logo.png` and is used as the app
icon (`src-tauri/icons`). To regenerate the icon set from a new logo:

```bash
npx tauri icon assets/taurie-logo.png
```

## Privacy

Taurie V2 never uploads personal files or system statistics. All operations
run locally on your machine.
