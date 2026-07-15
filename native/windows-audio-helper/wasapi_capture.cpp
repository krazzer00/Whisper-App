#include "wasapi_capture.h"

#define NOMINMAX
#include <windows.h>
#include <audioclient.h>
#include <avrt.h>
#include <ksmedia.h>
#include <mmdeviceapi.h>
#include <functiondiscoverykeys_devpkey.h>
#include <propvarutil.h>

#include "audio_processing.h"
#include "protocol.h"

#include <algorithm>
#include <chrono>
#include <cstdint>
#include <cstring>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

namespace {
template <typename T> void releaseCom(T*& pointer) {
    if (pointer) pointer->Release();
    pointer = nullptr;
}

std::string wideToUtf8(const wchar_t* value) {
    if (!value) return {};
    const int size = WideCharToMultiByte(CP_UTF8, 0, value, -1, nullptr, 0, nullptr, nullptr);
    if (size <= 1) return {};
    std::string output(static_cast<std::size_t>(size), '\0');
    WideCharToMultiByte(CP_UTF8, 0, value, -1, output.data(), size, nullptr, nullptr);
    output.pop_back();
    return output;
}

std::string jsonEscape(const std::string& value) {
    std::ostringstream output;
    for (const unsigned char character : value) {
        switch (character) {
            case '"': output << "\\\""; break;
            case '\\': output << "\\\\"; break;
            case '\b': output << "\\b"; break;
            case '\f': output << "\\f"; break;
            case '\n': output << "\\n"; break;
            case '\r': output << "\\r"; break;
            case '\t': output << "\\t"; break;
            default:
                if (character < 0x20) {
                    const char hex[] = "0123456789abcdef";
                    output << "\\u00" << hex[character >> 4] << hex[character & 0x0f];
                } else {
                    output << character;
                }
        }
    }
    return output.str();
}

void printError(const char* code, HRESULT result, const char* message) {
    std::cout << "{\"type\":\"error\",\"code\":\"" << code << "\",\"hresult\":"
              << static_cast<long>(result) << ",\"message\":\"" << jsonEscape(message) << "\"}" << std::endl;
}

std::uint64_t timestampUs() {
    return static_cast<std::uint64_t>(std::chrono::duration_cast<std::chrono::microseconds>(
        std::chrono::steady_clock::now().time_since_epoch()).count());
}

bool isFloatFormat(const WAVEFORMATEX* format) {
    if (format->wFormatTag == WAVE_FORMAT_IEEE_FLOAT) return true;
    if (format->wFormatTag != WAVE_FORMAT_EXTENSIBLE) return false;
    const auto* extensible = reinterpret_cast<const WAVEFORMATEXTENSIBLE*>(format);
    return IsEqualGUID(extensible->SubFormat, KSDATAFORMAT_SUBTYPE_IEEE_FLOAT) != FALSE;
}

bool isPcmFormat(const WAVEFORMATEX* format) {
    if (format->wFormatTag == WAVE_FORMAT_PCM) return true;
    if (format->wFormatTag != WAVE_FORMAT_EXTENSIBLE) return false;
    const auto* extensible = reinterpret_cast<const WAVEFORMATEXTENSIBLE*>(format);
    return IsEqualGUID(extensible->SubFormat, KSDATAFORMAT_SUBTYPE_PCM) != FALSE;
}

std::vector<float> decodeFrames(const BYTE* data, UINT32 frames, const WAVEFORMATEX* format, bool silent) {
    const std::size_t channels = format->nChannels;
    std::vector<float> interleaved(static_cast<std::size_t>(frames) * channels, 0.0f);
    if (!silent) {
        if (isFloatFormat(format) && format->wBitsPerSample == 32) {
            const auto* source = reinterpret_cast<const float*>(data);
            std::copy(source, source + interleaved.size(), interleaved.begin());
        } else if (isPcmFormat(format) && format->wBitsPerSample == 16) {
            const auto* source = reinterpret_cast<const std::int16_t*>(data);
            std::transform(source, source + interleaved.size(), interleaved.begin(), [](std::int16_t sample) {
                return sample / 32768.0f;
            });
        } else if (isPcmFormat(format) && format->wBitsPerSample == 32) {
            const auto* source = reinterpret_cast<const std::int32_t*>(data);
            std::transform(source, source + interleaved.size(), interleaved.begin(), [](std::int32_t sample) {
                return static_cast<float>(sample / 2147483648.0);
            });
        } else if (isPcmFormat(format) && format->wBitsPerSample == 24) {
            for (std::size_t index = 0; index < interleaved.size(); ++index) {
                const BYTE* sample = data + index * 3;
                std::int32_t value = sample[0] | (sample[1] << 8) | (sample[2] << 16);
                if (value & 0x800000) value |= ~0xffffff;
                interleaved[index] = static_cast<float>(value / 8388608.0);
            }
        } else {
            return {};
        }
    }
    return downmixToMono(interleaved.data(), frames, channels);
}

bool writeAll(HANDLE pipe, const void* data, DWORD size) {
    const auto* bytes = static_cast<const BYTE*>(data);
    DWORD offset = 0;
    while (offset < size) {
        DWORD written = 0;
        if (!WriteFile(pipe, bytes + offset, size - offset, &written, nullptr) || written == 0) return false;
        offset += written;
    }
    return true;
}

bool writeAudioFrame(HANDLE pipe, const std::vector<float>& mono) {
    const auto pcm = floatToPcm16(mono);
    AudioFrameHeader header{ { 'W', 'A', 'P', '1' }, static_cast<std::uint32_t>(pcm.size() * sizeof(std::int16_t)),
        timestampUs(), calculateRms(mono), 16000, 1, 16 };
    return writeAll(pipe, &header, sizeof(header)) &&
        (pcm.empty() || writeAll(pipe, pcm.data(), header.payloadBytes));
}
}

