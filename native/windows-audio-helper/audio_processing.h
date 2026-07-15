#pragma once

#include <cstdint>
#include <vector>

std::vector<float> downmixToMono(const float* interleaved, std::size_t frames, std::size_t channels);
std::vector<float> resampleLinear(const std::vector<float>& input, std::uint32_t inputRate, std::uint32_t outputRate);
std::vector<std::int16_t> floatToPcm16(const std::vector<float>& input);
float calculateRms(const std::vector<float>& input);
