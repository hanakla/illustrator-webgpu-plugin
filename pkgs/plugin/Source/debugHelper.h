#pragma once

#include <iostream>
#include <sstream>
#include <string>
#include "./libs/format.h"
#include "./super-illustrator.h"
#include "IllustratorSDK.h"
#include "json.hpp"

using json = nlohmann::json;

template <typename T, size_t N>
std::string arrayToString(T (&arr)[N]) {
  std::string str = "";
  for (size_t i = 0; i < N; i++) {
    str += std::to_string(arr[i]);
    if (i < N - 1) str += ", ";
  }
  return str;
}

template <typename... Args>
void csl(const char* format, Args... args) {
  if (!AI_DENO_DEBUG) return;

  std::cout << "[deno_ai(C)] " << string_format(format, args...) << std::endl;
}

// print as hex binary json array
void csb(const char* label, const char* value) {
  if (!AI_DENO_DEBUG) return;

  size_t len = strlen(value);

  std::stringstream ss;
  for (size_t i = 0; i < len; ++i) {
    ss << std::hex << std::uppercase << (int)value[i];
    if (i < len - 1) ss << ", ";
  }
  std::cout << "[deno_ai(C)] " << label << " [" << ss.str() << "]" << std::endl;
}

class dbg__Measuring {
 public:
  const char* label;

  dbg__Measuring(const char* label = nullptr) : label(label) {
    start = std::chrono::system_clock::now();
  }

  double elapsed() {
    end = std::chrono::system_clock::now();
    return std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count();
  }

 private:
  std::chrono::system_clock::time_point start, end;
};

std::stack<dbg__Measuring> dbg_cstCurrent;

dbg__Measuring timeStart(const char* label) {
  auto m = new dbg__Measuring(label);
  dbg_cstCurrent.push(*m);
  return *m;
}

void timeEnd() {
  if (!AI_DENO_DEBUG) return;

  dbg__Measuring* m = &dbg_cstCurrent.top();
  dbg_cstCurrent.pop();
  if (m == nullptr) return;

  csl("%s Elapsed: %.2fms", m->label, m->elapsed());
}

// void print_PluginParams(const PluginParams* params) {
//   if (!AI_DENO_DEBUG) return;
//
//   cs l("PluginParams: \n \
//    effectName: %s \n \
//    params: %s",
//       params->effectName.c_str(), params->params.dump().c_str());
//   // std::cout << "PluginParams:" << std::endl;
//   // std::cout << "  effectName: " << params->effectName << std::endl;
//   // std::cout << "  params: " << params->params.dump() << std::endl;
//   // std::cout << std::endl;
// }

void print_json(json value, std::string label) {
  if (!AI_DENO_DEBUG) return;
  std::cout << "print_json:" << label << value.dump() << std::endl;
}

void print_stringBin(const char* str, std::string label) {
  if (!AI_DENO_DEBUG) return;
  std::cout << "print_stringBin(char*):" << label << std::endl;

  std::stringstream ss;

  size_t l = strlen(str);
  for (size_t i = 0; i < l; i++) {
    ss << std::hex << std::uppercase << (int)str[i] << " ";
  }

  std::cout << "  hex: " << ss.str() << std::endl;
  std::cout << "  str: " << str << std::endl;
}

void print_stringBin(const std::string& str, std::string label) {
  if (!AI_DENO_DEBUG) return;
  std::cout << "print_stringBin:" << label << std::endl;

  std::stringstream ss;

  for (size_t i = 0; i < str.size(); i++) {
    ss << std::hex << std::uppercase << (int)str[i];
  }

  std::cout << "  hex: " << ss.str() << std::endl;
  std::cout << "  str: " << str << std::endl;
}

void print_AddLiveEffectMenuData(const AddLiveEffectMenuData* data) {
  if (!AI_DENO_DEBUG) return;
  std::cout << "AddLiveEffectMenuData:" << std::endl;
  std::cout << "  title: " << data->title << std::endl;
  std::cout << "  category: " << data->category << std::endl;
  std::cout << std::endl;
}

