#pragma once

#include <functional>
#include "ImgUiConfig.h"

#ifndef __APPLE__
#include "Windows.h"
#else
#endif

#include "json.hpp"

using json = nlohmann::json;

namespace ImgUiEditModal
{
#ifdef __APPLE__
    int runModal(json tree, std::function<void(void)> callbackFunc);
#else
    // hwnd : ダイアログの親ウィンドウのハンドル。
    // イラレSDKでメインウィンドウのHWNDを取得する処理は以下。
    // AIWindowRef hwnd;
    // error = sAIAppContext->GetPlatformAppWindow(&hwnd);
    int runModal(HWND hwnd, json tree, std::function<void(void)> callbackFunc);
#endif
};
