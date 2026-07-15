# Independent Audio Device Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independently selectable microphone and Windows render-endpoint capture, explicit degraded-state handling, and a reproducible Windows x64 NSIS package.

**Architecture:** Keep microphone capture in the renderer with an exact MediaDevices `deviceId`. Add a standalone C++ WASAPI loopback helper and a main-process service that enumerates endpoints, starts the exact selected endpoint, parses framed PCM16, monitors health, and forwards system audio to STT and timestamp-aware AEC. Persist selections through the existing settings service and expose them through narrow IPC APIs.

**Tech Stack:** Electron 30.5.1, Node.js CommonJS and `node:test`, Lit-style Web Components, esbuild, C++17 Windows Core Audio/WASAPI, MSVC x64, electron-builder/NSIS.

## Global Constraints

- Target Windows 10/11 x64 only.
- Never silently substitute an unavailable microphone or output endpoint.
- One automatic reconnect attempt may target only the same WASAPI endpoint.
- Chromium loopback is an explicit emergency mode for the Windows default output only.
- System-audio loss must surface as `degraded`, not silently continue microphone-only.
- Package is unsigned because no certificate is in scope.
- This recovered directory has no Git metadata; replace commit steps with local verification checkpoints.

---

### Task 1: Reproducible build and test harness

**Files:**
- Modify: `package.json`
- Create: `scripts/build-renderer.js`
- Create: `scripts/build-native.ps1`
- Create: `test/smoke/source-integrity.test.js`

**Interfaces:**
- Produces `npm test`, `npm run build:renderer`, `npm run build:native`, `npm run dist:win`.

- [ ] Write a failing `node:test` asserting required entry files, renderer entry imports, and packaging metadata.
- [ ] Run `node --test test/smoke/source-integrity.test.js`; expect failure because scripts/build metadata are absent.
- [ ] Add exact Electron 30.5.1, esbuild, and electron-builder tooling plus scripts and x64 NSIS configuration.
- [ ] Run the smoke test and renderer build; expect exit code 0 and regenerated `public/build/content.js` plus source map.

### Task 2: Native audio algorithms and binary protocol

**Files:**
- Create: `native/windows-audio-helper/audio_processing.h`
- Create: `native/windows-audio-helper/audio_processing.cpp`
- Create: `native/windows-audio-helper/protocol.h`
- Create: `native/windows-audio-helper/native_tests.cpp`

**Interfaces:**
- Produces `downmixToMono(...)`, `LinearResampler16k`, RMS calculation, and packed `AudioFrameHeader` with magic `WAP1`.

- [ ] Write native tests for stereo cancellation-safe averaging, multichannel averaging, 48 kHz→16 kHz sample count, RMS, and header layout.
- [ ] Compile and run tests; expect failure because implementation files are missing.
- [ ] Implement minimal C++17 audio conversion and framing.
- [ ] Recompile and run; expect all native tests to pass.

### Task 3: WASAPI endpoint enumeration and selected-endpoint capture

**Files:**
- Create: `native/windows-audio-helper/wasapi_capture.h`
- Create: `native/windows-audio-helper/wasapi_capture.cpp`
- Create: `native/windows-audio-helper/main.cpp`
- Modify: `scripts/build-native.ps1`

**Interfaces:**
- `whisper-audio-helper.exe list` prints one JSON object `{type:"devices",devices:[{id,name,isDefault,state}]}`.
- `whisper-audio-helper.exe capture --device <endpointId> --pipe <namedPipe>` emits JSON health/error events and writes framed mono PCM16/16 kHz to the named pipe.

- [ ] Add an integration test invoking `list` and validating parseable JSON with a devices array.
- [ ] Run it; expect failure because the helper executable is absent.
- [ ] Implement COM initialization, `IMMDeviceEnumerator` listing, exact endpoint activation, `IAudioClient` loopback, mix-format decoding, pipe writes, and stable errors.
- [ ] Build x64 and run list/native tests; expect exit code 0.

### Task 4: Main-process Windows audio service

**Files:**
- Create: `src/features/listen/audio/windowsAudioProtocol.js`
- Create: `src/features/listen/audio/windowsAudioService.js`
- Create: `test/audio/windowsAudioProtocol.test.js`
- Create: `test/audio/windowsAudioService.test.js`

