#pragma once

#include <IllustratorSDK.h>
#include <string>
#include <json.hpp>

using json = nlohmann::json;

struct PluginParams {
  std::string effectName;
  json        params;
};

struct PluginPreferences {
  AIPoint* windowPosition = nullptr;
};

enum ModalStatusCode { None = 0, Cancel = 1, OK = 2 };
