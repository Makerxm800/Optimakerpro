#!/usr/bin/env node
/**
 * Merges Windows x64 + x86 updater entries into latest.json on the release.
 *
 * tauri-action runs once per matrix job, so each Windows build overwrites
 * latest.json with only its own platform entry. This script runs after all
 * builds and makes sure latest.json contains BOTH windows-x86_64 and
 * windows-i686 entries by reading the .sig files attached to the release.
 *
 * Env: GITHUB_TOKEN, repo = Makerxm800/Optimakerpro
 */
const fs = require("fs");

const OWNER = "Makerxm800";
const REPO = "Optimakerpro";
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
const TOKEN = process.env.GITHUB_TOKEN;

async function main() {
  const conf = JSON.parse(fs.readFileSync("src-tauri/tauri.conf.json", "utf8"));
  const version = conf.version;
  const tag = `optimakerpro-v${version}`;
  console.log(`Version ${version} → tag ${tag}`);

  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "optimakerpro-release",
  };

  // 1. Find the release for this tag.
  const relRes = await fetch(`${API}/releases/tags/${tag}`, { headers });
  if (!relRes.ok) {
    console.log(`Release ${tag} not found (status ${relRes.status}) — nothing to patch.`);
    return;
  }
  const release = await relRes.json();
  console.log(`Found release: ${release.name || release.tag_name} (${release.assets.length} assets)`);

  // 2. Load existing latest.json asset (if any).
  let latest = { version, notes: release.body || "", pub_date: new Date().toISOString(), platforms: {} };
  const latestAsset = release.assets.find((a) => a.name === "latest.json");
  if (latestAsset) {
    try {
      const buf = await (await fetch(latestAsset.url, {
        ...headers,
        Accept: "application/octet-stream",
      })).text();
      const parsed = JSON.parse(buf);
      latest.version = parsed.version || latest.version;
      latest.notes = parsed.notes || latest.notes;
      latest.pub_date = parsed.pub_date || latest.pub_date;
      latest.platforms = parsed.platforms || {};
    } catch (e) {
      console.log(`Could not parse existing latest.json (${e.message}) — recreating it.`);
    }
  }

  // 3. Build entries for both Windows targets from the release assets.
  const targets = [
    { key: "windows-x86_64", suffix: "x64-setup.exe" },
    { key: "windows-i686", suffix: "x86-setup.exe" },
  ];
  let changed = false;

  for (const t of targets) {
    const exe = release.assets.find((a) => a.name.endsWith(t.suffix) && a.name.endsWith(".exe"));
    const sig = release.assets.find((a) => a.name === `${exe ? exe.name : "?"}.sig`);
    if (!exe || !sig) {
      console.log(`⚠ ${t.key}: installer or signature asset missing — skipped.`);
      continue;
    }
    const signature = (await (await fetch(sig.url, { ...headers, Accept: "application/octet-stream" })).text()).trim();
    if (!signature) {
      console.log(`⚠ ${t.key}: empty signature — skipped. Did you set TAURI_SIGNING_PRIVATE_KEY?`);
      continue;
    }
    const entry = { signature, url: exe.browser_download_url };
    const current = latest.platforms[t.key];
    if (!current || current.signature !== signature || current.url !== entry.url) {
      latest.platforms[t.key] = entry;
      changed = true;
    }
    console.log(`✓ ${t.key}: ${exe.name}`);
  }

  if (!changed) {
    console.log("latest.json is already up to date for all platforms.");
    return;
  }

  // 4. Upload (delete + re-upload = clobber).
  const body = JSON.stringify(latest, null, 2);
  if (latestAsset) {
    const delRes = await fetch(`${API}/releases/assets/${latestAsset.id}`, {
      method: "DELETE",
      headers,
    });
    console.log(`Deleted old latest.json (status ${delRes.status})`);
  }
  const uploadRes = await fetch(
    `https://uploads.github.com/repos/${OWNER}/${REPO}/releases/${release.id}/assets?name=latest.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/octet-stream",
        "Content-Length": Buffer.byteLength(body),
      },
      body,
    }
  );
  if (!uploadRes.ok) {
    console.error(`Upload failed (${uploadRes.status}): ${await uploadRes.text()}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ Uploaded merged latest.json with both Windows updater entries.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
