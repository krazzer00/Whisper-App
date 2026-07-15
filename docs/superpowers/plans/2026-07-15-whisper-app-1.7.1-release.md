# Whisper-App 1.7.1 Repository and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a clean local Git project and private GitHub repository for Whisper App 1.7.1, then publish its verified Windows installer in Release `v1.7.1`.

**Architecture:** Copy an explicit allowlist from the verified 1.7.0 recovery workspace into a new sibling directory, preserve the working source layout and vendored web runtime inputs, and regenerate every native/renderer/package output. GitHub Actions reproduces the Windows test/build pipeline, while the initial release uses the locally smoke-tested immutable installer.

**Tech Stack:** Electron 30, Node.js/npm, esbuild, MSVC C++17, WASAPI, electron-builder/NSIS, Git, GitHub CLI, GitHub Actions on `windows-latest`.

## Global Constraints

- Local root is exactly `C:\whisper-research\Whisper-App`.
- GitHub repository is exactly `Krazzer00/Whisper-App` and private.
- Version, tag, and installer are exactly `1.7.1`, `v1.7.1`, and `Whisper-Setup-1.7.1-audio-devices.exe`.
- Default branch is `main`; the release is published, not a draft or prerelease.
- Never commit credentials, local settings, `node_modules`, `dist`, compiler objects, caches, logs, old installers, or screenshots.
- Keep recovered `whisper_web` runtime inputs because no higher-level source is available.
- The Windows installer remains unsigned and must be documented as such.

---

### Task 1: Create the clean project snapshot

**Files:**
- Copy: `src/**`, `native/**`, `scripts/**`, `test/**`, `public/**`, `whisper_web/**`, `docs/**`
- Copy: `build/app-update.yml`
- Copy: `package.json`, `package-lock.json`, `.env.example`
- Create: `.gitignore`

**Interfaces:**
- Consumes: verified source root `C:\whisper-research\recovered-source\whisper-reconstructed-fixed`.
- Produces: source-only project root `C:\whisper-research\Whisper-App`.

- [ ] **Step 1: Assert destination does not already exist**

Run: `Test-Path -LiteralPath C:\whisper-research\Whisper-App`
Expected: `False`. Stop without overwriting if `True`.

- [ ] **Step 2: Copy only the approved roots and metadata**

Create the destination and copy the explicit allowlist. Remove copied generated files matching `native/windows-audio-helper/bin/*.exe`, `public/build/*`, and any `*.obj`; these must be recreated during validation.

- [ ] **Step 3: Add Git exclusions**

Create `.gitignore` with these effective rules:

```gitignore
node_modules/
dist/
native/windows-audio-helper/bin/
public/build/
*.obj
*.pdb
*.log
.env
.env.*
!.env.example
.DS_Store
Thumbs.db
.vscode/
.idea/
coverage/
```

- [ ] **Step 4: Verify forbidden artifacts are absent**

Run a recursive scan for `.obj`, `.pdb`, `.exe`, `.env` other than `.env.example`, `node_modules`, and `dist`.
Expected: no matches.

### Task 2: Set release metadata and documentation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `README.md`
- Create: `LICENSE`
- Create: `docs/architecture/audio-capture.md`

**Interfaces:**
- Consumes: existing npm package metadata and audio implementation.
- Produces: npm version `1.7.1`, Russian operator/developer documentation, GPL-3.0 license text.

- [ ] **Step 1: Update package version without creating a tag**

Run: `npm version 1.7.1 --no-git-tag-version`
Expected: both manifest and lockfile report `1.7.1`.

- [ ] **Step 2: Write README**

Document purpose, independent mic/output selection, requirements, `npm ci`, `npm test`, `npm run build`, `npm run dist:win`, directory map, WASAPI failure behavior, `.env.example`, SmartScreen warning, troubleshooting, license, and v1.7.1 release installation.

- [ ] **Step 3: Add architecture note and GPL-3.0 text**

The architecture note identifies `windowsAudioService.js`, `windowsAudioProtocol.js`, the C++ helper, named-pipe PCM frames, silence heartbeats, exact endpoint retry, AEC alignment, and explicit Chromium fallback.

- [ ] **Step 4: Assert consistent versioning**

Run: `node -e "const p=require('./package.json'),l=require('./package-lock.json'); if(p.version!=='1.7.1'||l.version!=='1.7.1'||l.packages[''].version!=='1.7.1') process.exit(1)"`
Expected: exit 0.

### Task 3: Add reproducible Windows CI

**Files:**
- Create: `.github/workflows/windows-build.yml`

**Interfaces:**
- Consumes: npm scripts `test`, `build`, and `dist:win`.
- Produces: uploaded NSIS artifact for pushes, pull requests, tags, and manual runs.

- [ ] **Step 1: Create the workflow**

Use `windows-2022`, `actions/checkout@v4`, `actions/setup-node@v4` with Node `22.22.0` and npm cache, `npm ci`, `npm test`, `npm run dist:win`, and `actions/upload-artifact@v4` for `dist/Whisper-Setup-1.7.1-audio-devices.exe`. Set top-level `permissions: contents: read` and a 30-minute timeout.

