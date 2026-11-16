# Security Policy

Optimakerpro is a local system utility. We take reports about its own security
seriously.

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.x     | ✅ Active |

Always run the latest release — the app can update itself from the official
releases page.

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Use GitHub's
"Report a vulnerability" (Security tab → Private vulnerability reporting) with:

- App version, OS version, 32/64-bit
- Steps to reproduce
- Impact and proof of concept if applicable

You'll get an acknowledgement within 72 hours.

## What counts as a vulnerability

**High priority**

- Arbitrary file deletion outside the documented cleanup locations
- Path traversal or symlink following in cleanup, quarantine or restore
- Command/registry injection through startup item names or paths
- Update signature bypass or downgrade attacks
- Any code execution triggered by scanning a crafted file

**Medium priority**

- DoS (hang or crash of the backend loop)
- Quarantine bypass — restoring a file without user action
- Settings file tampering enabling auto-execution

**Not vulnerabilities**

- Missed detections — the temp-folder watcher is a heuristic, not antivirus
- Locked temp files skipped during cleanup — by design
- Running without admin — the app never requests elevation; HKLM startup
  removal fails without admin on purpose
- No code signing of installers — noted, not exploitable

## Scope

- `src-tauri/src/**` — all backend commands and filesystem operations
- `ui/**` — frontend logic
- `scripts/**` — release tooling

Out of scope: the OS itself, WebView2/WebKit runtimes, GitHub Actions
infrastructure.

## Design notes

- The app runs **without** administrator privileges.
- Cleanup deletes only files older than one hour inside fixed, well-known
  temp/cache locations, and never follows symlinks (`symlink_metadata` only).
- Quarantine moves files into `%LOCALAPPDATA%\Optimakerpro\quarantine` with a
  manifest; restoring requires an explicit click.
- Updates are minisign-verified against the public key in `tauri.conf.json`
  before installation.