**Interfaces:**
- `listDevices(): Promise<AudioEndpoint[]>`
- `startCapture({deviceId,onAudio,onHealth}): Promise<void>`
- `stopCapture(): Promise<void>`
- Frame callbacks contain `{pcmBase64,timestampUs,rms,sampleRate:16000}`.

- [ ] Write failing tests for split-frame parsing, malformed headers, exact-device arguments, same-device single retry, timeout→degraded, and no device substitution.
- [ ] Run focused tests and confirm expected missing-module failures.
- [ ] Implement dependency-injected spawn/pipe/clock adapters and packaged/dev helper resolution.
- [ ] Run focused and full Node tests; expect zero failures.

### Task 5: Settings persistence and IPC contracts

**Files:**
- Modify: `src/features/settings/settingsService.js`
- Modify: `src/bridge/featureBridge.js`
- Modify: `src/preload.js`
- Create: `src/features/listen/audio/audioSettings.js`
- Create: `test/audio/audioSettings.test.js`
- Create: `test/audio/audioIpcContract.test.js`

**Interfaces:**
- Persist `{microphoneDeviceId,systemAudioDeviceId,systemAudioMode}`.
- IPC: `audio:list-output-devices`, `audio:start-windows-capture`, `audio:stop-windows-capture`, `audio:retry-windows-capture`, and `audio-health` events.

- [ ] Write failing normalization and IPC-contract tests, including missing persisted devices and emergency-loopback labels.
- [ ] Run tests and verify expected failures.
- [ ] Add normalized defaults, narrow preload APIs, helper lifecycle handlers, STT forwarding, and health broadcasts.
- [ ] Run all tests and syntax checks; expect zero failures.

### Task 6: Exact microphone selection and timestamp-aware AEC

**Files:**
- Modify: `src/ui/listen/audioCore/listenCapture.js`
- Create: `src/ui/listen/audioCore/audioDeviceModel.js`
- Create: `test/audio/audioDeviceModel.test.js`
- Create: `test/audio/aecReferenceQueue.test.js`

**Interfaces:**
- `buildMicrophoneConstraints(deviceId)` returns exact constraints.
- `AecReferenceQueue` accepts timestamped system frames and returns only a fresh aligned frame.

- [ ] Write failing tests for exact microphone constraints, disconnected selections, explicit stereo downmix, aligned reference selection, and stale-reference rejection.
- [ ] Run tests and confirm feature-missing failures.
- [ ] Implement the model and queue, request saved settings at capture start, start the native Windows path, and remove silent Windows loopback continuation.
- [ ] Run focused and full tests; expect zero failures.

### Task 7: Settings and Listen degraded-state UI

**Files:**
- Modify: `src/ui/settings/SettingsView.js`
- Modify: `src/ui/settings/settings-view.css.js`
- Modify: `src/ui/listen/ListenView.js`
- Modify: `src/ui/listen/listen-view.css.js`
- Create: `test/ui/audioSettingsView.test.js`

**Interfaces:**
- Settings displays microphone/output selectors, refresh, disconnected option, mode, health, and RMS.
- Listen displays actionable degraded status with Retry and Choose another device.

- [ ] Write a failing rendered-template test for labels, controls, disconnected state, and degraded actions.
- [ ] Run it and confirm the controls are absent.
- [ ] Implement device enumeration, save handlers, health listeners, meters, and degraded banner using existing visual patterns.
- [ ] Rebuild renderer and run tests; expect zero failures.

### Task 8: Packaging, runtime QA, and installer

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Generate: `dist/Whisper-Setup-1.7.0-audio-devices.exe`

**Interfaces:**
- Packaged helper resides in `resources/native/windows-audio-helper/whisper-audio-helper.exe`.

- [ ] Run complete Node/native tests and `node --check` over application sources.
- [ ] Rebuild `better-sqlite3`/native dependencies for Electron 30.5.1 x64 and run Electron smoke startup.
- [ ] Validate the Settings target flow: open Settings → refresh → select mic/output → save → observe persisted selection and health/degraded state.
- [ ] Run helper endpoint enumeration and an available-endpoint capture smoke test; record RMS/frame evidence without retaining audio.
- [ ] Build unpacked x64 application and NSIS installer with electron-builder.
- [ ] Launch the packaged app from an isolated directory and verify helper discovery, UI rendering, and no relevant console errors.
- [ ] Record exact artifact path, SHA-256, test results, and any hardware-dependent validation remaining.
