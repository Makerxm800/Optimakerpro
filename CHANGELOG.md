# Changelog

All notable changes to SentinelScan are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned

- Custom rules editor (add heuristic rules from the UI)
- YARA-lite parser for `.yar`-style rule files
- Optional VirusTotal lookup (opt-in, breaks offline promise)
- Scheduled scans (daily / weekly)
- System tray icon with background scanning
- Multi-language UI (i18n foundation)
- HTML / PDF report export

---

## [6.1.0] — 2025-01-XX

### Fixed

- **Settings modal silently failed to open** — `Modal.set_body` was destroying the frame it was told to display, leaving the modal blank. Now skips the new frame when cleaning up old bodies.
- **`_toggle_settings` errors were invisible** — now wrapped in try/except with a real error dialog if anything fails.
- **Modal positioning math could be off** on first launch — now uses `relx=0.5, rely=0.5, anchor="center"` so it always centers regardless of window size.

### Added

- `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `LICENSE`, `.gitignore`
- GitHub Actions workflow for syntax checking
- Issue templates for bug reports and feature requests

---

## [6.0.0] — 2025-01-XX

### Added

#### Real-time Protection (new page)

- Continuous folder monitor with ~20 second scan cycle
- Auto-scan on file create and modify events
- Live event log with color-coded entries
- Add / remove watched folders from the UI
- Persists watch list between sessions
- Toggleable native notifications for detections

#### Process Inspector (new page)

- Lists running processes with PID, memory, and user
- Heuristic risk scoring — suspicious names (`crypt`, `mine`, `keylog`, `backdoor`, `rootkit`), temp extensions, very high memory footprint
- Sortable by risk and memory
- Color-coded risk column

#### File Shredder (new page)

- 3-pass overwrite: zeros → ones → random
- `fsync` after each pass
- File renamed before unlink to defeat filesystem caches
- Multi-file queue with per-file progress
- Irreversible — requires explicit confirmation

#### Scan History (new page)

- Every scan logged with mode, root, files scanned, findings, criticals
- Up to 500 entries kept
- Button to open the reports folder

#### Virus Definitions (new page)

- Card-based viewer of all heuristic rules
- Risk-colored badges
- Descriptions explaining what each rule catches

#### Premium UI

- **Center settings modal** — scales in from 72% to 100% with ease-out cubic
- **Ripple effect on buttons** — expanding white circle from click point
- **Bouncing toggles** — `ease-out-back` curve with slight overshoot
- **Animated layout switch** — window alpha fade during sidebar ⇄ tabs transition
- **Real window icon** — shield with checkmark, redrawn per theme

#### New settings

- **Layout** toggle (sidebar / tabs)
- **Ripple effect** master toggle
- **Real-time alerts** notification toggle

### Changed

- Settings moved from a slide-in sidebar panel to a **center modal**
- Notification settings split into master, critical, and real-time toggles
- Scan engine now accepts both single paths and lists of roots
- `count_files` supports multiple roots for Quick Scan

### Improved

- Added `.wsf`, `.jse`, `.vbe` to tracked executable extensions
- Added detection rules for `regsvr32 /s /u /i:`, `mshta http`, `rundll32 javascript`
- Added `SchTasks`, `Add-MpPreference`, `Set-MpPreference` to suspicious string list
- Ignore list lookup uses set membership (O(1) instead of O(n))
- State throttling prevents disk thrashing during scans

---

## [5.0.0] — 2025-01-XX

### Added

#### Layout toggle

- Sidebar ⇄ Tabs, switchable from top-right button or Settings
- Scan results, active page, and settings persist through the switch

#### Quick Scan + Deep Scan

- **Quick Scan** — Downloads, Desktop, Documents, `%TEMP%`, startup folders
- **Deep Scan** — full recursive scan of any chosen folder
- **Custom Folder** — quick picker from Dashboard

#### Live scan info panel

- Mode name, elapsed time, real % progress
- Files scanned / total
- Current file path
- Per-risk counters (L / M / H / C), color-coded

#### Real window icon

- Runtime-generated shield glyph
- Updates when theme changes

### Fixed

- Ignore list lookup was O(n²) — now O(1)
- Total file count works across multiple roots
- Progress bar shows real percentage, not estimation
- State throttling prevents disk thrashing during scan
- Info panel counts update when repopulating after layout / theme change

### Improved

- Added `.wsf`, `.jse`, `.vbe` to executable extensions
- Added rules for `regsvr32`, `mshta`, `rundll32 javascript`
- Cleaner mode buttons on Dashboard and Scan pages
- Ignore action promoted to main Scan button bar

---

## [4.0.0] — 2025-01-XX

### Added

- **Auto-save everything** — settings, active page, scan results persist to `~/.sentinelscan/state.json`
- **Ignore list** — whitelist false positives by path
  - Ignore button on Scan page
  - Right-click context menu on results
  - Persisted to `ignore.json`
- **Real % progress** — scanner does a quick count pass first, then reports accurate percentage
- **Tools page** — Windows Firewall status & toggle, live network connections
- Modern smooth theme switching (fade-out, rebuild, fade-in — no data loss)
- Settings panel (initial version, slide-in sidebar)

### Fixed

- **Theme switching no longer breaks the scan tree** — rebuild preserves results and repopulates
- Background scans continue through UI rebuilds

### Removed

- MIT License text from About page

---

## [3.1.0] — 2025-01-XX

### Fixed

- **Fatal bug** — `tk.ttk.Treeview` and `tk.ttk.Style` were used without importing `ttk`. App crashed on launch. Fixed by importing properly.
- Settings panel animation was fragile and could fail to appear
- Custom dropdown popups could close themselves immediately
- First-launch race condition between `_build_ui` and `SettingsPanel`

### Added

- Settings slide-in panel with scrollable content
- Real native OS notifications (Windows toast, macOS, Linux)
- Custom rounded entry widget
- Custom rounded dropdown with popup menu
- Custom progress bar
- Six themes

---

## [3.0.0] — 2025-01-XX

### Added

- Premium dark UI with rounded everything
- Sidebar navigation with animated active indicator
- Six themes: Midnight, Carbon, Nord, Solar, Violet, Daylight
- Device detection with usage bars and one-click scan
- Animated buttons with hover glow
- Pulsing dot indicator during scans
- Fade-in on launch

---

## [2.0.0] — 2025-01-XX

### Added

- Sidebar navigation layout
- Custom animated buttons
- Auto-detects drives with usage display
- Stat cards (Files, Findings, Critical, Quarantined)
- Settings page with animated toggles
- Theme dropdown with instant UI rebuild

---

## [1.0.0] — 2025-01-XX

### Added

- Initial release
- Heuristic scanner with 9 detection rules:
  - EICAR test signature
  - Blocklist hash match
  - Ransomware note patterns
  - Double extensions
  - RTL override tricks
  - Suspicious command strings
  - Executables in temp folders
  - autorun.inf
  - High entropy (packed binaries)
- Quarantine vault with SHA-256 verification
- Startup inspector (registry Run keys + startup folders)
- JSON report export
- Single-file, stdlib-only implementation
- Tkinter GUI with tabbed layout

---

## Types of Changes

- `Added` — new features
- `Changed` — changes to existing functionality
- `Deprecated` — soon-to-be-removed features
- `Removed` — removed features
- `Fixed` — bug fixes
- `Security` — vulnerability fixes
- `Improved` — non-breaking enhancements

---

[Unreleased]: https://github.com/YOURNAME/sentinelscan/compare/v6.1.0...HEAD
[6.1.0]: https://github.com/YOURNAME/sentinelscan/compare/v6.0.0...v6.1.0
[6.0.0]: https://github.com/YOURNAME/sentinelscan/compare/v5.0.0...v6.0.0
[5.0.0]: https://github.com/YOURNAME/sentinelscan/compare/v4.0.0...v5.0.0
[4.0.0]: https://github.com/YOURNAME/sentinelscan/compare/v3.1.0...v4.0.0
[3.1.0]: https://github.com/YOURNAME/sentinelscan/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/YOURNAME/sentinelscan/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/YOURNAME/sentinelscan/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/YOURNAME/sentinelscan/releases/tag/v1.0.0
