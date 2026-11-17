# Contributing to Optimakerpro

Thank you for considering a contribution! This project is intentionally small
and focused: a fast, lightweight PC optimizer.

## Before you start

1. Search existing issues and PRs first.
2. Open an issue for anything larger than a typo fix.
3. Keep the app lean — no heavy frameworks, no new runtime dependencies unless
   there's a strong reason.

## Development setup

- Node.js 18+, Rust stable (1.77.2+)
- Windows: MSVC Build Tools; Linux: `libwebkit2gtk-4.1-dev libgtk-3-dev`
- `npm install`, then `npm run dev`

Please run `cargo check --all-targets` before opening a PR — CI runs it for
x86_64 **and** i686 Windows targets, plus Linux and macOS.

## Project guidelines

- **Frontend** is framework-free HTML/CSS/JS in `ui/`. Keep it that way.
- **Backend** commands live in focused modules (`cleaner.rs`, `boost.rs`,
  `guard.rs`, ...). Every new command must be registered in `lib.rs`.
- Cleanup code must be conservative: skip files younger than an hour, never
  follow symlinks, never touch user documents.
- Nothing may phone home. The only network traffic is the update check.
- Keep naming clean: the app is called **Optimakerpro** — no marketing suffixes
  in the UI.

## Commit messages

Short imperative subject line, e.g. `fix: keep toggle knob centered on small tiles`.

## Pull requests

- One logical change per PR.
- Describe what changed and why, and include screenshots for UI changes.
- New features should come with a short note in the README.

## Reporting bugs

Open an issue with: app version, Windows version (and 32/64-bit), steps to
reproduce, what happened vs. what you expected. Screenshots welcome.