int listRenderDevices() {
    HRESULT result = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (FAILED(result)) { printError("COM_INIT_FAILED", result, "Cannot initialize COM"); return 1; }

    IMMDeviceEnumerator* enumerator = nullptr;
    IMMDeviceCollection* collection = nullptr;
    IMMDevice* defaultDevice = nullptr;
    LPWSTR defaultId = nullptr;
    result = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
        __uuidof(IMMDeviceEnumerator), reinterpret_cast<void**>(&enumerator));
    if (SUCCEEDED(result)) result = enumerator->EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE, &collection);
    if (SUCCEEDED(result) && SUCCEEDED(enumerator->GetDefaultAudioEndpoint(eRender, eMultimedia, &defaultDevice))) {
        defaultDevice->GetId(&defaultId);
    }
    if (FAILED(result)) {
        printError("ENUMERATION_FAILED", result, "Cannot enumerate render endpoints");
        releaseCom(defaultDevice); releaseCom(collection); releaseCom(enumerator); CoUninitialize();
        return 1;
    }

    UINT count = 0;
    collection->GetCount(&count);
    std::cout << "{\"type\":\"devices\",\"devices\":[";
    for (UINT index = 0; index < count; ++index) {
        IMMDevice* device = nullptr;
        IPropertyStore* properties = nullptr;
        LPWSTR id = nullptr;
        PROPVARIANT name;
        PropVariantInit(&name);
        if (FAILED(collection->Item(index, &device))) continue;
        device->GetId(&id);
        if (SUCCEEDED(device->OpenPropertyStore(STGM_READ, &properties))) properties->GetValue(PKEY_Device_FriendlyName, &name);
        if (index) std::cout << ',';
        std::cout << "{\"id\":\"" << jsonEscape(wideToUtf8(id)) << "\",\"name\":\""
                  << jsonEscape(wideToUtf8(name.pwszVal)) << "\",\"isDefault\":"
                  << ((id && defaultId && wcscmp(id, defaultId) == 0) ? "true" : "false")
                  << ",\"state\":\"active\"}";
        PropVariantClear(&name);
        if (id) CoTaskMemFree(id);
        releaseCom(properties);
        releaseCom(device);
    }
    std::cout << "]}" << std::endl;

    if (defaultId) CoTaskMemFree(defaultId);
    releaseCom(defaultDevice); releaseCom(collection); releaseCom(enumerator); CoUninitialize();
    return 0;
}

