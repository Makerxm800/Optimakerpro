<div align="center">

<img src="https://img.shields.io/badge/version-6.1.0-5b8dff?style=for-the-badge" alt="version">
<img src="https://img.shields.io/badge/python-3.8%2B-3ddc97?style=for-the-badge&logo=python&logoColor=white" alt="python">
<img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-8b6dff?style=for-the-badge" alt="platform">
<img src="https://img.shields.io/badge/license-MIT-ffb547?style=for-the-badge" alt="license">
<img src="https://img.shields.io/badge/dependencies-none-3ddc97?style=for-the-badge" alt="deps">

# 🛡️ SentinelScan

### Offline heuristic malware scanner — quarantine, real-time protection, startup inspector, firewall tools.

**No cloud. No telemetry. No installer. One Python file.**

[Features](#-features) · [Install](#-installation) · [Usage](#-usage) · [Screenshots](#-screenshots) · [FAQ](#-faq) · [Disclaimer](#%EF%B8%8F-disclaimer)

</div>

---

## 📖 Table of Contents

- [What is SentinelScan?](#-what-is-sentinelscan)
- [Features](#-features)
- [Installation](#-installation)
- [Usage](#-usage)
- [Scan Modes Explained](#-scan-modes-explained)
- [Detection Rules](#-detection-rules)
- [Project Structure](#-project-structure)
- [Data & Privacy](#-data--privacy)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [Screenshots](#-screenshots)
- [FAQ](#-faq)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [Disclaimer](#%EF%B8%8F-disclaimer)
- [License](#-license)

---

## 🔍 What is SentinelScan?

**SentinelScan** is a single-file, dependency-free desktop security toolkit written in pure Python. It combines **heuristic malware detection**, a **quarantine vault**, **real-time folder monitoring**, a **startup inspector**, a **file shredder**, and **Windows Firewall / network tools** into one polished, dark-mode GUI.

It is designed to be:

- 🔒 **Private** — every scan, quarantine, and log stays on your machine. Zero network calls.
- 📦 **Portable** — one `.py` file. No pip install. No installer. No dependencies beyond the Python standard library.
- 🎨 **Premium** — animated buttons with ripple feedback, six hand-crafted themes, bouncing toggles, and scale-in modals.
- 🧠 **Honest** — heuristics only. It tells you *why* something is flagged, never just "infected."

> **⚠️ Not a replacement for Windows Defender, Malwarebytes, or any signature-based antivirus.** See the [Disclaimer](#%EF%B8%8F-disclaimer).

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🎯 Scanning

- ⚡ **Quick Scan** — hits Downloads, Desktop, Documents, `%TEMP%`, startup folders in seconds
- 🔬 **Deep Scan** — full recursive scan of any folder you pick
- 📊 **Live scan panel** — real % progress, files/sec, elapsed time, per-risk counters
- 🧾 **Live results tree** — risk, reason, and full path for every finding
- ⏹️ **Cancel anytime** — mid-scan stop button
- 💾 **JSON reports** — saved to `~/.sentinelscan/reports/`

</td>
<td width="50%">

### 🛡️ Protection

- 📡 **Real-time monitor** — watch folders, auto-scan new & modified files
- ⚡ **Startup inspector** — audit registry Run keys + startup folders with risk scoring
- 🔒 **Quarantine vault** — SHA-256 verified isolation, restore or delete
- 🗑️ **File shredder** — 3-pass overwrite (zeros → ones → random)
- 🚫 **Ignore list** — whitelist false positives by path
- 🔔 **Native OS notifications** — real Windows toast, macOS, Linux

</td>
</tr>
<tr>
<td>

### 🛠️ Tools

- ⚙️ **Process inspector** — heuristic risk scoring of running processes
- 🛡️ **Firewall status** — view & toggle Windows Firewall profiles
- 🌐 **Network viewer** — live `netstat` connection table
- 📊 **Scan history** — every scan logged with stats
- 📖 **Virus definitions** — browse all heuristic rules
- 🎨 **6 themes** — Midnight, Carbon, Nord, Solar, Violet, Daylight

</td>
<td>

### 🎨 Experience

- 🖱️ **Animated buttons** — hover glow + material ripple on click
- 🔀 **Layout toggle** — switch between sidebar & tabs instantly
- 🎛️ **Center settings modal** — scales in with ease-out cubic
- 🎚️ **Bouncing toggles** — premium iOS-style switches
- 💾 **Auto-save** — theme, layout, scan results persist across restarts
- 🪟 **Real window icon** — shield glyph, themed to match

</td>
</tr>
</table>

---

## 🚀 Installation

### Requirements

- **Python 3.8 or newer**
- **Tkinter** (bundled with Python on Windows/macOS)
- **Zero** third-party packages

### Linux only

```bash
sudo apt install python3-tk     # Debian/Ubuntu
sudo dnf install python3-tkinter # Fedora
sudo pacman -S tk                # Arch
