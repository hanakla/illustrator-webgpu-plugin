#pragma once

#include "../../deps/imgui/imgui.h"

static const float kMyDialogWidth = 350.0f;

#ifdef __APPLE__
static const float kMyDialogHeight = 220.0f;
#else
static const float kMyDialogHeight = 200.0f;
#endif

static const char* kMyDialogTitle = "Deno Effect";

#define IMGUI_IMPL_METAL_CPP
