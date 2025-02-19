#pragma once

#include <functional>
#include <iostream>
#include "ImgUiConfig.h"

#ifndef __APPLE__
#include "Windows.h"
#else
#include <Foundation/Foundation.h>
#include <AppKit/AppKit.h>
#include <AppKit/NSWindowController.h>
#include <Cocoa/Cocoa.h>
#endif

#include "../consts.h"
#include "json.hpp"

using json = nlohmann::json;

namespace ImGuiModal
{
    typedef std::function<void(json)> OnChangeCallback;

    class IModalImpl
    {
    public:
        virtual ModalStatusCode runModal(const json &renderTree, OnChangeCallback onChange) = 0;
        virtual void updateRenderTree(const json &renderTree) = 0;
    };

#ifdef __APPLE__
    IModalImpl *createModal();
#else
    // hwnd : ダイアログの親ウィンドウのハンドル。
    // イラレSDKでメインウィンドウのHWNDを取得する処理は以下。
    // AIWindowRef hwnd;
    // error = sAIAppContext->GetPlatformAppWindow(&hwnd);
    IModalImpl *createModal(HWND hwnd);
#endif
};
