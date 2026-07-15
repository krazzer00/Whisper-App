# Whisper-App 1.7.1: clean repository and release design

## Goal

Create a clean, independently buildable Windows project at `C:\whisper-research\Whisper-App`, publish it as the private GitHub repository `Krazzer00/Whisper-App`, and publish the verified Windows installer in GitHub Release `v1.7.1`.

## Source baseline

The functional baseline is `C:\whisper-research\recovered-source\whisper-reconstructed-fixed`. The new project preserves its tested Electron, renderer, backend bundle, and standalone WASAPI helper behavior. This release changes packaging, documentation, repository hygiene, and versioning; it does not redesign the working audio implementation.

## Repository contents

The repository includes:

- `src/`: Electron main process, preload bridges, application services, and renderer UI sources.
- `native/`: source for the standalone Windows WASAPI helper. Compiled binaries are generated during the build and are not committed.
- `scripts/`: deterministic renderer and native build entry points.
- `test/`: JavaScript contracts, native integration checks, and UI source checks.
- `public/`: application HTML, CSS, assets, and generated renderer bundles required at runtime.
- `whisper_web/`: the recovered backend and frontend runtime assets required for an autonomous package build. Their original higher-level sources are not available, so these artifacts are treated as vendored runtime inputs and documented as such.
- `docs/`: architecture and release documentation relevant to the maintained project.
- `build/app-update.yml`: packaged updater metadata required by electron-builder.
- `.github/workflows/windows-build.yml`: Windows CI for install, tests, build, and installer artifact generation.
- Root project metadata: `package.json`, lockfile, `.env.example`, `.gitignore`, `LICENSE`, and `README.md`.

The repository excludes `node_modules`, `dist`, compiler object files, logs, caches, local settings, credentials, old installers, screenshots, and recovery-only diagnostic notes.

## Version and artifacts

- Application and package version: `1.7.1`.
- Git tag: `v1.7.1`.
- Installer: `Whisper-Setup-1.7.1-audio-devices.exe`.
- GitHub repository visibility: private.
- Default branch: `main`.
- Release title: `Whisper App 1.7.1`.
- Release state: published, not draft and not prerelease.

The release description summarizes independent microphone/output selection, exact WASAPI endpoint capture, silent-audio heartbeat handling, degraded-state recovery, and the unsigned-installer warning.

## Documentation

The Russian README contains:

- application purpose and feature overview;
- supported platform and prerequisites;
- clean install, test, build, and packaging commands;
- project directory map;
- audio capture architecture and fallback behavior;
- installer usage and SmartScreen warning;
- configuration guidance without embedding secrets;
- troubleshooting and release information;
- GPL-3.0 license notice.

## CI and release workflow

GitHub Actions runs on `windows-2022` with Node `22.22.0`, matching the MSVC 2022/native dependency matrix verified locally. It installs with `npm ci`, runs the complete test suite, builds the renderer and native helper, and builds the NSIS installer. Workflow permissions remain read-only. The initial `v1.7.1` release is created from the locally verified artifact using authenticated GitHub CLI.

## Validation and security gates

Before the first push:

1. Scan tracked candidates for environment files, credentials, tokens, private keys, local databases, object files, and oversized accidental artifacts.
2. Install dependencies from the committed lockfile with `npm ci`.
3. Run all JavaScript/native integration tests.
4. Compile all renderer and native outputs from the clean directory.
5. Build the NSIS installer and verify expected packaged resources.
6. Install into an isolated directory and confirm the installed application starts.
7. Record installer size and SHA-256.
8. Verify Git status contains only intended project files.

After publication, verify repository visibility, default branch, tag commit, release state, asset name, asset size, and downloadable release URL through GitHub.

## Failure handling and rollback

No existing repository is overwritten. If repository creation or push fails, the clean local project remains the source of truth and publication is retried after correcting authentication or network state. If the release asset check fails, the release remains a draft or is deleted and recreated before announcing completion. Rollback is performed by deleting the incorrect GitHub release/tag while preserving `main`; destructive remote cleanup is only used for objects created during this task.

## Acceptance criteria

- `C:\whisper-research\Whisper-App` is a clean Git repository on `main` with no ignored build output tracked.
- `package.json` and generated installer report version `1.7.1`.
- A clean dependency install, all tests, native/renderer build, package build, and installed-app smoke test pass.
- `Krazzer00/Whisper-App` exists and is private.
- GitHub Release `v1.7.1` is published from the verified commit and contains the verified installer.
- README and release notes accurately describe build prerequisites, recovered vendored web runtime inputs, unsigned status, and audio-device functionality.
