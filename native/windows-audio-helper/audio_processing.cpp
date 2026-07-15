#include "audio_processing.h"

#include <algorithm>
#include <cmath>
#include <stdexcept>

std::vector<float> downmixToMono(const float* interleaved, std::size_t frames, std::size_t channels) {
    if (!interleaved || channels == 0) throw std::invalid_argument("invalid interleaved audio");
    std::vector<float> mono(frames);
    for (std::size_t frame = 0; frame < frames; ++frame) {
        double sum = 0.0;
        for (std::size_t channel = 0; channel < channels; ++channel) {
            sum += interleaved[frame * channels + channel];
        }
        mono[frame] = static_cast<float>(sum / static_cast<double>(channels));
    }
    return mono;
}

std::vector<float> resampleLinear(const std::vector<float>& input, std::uint32_t inputRate, std::uint32_t outputRate) {
    if (input.empty()) return {};
    if (inputRate == 0 || outputRate == 0) throw std::invalid_argument("invalid sample rate");
    if (inputRate == outputRate) return input;

    const auto outputSize = static_cast<std::size_t>(
        std::llround(static_cast<double>(input.size()) * outputRate / inputRate));
    std::vector<float> output(outputSize);
    const double ratio = static_cast<double>(inputRate) / outputRate;
    for (std::size_t index = 0; index < outputSize; ++index) {
        const double sourcePosition = index * ratio;
        const auto left = static_cast<std::size_t>(sourcePosition);
        const auto right = std::min(left + 1, input.size() - 1);
        const float fraction = static_cast<float>(sourcePosition - left);
        output[index] = input[left] + (input[right] - input[left]) * fraction;
    }
    return output;
}

std::vector<std::int16_t> floatToPcm16(const std::vector<float>& input) {
    std::vector<std::int16_t> output(input.size());
    std::transform(input.begin(), input.end(), output.begin(), [](float sample) {
        const float clamped = std::clamp(sample, -1.0f, 1.0f);
        return static_cast<std::int16_t>(std::lround(clamped * 32767.0f));
    });
    return output;
}

float calculateRms(const std::vector<float>& input) {
    if (input.empty()) return 0.0f;
    double sumSquares = 0.0;
    for (const float sample : input) sumSquares += static_cast<double>(sample) * sample;
    return static_cast<float>(std::sqrt(sumSquares / input.size()));
}
