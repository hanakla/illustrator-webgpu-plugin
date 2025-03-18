#pragma once

#include <string>
#include "./spectrum-tokens.hpp"
#include "./structs.h"

#define AI_DENO_DEBUG 1
#define kPluginName "dinostrator"

const std::string EFFECT_PREFIX = "la.hanak.illustrator-deno.";

const std::string AI_DENO_DICT_EFFECT_NAME = "AiDeno.effectId";
const std::string AI_DENO_DICT_PARAMS      = "AiDeno.params";

const std::string AI_DENO_PREF_PREFIX          = "la.hanak.illustrator-deno.pref";
const std::string AI_DENO_PREF_WINDOW_POSITION = ".window-position";

const PluginParams defaultPluginParams = PluginParams{
    .effectName = "__FAILED_TO_GET_EFFECT_NAME__",
    .params     = json(),
};

static const SpectrumTokens currentTheme = spectrumDark;
