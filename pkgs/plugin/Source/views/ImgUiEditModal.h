#pragma once
#ifndef IMGUI_EDIT_MODAL_H
#define IMGUI_EDIT_MODAL_H

#include <functional>
#include <iostream>
#include "ImgUiConfig.h"

#ifndef __APPLE__
#include "Windows.h"
#else
#include <AppKit/AppKit.h>
#include <AppKit/NSWindowController.h>
#include <Cocoa/Cocoa.h>
#include <Foundation/Foundation.h>
#endif

#include "../consts.h"
#include "json.hpp"

using json = nlohmann::json;

namespace ImGuiModal {
  typedef std::function<void(json)> OnChangeCallback;
  typedef std::function<void(json)> OnFireEventCallback;

  struct EventCallbackPayload {
    std::string         type;
    std::string         nodeId;
    std::optional<json> value = std::nullopt;

    NLOHMANN_DEFINE_TYPE_INTRUSIVE(EventCallbackPayload, type, nodeId)
  };

  class IModalImpl {
   public:
    virtual ModalStatusCode runModal(
        const json&           renderTree,
        std::tuple<int, int>* lastPosition,
        OnChangeCallback      onChange,
        OnFireEventCallback   onFireEventCallback
    ) = 0;

    virtual void updateRenderTree(const json& renderTree) = 0;
  };

#ifdef __APPLE__
  IModalImpl* createModal();
#else
  // hwnd : ダイアログの親ウィンドウのハンドル。
  // イラレSDKでメインウィンドウのHWNDを取得する処理は以下。
  // AIWindowRef hwnd;
  // error = sAIAppContext->GetPlatformAppWindow(&hwnd);
  IModalImpl* createModal(HWND hwnd);
#endif

  std::string getSystemFontPath();

#ifdef _WIN32
//   std::string getSystemFontPath() {
//     // Windows
//     char windir[MAX_PATH];
//     GetWindowsDirectoryA(windir, MAX_PATH);
//     return std::string(windir) + "\\Fonts\\msgothic.ttc";  // MS Gothic
//   }
#elif defined(__APPLE__)
#endif
};  // namespace ImGuiModal

#endif
