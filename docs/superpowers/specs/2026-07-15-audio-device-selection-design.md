# Independent Audio Device Selection Design

## Goal

Add explicit microphone and Windows output-endpoint selection to Whisper 1.7.0, replace the unreliable Windows Chromium loopback path with independent WASAPI loopback capture, surface capture failures, and produce a Windows 10/11 x64 NSIS installer.

## Scope

- Windows 10/11 x64, matching the recovered installer.
- Microphone selection through `navigator.mediaDevices.getUserMedia` and the selected `deviceId`.
- Output-device enumeration and independent loopback capture through a separately built native helper.
- Persisted selections, device refresh, capture health, RMS telemetry, and explicit degraded state.
- Reconstructed Electron application, native helper, automated tests, packaged application, and NSIS installer.
- No ARM64 build, no signing certificate, and no server-side changes.

## Architecture

### Native helper

`native/windows-audio-helper` is a standalone C++ x64 executable using Windows Core Audio APIs. It enumerates active render endpoints with stable WASAPI endpoint IDs and captures the selected endpoint with `AUDCLNT_STREAMFLAGS_LOOPBACK`. It does not depend on the Electron or Node ABI.

Control messages use newline-delimited JSON on stdin/stdout. Captured audio is written as framed binary PCM16 through a dedicated inherited pipe so control responses cannot be confused with audio. Each frame includes a monotonic timestamp, sample count, and RMS telemetry. The helper converts the device mix format to mono PCM16 at 16 kHz using explicit channel averaging and deterministic resampling.

### Electron main process

`windowsAudioService` owns helper discovery, process startup, endpoint enumeration, capture lifecycle, frame parsing, health timers, one reconnect attempt, and structured errors. It forwards system PCM into the existing `listenService`/`sttService` path and publishes health events to renderer windows.

The service never silently substitutes another endpoint. If the selected endpoint disappears or stops delivering frames, the session becomes `degraded` and exposes retry/device-selection actions.

### Renderer and settings

Microphones are enumerated with `navigator.mediaDevices.enumerateDevices()` after permission is available. The selected microphone ID is applied as an exact `deviceId` constraint when capture starts.

Settings gains an Audio Devices section with microphone and system-output selectors, refresh, status labels, and RMS meters. A previously selected but unavailable device remains visible as disconnected. The system selector also contains an explicitly labeled emergency Chromium-loopback option that captures only the current Windows default output.

Selections are persisted through the existing settings service and IPC bridge. Device lists and transient health are not stored in SQLite.

## Data flow

1. Settings requests microphone devices from the renderer and output endpoints from `windowsAudioService` through IPC.
2. The user saves `microphoneDeviceId`, `systemAudioDeviceId`, and `systemAudioMode`.
3. Starting Listen opens the exact microphone device and starts the helper for the exact output endpoint.
4. Microphone PCM follows the existing renderer-to-main IPC route.
5. Helper PCM is framed, validated, forwarded to STT, and echoed to the renderer with timestamps for AEC reference alignment.
6. AEC consumes only fresh timestamp-aligned reference frames; stale frames are discarded.

## Failure behavior

- Helper startup, endpoint-open, format, pipe, timeout, disconnect, and unexpected-exit failures are represented by stable error codes and human-readable messages.
- A single automatic reconnect is attempted for the same endpoint.
- No automatic device substitution occurs.
- Missing system PCM transitions the session to `degraded`; microphone-only continuation is never silent.
- Settings and Listen both show the failure and offer Retry and Choose another device.
- Emergency Chromium loopback is enabled only by an explicit user selection and is labeled as using the Windows default device.

## Testing and acceptance

- Node unit tests cover protocol framing, settings normalization, device-disappearance behavior, health timeout, and IPC contracts.
- Native tests cover endpoint DTO serialization, stereo/multichannel downmix, resampling, and binary frame headers.
- Regression tests demonstrate that silent loopback loss produces `degraded` state.
- Renderer QA verifies device selection, refresh, disconnected state, RMS updates, and actionable errors.
- Manual Windows audio testing selects two distinct physical render endpoints and confirms the selected endpoint is captured independently of the Windows default.
- Electron starts from reconstructed sources without relevant console errors.
- The packaged x64 application and NSIS installer launch from an isolated test location.

## Packaging

The recovered package metadata is extended with deterministic scripts for renderer bundling, native C++ compilation, tests, Electron packaging, and NSIS generation. The helper executable is included outside ASAR and resolved through `process.resourcesPath` in packaged builds. Existing native Node dependencies are rebuilt for Electron 30.5.1 x64.

The resulting installer remains unsigned because the recovered original is unsigned and no signing certificate is in scope.
