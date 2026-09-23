# Security Policy

SentinelScan is a security tool. We take reports about its own security seriously.

---

## 📖 Table of Contents

- [Supported Versions](#-supported-versions)
- [Reporting a Vulnerability](#-reporting-a-vulnerability)
- [What Counts as a Vulnerability](#-what-counts-as-a-vulnerability)
- [What Doesn't Count](#-what-doesnt-count)
- [Response Timeline](#-response-timeline)
- [Safe Harbor](#-safe-harbor)
- [Scope](#-scope)
- [Best Practices for Users](#-best-practices-for-users)

---

## 🧩 Supported Versions

| Version | Supported |
|---------|-----------|
| 6.x     | ✅ Active |
| 5.x     | ⚠️ Critical fixes only |
| 4.x     | ❌ End of life |
| < 4.0   | ❌ End of life |

Always run the latest release. Older versions may contain bugs that were fixed later.

---

## 🚨 Reporting a Vulnerability

**Please do not open a public GitHub issue for security problems.**

Instead, report privately:

- **Email:** security@YOURDOMAIN.example *(replace with your contact)*
- **Subject line:** `[SentinelScan Security] <short description>`
- **PGP key:** *(add your key here if you have one)*

Include:

- **Version** of SentinelScan
- **OS** and **Python version**
- **Steps to reproduce** — minimal, clear
- **Impact** — what an attacker could do
- **Proof of concept** if applicable
- **Suggested fix** if you have one

You will receive an acknowledgement within **72 hours**.

---

## 🎯 What Counts as a Vulnerability

Security issues that matter for a tool like SentinelScan:

### High priority

- **Arbitrary code execution** triggered by scanning a file
- **Path traversal** in quarantine or shredder operations
- **Symlink following** that lets a scan touch unintended paths
- **Command injection** in subprocess calls (`netsh`, `netstat`, `tasklist`, `powershell`, `osascript`)
- **PowerShell toast injection** — malicious filename rendering outside the toast text field
- **Silent privilege escalation** when running as admin
- **Data leak** — a scenario where user files or metadata leave the machine

### Medium priority

- **Denial of service** — a crafted file crashes the scanner or hangs the UI indefinitely
- **Race condition** in real-time monitor leading to missed detections
- **Quarantine bypass** — a file restored without user action
- **SHA-256 verification** bypass in quarantine metadata

### Low priority

- **UI freezing** that requires force-quit (non-exploitable)
- **Unexpected file deletion** in edge cases with clear reproduction
- **Notification spoofing** by filename tricks (cosmetic)

---

## ❌ What Doesn't Count

The following are **not** vulnerabilities in SentinelScan:

- **Missing detections** — heuristics are inherently incomplete. Not finding malware is expected behavior, not a security bug.
- **False positives** — annoying but not a security issue.
- **Social engineering** — "someone could rename a file to look suspicious" is by design; the scanner is supposed to notice.
- **Lack of antivirus features** — no real-time kernel hooks, no signature DB, no cloud lookup. Documented and intentional.
- **Running with administrator privileges** — SentinelScan is meant to be run by the user; if an admin user runs malicious code, that's outside our threat model.
- **Missing code signing** — we ship as plain Python source. You can read every line.
- **Toasts not appearing on Windows** — Group Policy issue on your machine, not a security hole.
- **Firewall toggle failing without admin** — Windows blocks unprivileged changes by design.

If you're not sure, report it privately anyway. We'd rather triage a false alarm than miss something real.

---

## ⏱️ Response Timeline

| Stage | Timeline |
|-------|----------|
| Acknowledgement | Within 72 hours |
| Initial triage | Within 7 days |
| Fix for HIGH / CRITICAL | Within 30 days |
| Fix for MEDIUM | Within 60 days |
| Fix for LOW | Next scheduled release |
| Public disclosure | Coordinated with reporter |

We will keep you informed at every stage.

If you don't hear back within 7 days, ping us again — emails get lost.

---

## 🛡️ Safe Harbor

We will not pursue legal action against researchers who:

- Report vulnerabilities privately, following this policy
- Do not access, modify, or exfiltrate user data beyond what's needed to demonstrate the issue
- Do not exploit the vulnerability against real users
- Give us reasonable time to fix before public disclosure
- Act in good faith

We consider security research conducted under this policy to be authorized, and we will make it clear to any third party that your actions were authorized.

---

## 📌 Scope

### In scope

- `sentinelscan.py` — the entire application source
- Any helper scripts or configuration files in the repo
- The `~/.sentinelscan/` data directory and its contents' integrity

### Out of scope

- Third-party tools called by SentinelScan (`netsh`, `netstat`, `tasklist`, `powershell`, `ps`, `osascript`, `notify-send`)
- The Python interpreter itself
- Operating system security boundaries
- Physical attacks on the machine running SentinelScan
- Vulnerabilities in `tkinter` or the Tcl/Tk runtime

If you find a vulnerability in one of the tools we shell out to, please report it to the respective project.

---

## 🔐 Best Practices for Users

SentinelScan is a security tool, but **no tool replaces good hygiene**. To stay safe:

1. **Run the latest version.** Check the releases page regularly.
2. **Download only from official sources.** The repo or the releases page — nothing else.
3. **Read the source.** It's one file. You can audit it in a few hours.
4. **Keep your OS and antivirus up to date.** SentinelScan is a supplement, not a substitute.
5. **Don't run untrusted files just because SentinelScan marked them "CLEAN."** Heuristics miss things.
6. **Back up before using the shredder.** It's permanent.
7. **Run as administrator only when needed** — for firewall changes, for example.
8. **Report suspicious behavior** in SentinelScan itself to the maintainers.

---

## 📜 Attribution

If you responsibly disclose a vulnerability and we fix it, we will credit you in the release notes and, if you like, in this file's "Hall of Fame" section (add yours when the first report comes in).

Thank you for helping keep SentinelScan and its users safe. 🛡️

---

<div align="center">

**[⬆ Back to top](#security-policy)**

</div>