void print_AILiveEffectData(const AILiveEffectData* data) {
  if (!AI_DENO_DEBUG) return;
  std::cout << "AILiveEffectData:" << std::endl;
  std::cout << "  name: " << data->name << std::endl;
  std::cout << "  title: " << data->title << std::endl;
  std::cout << "  majorVersion: " << data->majorVersion << std::endl;
  std::cout << "  minorVersion: " << data->minorVersion << std::endl;
  std::cout << "  prefersAsInput: " << data->prefersAsInput << std::endl;
  std::cout << "  styleFilterFlags: " << data->styleFilterFlags << std::endl;
  std::cout << std::endl;
}

std::string stringify_ASErr(ASErr& err) {
  if (err == kNoErr) {
    return "kNoErr";
  } else {
    char errStr[5] = {0};
    std::memcpy(errStr, &err, 4);

    std::ostringstream oss;
    oss << "Unknown Error(code:" << errStr << " [raw: " << err << "])";
    return oss.str();
  }
}

void print_AIArt(AIArtHandle& art, std::string title) {
  if (!AI_DENO_DEBUG) return;

  auto [name, isDefault] = suai::art::getName(art);

  std::ostringstream oss;

  oss << "AIArt (" << title << "): " << std::endl;
  oss << "  type: " << suai::art::getArtTypeName(art) << std::endl;
  oss << "  name: " << name << " (isDefault: " << isDefault << ")" << std::flush;

  csl(oss.str().c_str());
}

void print_AISlice(AISlice* slice, std::string title) {
  if (!AI_DENO_DEBUG) return;

  std::ostringstream oss;

  oss << "AISlice (" << title << "): " << std::endl;
  oss << "  top: " << slice->top << std::endl;
  oss << "  left: " << slice->left << std::endl;
  oss << "  right: " << slice->right << std::endl;
  oss << "  bottom: " << slice->bottom << std::endl;
  oss << "  front: " << slice->front << std::endl;
  oss << "  back: " << slice->back << std::endl;
  oss << std::endl;

  csl(oss.str().c_str());
}

void print_AITile(AITile* tile, std::string title) {
  if (!AI_DENO_DEBUG) return;

  std::ostringstream oss;

  oss << "AITile (" << title << "): " << std::endl;
  oss << "  bounds: { " << "top: " << tile->bounds.top << ", left: " << tile->bounds.left
      << ", right: " << tile->bounds.right << ", bottom: " << tile->bounds.bottom << " }"
      << std::endl;
  oss << "  chnnelInterleave: " << arrayToString(tile->channelInterleave) << std::endl;
  oss << "  rowBytes: " << tile->rowBytes << std::endl;
  oss << "  colBytes: " << tile->colBytes << std::endl;
  oss << "  planeBytes: " << tile->planeBytes << std::endl;
  oss << std::endl;

  csl(oss.str().c_str());
}

void dbg_printPixels(
    ai::uint8* pixelData,
    ai::uint32 totalPixels,
    ai::uint32 pixelStride
) {
  std::cout << "Current Pixel Values (first 200 pixels):" << std::endl;
  for (ai::uint32 i = 0;
       i < std::min(static_cast<ai::uint32>(200), totalPixels) * pixelStride;
       i += pixelStride) {
    if (i + 3 >= totalPixels * pixelStride) break;

    ai::uint8* pixel = pixelData + i;
    std::cout << "[" << static_cast<int>(pixel[0]) << "," << static_cast<int>(pixel[1])
              << "," << static_cast<int>(pixel[2]) << "," << static_cast<int>(pixel[3])
              << "] ";

    if ((i / pixelStride + 1) % 10 == 0) std::cout << std::endl;
  }
  std::cout << std::endl;
}

