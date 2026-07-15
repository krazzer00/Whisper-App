#pragma once

#include <string>

int listRenderDevices();
int captureRenderDevice(const std::wstring& endpointId, const std::wstring& pipeName);
