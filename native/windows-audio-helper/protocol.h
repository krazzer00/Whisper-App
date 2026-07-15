#pragma once

#include <cstdint>

#pragma pack(push, 1)
struct AudioFrameHeader {
    char magic[4];
    std::uint32_t payloadBytes;
    std::uint64_t timestampUs;
    float rms;
    std::uint32_t sampleRate;
    std::uint16_t channels;
    std::uint16_t bitsPerSample;
};
#pragma pack(pop)

static_assert(sizeof(AudioFrameHeader) == 28, "Audio frame header must remain stable");