void dbg_printRasterizeSettings(const AIRasterizeSettings& settings) {
  // Convert type to string
  std::string typeStr;
  switch (settings.type) {
    case kRasterizeRGB:
      typeStr = "RGB (no alpha)";
      break;
    case kRasterizeCMYK:
      typeStr = "CMYK (no alpha)";
      break;
    case kRasterizeGrayscale:
      typeStr = "Grayscale (no alpha)";
      break;
    case kRasterizeBitmap:
      typeStr = "Opaque Bitmap";
      break;
    case kRasterizeARGB:
      typeStr = "RGB (with alpha)";
      break;
    case kRasterizeACMYK:
      typeStr = "CMYK (with alpha)";
      break;
    case kRasterizeAGrayscale:
      typeStr = "Grayscale (with alpha)";
      break;
    case kRasterizeABitmap:
      typeStr = "Bitmap (transparent 0-pixels)";
      break;
    case kRasterizeSeparation:
      typeStr = "Separation (no alpha)";
      break;
    case kRasterizeASeparation:
      typeStr = "Separation (with alpha)";
      break;
    case kRasterizeNChannel:
      typeStr = "NChannel (no alpha)";
      break;
    case kRasterizeANChannel:
      typeStr = "NChannel (with alpha)";
      break;
    default:
      typeStr = "Unknown";
      break;
  }

  // Convert options to string
  std::string optionsStr;
  if (settings.options == kRasterizeOptionsNone) {
    optionsStr = "None";
  } else {
    if (settings.options & kRasterizeOptionsDoLayers) optionsStr += "DoLayers|";
    if (settings.options & kRasterizeOptionsAgainstBlack) optionsStr += "AgainstBlack|";
    if (settings.options & kRasterizeOptionsDontAlign) optionsStr += "DontAlign|";
    if (settings.options & kRasterizeOptionsOutlineText) optionsStr += "OutlineText|";
    if (settings.options & kRasterizeOptionsHinted) optionsStr += "Hinted|";
    if (settings.options & kRasterizeOptionsUseEffectsRes) optionsStr += "UseEffectsRes|";
    if (settings.options & kRasterizeOptionsUseMinTiles) optionsStr += "UseMinTiles|";
    if (settings.options & kRasterizeOptionsCMYKWhiteMatting)
      optionsStr += "CMYKWhiteMatting|";
    if (settings.options & kRasterizeOptionsSpotColorRasterOk)
      optionsStr += "SpotColorRasterOk|";
    if (settings.options & kRasterizeOptionsNChannelOk) optionsStr += "NChannelOk|";
    if (settings.options & kFillBlackAndIgnoreTransparancy)
      optionsStr += "FillBlackAndIgnoreTransparency|";
    if (settings.options & kRaterizeSharedSpace) optionsStr += "RasterizeSharedSpace|";
    if (!optionsStr.empty()) {
      optionsStr.pop_back();  // Remove trailing '|'
    }
  }

  std::string convertPurposeStr = "unknown";
  switch (settings.ccoptions.purpose) {
    case AIColorConvertOptions::kDefault:
      convertPurposeStr = "Default";
      break;
    case AIColorConvertOptions::kForPreview:
      convertPurposeStr = "ForPreview";
      break;
    case AIColorConvertOptions::kForExport:
      convertPurposeStr = "ForExport";
      break;
  }

  std::cout << "AIRasterizeSettings:" << std::endl;
  std::cout << "  Type: " << typeStr << " (" << settings.type << ")" << std::endl;
  std::cout << "  Resolution: "
            << (settings.resolution <= 0 ? "Default 72 dpi"
                                         : std::to_string(settings.resolution) + " dpi")
            << std::endl;
  std::cout << "  Antialiasing: " << (settings.antialiasing < 2 ? "Off" : "On") << " ("
            << settings.antialiasing << ")" << std::endl;
  std::cout << "  Options: " << optionsStr << " (" << settings.options << ")"
            << std::endl;
  std::cout << "  Color Conversion Purpose: " << settings.ccoptions.purpose << std::endl;
  std::cout << "  Preserve Spot Colors: " << (settings.preserveSpotColors ? "Yes" : "No")
            << " (" << settings.preserveSpotColors << ")" << std::endl;
  std::cout << std::endl;
}
