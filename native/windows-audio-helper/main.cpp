#include "wasapi_capture.h"

#include <iostream>
#include <string>

namespace {
void printUsage() {
    std::cerr << "usage: whisper-audio-helper list | capture --device <endpoint-id> --pipe <pipe-name>\n";
}
}

int wmain(int argc, wchar_t** argv) {
    if (argc == 2 && std::wstring(argv[1]) == L"list") return listRenderDevices();
    if (argc == 6 && std::wstring(argv[1]) == L"capture") {
        std::wstring deviceId;
        std::wstring pipeName;
        for (int index = 2; index + 1 < argc; index += 2) {
            const std::wstring option = argv[index];
            if (option == L"--device") deviceId = argv[index + 1];
            if (option == L"--pipe") pipeName = argv[index + 1];
        }
        if (!deviceId.empty() && !pipeName.empty()) return captureRenderDevice(deviceId, pipeName);
    }
    printUsage();
    return 2;
}