- [ ] **Step 2: Validate workflow and paths**

Parse the YAML and assert every referenced npm script exists in `package.json` and the artifact path matches `build.artifactName` for version `1.7.1`.

### Task 4: Validate from a clean dependency state

**Files:**
- Generate ignored: `node_modules/**`, `public/build/**`, `native/windows-audio-helper/bin/**`

**Interfaces:**
- Consumes: committed lockfile and MSVC x64 toolchain.
- Produces: passing tests and regenerated renderer/native outputs.

- [ ] **Step 1: Install deterministically**

Run: `npm ci`
Expected: exit 0 with the lockfile unchanged.

- [ ] **Step 2: Run full tests**

Run: `npm test`
Expected: `pretest` compiles the native helper, then all 18 tests pass, including two independently selected WASAPI endpoints.

- [ ] **Step 3: Build all outputs**

Run: `npm run build`
Expected: renderer bundles, helper executable, and native tests are generated; native audio tests pass.

- [ ] **Step 4: Run source syntax and production audit checks**

Run `node --check` over project JavaScript sources and `npm audit --omit=dev`.
Expected: syntax exit 0; record any non-high/non-critical inherited findings, and do not force breaking dependency upgrades.

### Task 5: Initialize and commit the private-project source tree

**Files:**
- Create: `.git/**`

**Interfaces:**
- Consumes: validated source tree.
- Produces: one clean `main` commit containing only intended files.

- [ ] **Step 1: Initialize Git and inspect candidates**

Run: `git init -b main`, then `git status --short --ignored`.
Expected: build outputs appear ignored; source and documentation appear untracked.

- [ ] **Step 2: Scan staged candidates for secrets and oversized files**

Stage with `git add .`, list files over 20 MiB, scan filenames and text for tokens/private keys/password assignments, and inspect `git diff --cached --stat`.
Expected: no credentials or accidental binaries; only documented vendored runtime assets may be sizeable.

- [ ] **Step 3: Commit source release**

Run: `git commit -m "release: prepare Whisper App 1.7.1"`
Expected: clean working tree except ignored build output.

### Task 6: Build and smoke-test the release installer

**Files:**
- Generate ignored: `dist/Whisper-Setup-1.7.1-audio-devices.exe`

**Interfaces:**
- Consumes: committed release source.
- Produces: locally verified NSIS installer and SHA-256.

- [ ] **Step 1: Build installer**

Run: `npm run dist:win`
Expected: electron-builder creates the exact 1.7.1 installer and blockmap.

- [ ] **Step 2: Verify packaged resources**

Assert `resources/app.asar`, `resources/out/index.html`, `resources/app-update.yml`, and `resources/native/windows-audio-helper/whisper-audio-helper.exe` exist under `dist/win-unpacked`.

- [ ] **Step 3: Perform isolated install and startup smoke test**

Install silently into a new `C:\whisper-research\installer-smoke-1.7.1-*` path, launch its `Whisper.exe`, verify it remains alive for eight seconds, then stop only processes whose executable path begins with that isolated directory.

- [ ] **Step 4: Record immutable artifact identity**

Run: `Get-FileHash -Algorithm SHA256 dist\Whisper-Setup-1.7.1-audio-devices.exe` and record exact byte length.

### Task 7: Publish private repository and GitHub Release

**Files:**
- Remote: `https://github.com/Krazzer00/Whisper-App`
- Release asset: `Whisper-Setup-1.7.1-audio-devices.exe`

**Interfaces:**
- Consumes: clean commit and verified local installer.
- Produces: private `main`, immutable tag `v1.7.1`, and published release.

- [ ] **Step 1: Re-run final verification before external mutation**

Run: `npm test`, `git status --short`, secret scan, installer hash, and `gh auth status`.
Expected: tests pass, tracked tree is clean, no secrets, artifact identity matches Task 6, and authenticated account is `krazzer00` with `repo` scope.

- [ ] **Step 2: Create and push private repository**

Run: `gh repo create Krazzer00/Whisper-App --private --source . --remote origin --push`.
Expected: remote `main` points to the local commit and repository visibility is `PRIVATE`.

- [ ] **Step 3: Create tag and published release**

Create annotated tag `v1.7.1`, push it, then run `gh release create v1.7.1 dist/Whisper-Setup-1.7.1-audio-devices.exe --repo Krazzer00/Whisper-App --title "Whisper App 1.7.1" --notes-file docs/releases/v1.7.1.md --verify-tag`.
Expected: published release, not draft/prerelease.

- [ ] **Step 4: Verify remote state**

Use `gh repo view`, `gh release view`, `git ls-remote`, and `gh api` release assets.
Expected: private repository, default branch `main`, tag commit equals local HEAD, release asset name/size match the verified local file, and the browser/download URLs resolve for the authenticated owner.
