#include "audio_processing.h"
#include "protocol.h"

#include <cmath>
#include <cstring>
#include <iostream>
#include <stdexcept>
#include <vector>

namespace {
void require(bool condition, const char* message) {
    if (!condition) throw std::runtime_error(message);
}

void requireNear(float actual, float expected, float tolerance, const char* message) {
    if (std::fabs(actual - expected) > tolerance) throw std::runtime_error(message);
}
}

int main() {
    try {
        const float stereo[] = { 1.0f, -1.0f, 0.5f, 0.5f };
        const auto mono = downmixToMono(stereo, 2, 2);
        require(mono.size() == 2, "stereo downmix frame count");
        requireNear(mono[0], 0.0f, 0.0001f, "stereo channels must be averaged");
        requireNear(mono[1], 0.5f, 0.0001f, "stereo average value");

        const float surround[] = { 1.0f, 0.5f, -0.5f, 0.0f };
        const auto surroundMono = downmixToMono(surround, 1, 4);
        requireNear(surroundMono[0], 0.25f, 0.0001f, "multichannel average value");

        std::vector<float> source(480, 0.25f);
        const auto resampled = resampleLinear(source, 48000, 16000);
        require(resampled.size() == 160, "48 kHz to 16 kHz sample count");

        const auto pcm = floatToPcm16({ -2.0f, -1.0f, 0.0f, 1.0f, 2.0f });
        require(pcm.front() == -32767, "negative PCM clamp");
        require(pcm.back() == 32767, "positive PCM clamp");

        requireNear(calculateRms({ 1.0f, -1.0f }), 1.0f, 0.0001f, "RMS calculation");

        AudioFrameHeader header{ { 'W', 'A', 'P', '1' }, 320, 1234, 0.5f, 16000, 1, 16 };
        require(std::memcmp(header.magic, "WAP1", 4) == 0, "protocol magic");
        require(sizeof(header) == 28, "protocol header size");

        std::cout << "native audio tests passed\n";
        return 0;
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
