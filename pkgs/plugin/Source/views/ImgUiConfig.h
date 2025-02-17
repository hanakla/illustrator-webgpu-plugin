#pragma once

static const float kMyDialogWidth = 300.0f;

#ifdef __APPLE__
static const float kMyDialogHeight = 170.0f;
#else
static const float kMyDialogHeight = 200.0f;
#endif

static const char* kMyDialogTitle = "Deno Effect";

#define IMGUI_IMPL_METAL_CPP
