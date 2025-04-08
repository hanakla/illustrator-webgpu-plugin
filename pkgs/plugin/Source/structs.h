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
  std::optional<AIPoint> windowPosition = std::nullopt;
};

enum ModalStatusCode { None = 0, Cancel = 1, OK = 2 };
