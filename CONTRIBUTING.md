# Contributing to SentinelScan

First off — thank you for considering a contribution. SentinelScan is a small, focused project and every issue, PR, or suggestion helps make it better.

This document explains how to contribute cleanly so your work gets merged quickly.

---

## 📖 Table of Contents

- [Code of Conduct](#-code-of-conduct)
- [Ways to Contribute](#-ways-to-contribute)
- [Before You Start](#-before-you-start)
- [Development Setup](#-development-setup)
- [Project Guidelines](#-project-guidelines)
- [Commit Messages](#-commit-messages)
- [Pull Request Process](#-pull-request-process)
- [Adding Detection Rules](#-adding-detection-rules)
- [Adding UI Features](#-adding-ui-features)
- [Reporting Bugs](#-reporting-bugs)
- [Requesting Features](#-requesting-features)
- [Recognition](#-recognition)

---

## 🤝 Code of Conduct

Be kind, be patient, assume good faith. We're all here to build something useful.

Harassment, discrimination, or hostility of any kind will not be tolerated. Report concerns to the maintainers via the email on the GitHub profile.

---

## 🎯 Ways to Contribute

You don't have to write code to help. Useful contributions include:

- 🐛 **Reporting bugs** with clear reproduction steps
- 💡 **Requesting features** with use cases
- 📖 **Improving documentation** — typos, clarity, missing examples
- 🎨 **Design feedback** on the UI (screenshots welcome)
- 🧪 **Testing on different platforms** — Windows 10/11, macOS Intel/ARM, various Linux distros
- 🌍 **Translations** of the UI (when i18n lands)
- 🔬 **Sharing detection rules** you've found useful
- ⭐ **Starring the repo** — helps visibility

---

## ✅ Before You Start

Before opening a PR, please:

1. **Search existing issues and PRs** — your idea may already be in progress.
2. **Open an issue first** for anything larger than a typo fix.
3. **Read the guidelines below** — they're short and they matter.
4. **Test your change** on at least one platform.

For tiny fixes (typos, obvious bugs), skip straight to a PR.

---

## 🛠️ Development Setup

### Requirements

- Python 3.8 or newer
- Tkinter (bundled with Python on Windows/macOS)
- No third-party packages — this is a hard rule

### Linux only

```bash
sudo apt install python3-tk
