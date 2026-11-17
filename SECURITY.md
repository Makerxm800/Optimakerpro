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
- Path traversal or symlink following in the cleanup engine
- Affinity tweaks applied to the wrong process (name collisions)
- Update signature bypass or downgrade attacks
- Registry writes escaping the documented tweak keys
- Any code execution triggered by scanning a crafted file

**Medium priority**

- DoS (hang or crash of the backend loop)
- UAC prompt contents tampered with (the generated .reg file is written to a
  world-readable temp path before elevation)
- Settings file tampering enabling auto-execution

**Not vulnerabilities**

- Locked temp files skipped during cleanup — by design
- Running without admin — the app never self-elevates; admin tweaks show a UAC
  prompt that the user can decline, and the result is verified and reported
- Game affinity reverting when a game restarts — expected; tweaks re-apply
- No code signing of installers — noted, not exploitable

## Scope

- `src-tauri/src/**` — all backend commands and filesystem/registry operations
- `ui/**` — frontend logic
- `scripts/**` — release tooling

Out of scope: the OS itself, WebView2/WebKit runtimes, GitHub Actions
infrastructure.

## Design notes

- The app runs **without** administrator privileges. Admin-marked tweaks are
  the only things that trigger UAC, through a generated `.reg` file imported
  with an elevated `reg import` — the user sees and can decline the prompt,
  and every change is read back and verified afterwards.
- Cleanup deletes only files older than one hour inside fixed, well-known
  temp/cache locations, and never follows symlinks (`symlink_metadata` only).
- Game tweaks write only HKCU registry values and process affinity masks;
  HKLM tweaks are explicitly marked "Admin" in the UI.
- Updates are minisign-verified against the public key in `tauri.conf.json`
  before installation.