int captureRenderDevice(const std::wstring& endpointId, const std::wstring& pipeName) {
    HRESULT result = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (FAILED(result)) { printError("COM_INIT_FAILED", result, "Cannot initialize COM"); return 1; }

    IMMDeviceEnumerator* enumerator = nullptr;
    IMMDevice* device = nullptr;
    IAudioClient* audioClient = nullptr;
    IAudioCaptureClient* captureClient = nullptr;
    WAVEFORMATEX* mixFormat = nullptr;
    HANDLE pipe = INVALID_HANDLE_VALUE;
    int exitCode = 1;
    std::chrono::steady_clock::time_point lastFrameWrite;

    result = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
        __uuidof(IMMDeviceEnumerator), reinterpret_cast<void**>(&enumerator));
    if (SUCCEEDED(result)) result = enumerator->GetDevice(endpointId.c_str(), &device);
    if (SUCCEEDED(result)) result = device->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr, reinterpret_cast<void**>(&audioClient));
    if (SUCCEEDED(result)) result = audioClient->GetMixFormat(&mixFormat);
    if (FAILED(result)) { printError("ENDPOINT_OPEN_FAILED", result, "Cannot open selected render endpoint"); goto cleanup; }

    if ((!isFloatFormat(mixFormat) && !isPcmFormat(mixFormat)) ||
        (mixFormat->wBitsPerSample != 16 && mixFormat->wBitsPerSample != 24 && mixFormat->wBitsPerSample != 32)) {
        printError("UNSUPPORTED_FORMAT", E_FAIL, "Selected endpoint mix format is unsupported");
        goto cleanup;
    }

    result = audioClient->Initialize(AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK,
        1000000, 0, mixFormat, nullptr);
    if (SUCCEEDED(result)) result = audioClient->GetService(__uuidof(IAudioCaptureClient), reinterpret_cast<void**>(&captureClient));
    if (FAILED(result)) { printError("CAPTURE_INIT_FAILED", result, "Cannot initialize WASAPI loopback"); goto cleanup; }

    for (int attempt = 0; attempt < 50 && pipe == INVALID_HANDLE_VALUE; ++attempt) {
        pipe = CreateFileW(pipeName.c_str(), GENERIC_WRITE, 0, nullptr, OPEN_EXISTING, 0, nullptr);
        if (pipe == INVALID_HANDLE_VALUE) Sleep(100);
    }
    if (pipe == INVALID_HANDLE_VALUE) { printError("PIPE_CONNECT_FAILED", HRESULT_FROM_WIN32(GetLastError()), "Cannot connect audio pipe"); goto cleanup; }

    result = audioClient->Start();
    if (FAILED(result)) { printError("CAPTURE_START_FAILED", result, "Cannot start WASAPI loopback"); goto cleanup; }
    std::cout << "{\"type\":\"ready\",\"sampleRate\":16000,\"channels\":1,\"bitsPerSample\":16}" << std::endl;
    lastFrameWrite = std::chrono::steady_clock::now();

    for (;;) {
        UINT32 packetFrames = 0;
        result = captureClient->GetNextPacketSize(&packetFrames);
        if (FAILED(result)) { printError("CAPTURE_READ_FAILED", result, "Cannot query WASAPI packet"); break; }
        if (packetFrames == 0) {
            const auto now = std::chrono::steady_clock::now();
            if (now - lastFrameWrite >= std::chrono::milliseconds(100)) {
                if (!writeAudioFrame(pipe, std::vector<float>(1600, 0.0f))) {
                    printError("PIPE_WRITE_FAILED", HRESULT_FROM_WIN32(GetLastError()), "Audio pipe closed");
                    goto cleanup;
                }
                lastFrameWrite = now;
            }
            Sleep(5);
            continue;
        }
        while (packetFrames > 0) {
            BYTE* data = nullptr;
            UINT32 frames = 0;
            DWORD flags = 0;
            result = captureClient->GetBuffer(&data, &frames, &flags, nullptr, nullptr);
            if (FAILED(result)) break;
            auto mono = decodeFrames(data, frames, mixFormat, (flags & AUDCLNT_BUFFERFLAGS_SILENT) != 0);
            captureClient->ReleaseBuffer(frames);
            if (mono.empty() && frames > 0) { printError("DECODE_FAILED", E_FAIL, "Cannot decode endpoint mix format"); goto cleanup; }
            mono = resampleLinear(mono, mixFormat->nSamplesPerSec, 16000);
            if (!writeAudioFrame(pipe, mono)) {
                printError("PIPE_WRITE_FAILED", HRESULT_FROM_WIN32(GetLastError()), "Audio pipe closed");
                goto cleanup;
            }
            lastFrameWrite = std::chrono::steady_clock::now();
            result = captureClient->GetNextPacketSize(&packetFrames);
            if (FAILED(result)) break;
        }
        if (FAILED(result)) { printError("CAPTURE_READ_FAILED", result, "Cannot read WASAPI packet"); break; }
    }

cleanup:
    if (audioClient) audioClient->Stop();
    if (pipe != INVALID_HANDLE_VALUE) CloseHandle(pipe);
    if (mixFormat) CoTaskMemFree(mixFormat);
    releaseCom(captureClient); releaseCom(audioClient); releaseCom(device); releaseCom(enumerator);
    CoUninitialize();
    return exitCode;
}
