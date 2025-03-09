#pragma once

#include <AppKit/AppKit.h>
#include <AppKit/NSWindowController.h>
#include <Cocoa/Cocoa.h>
#include <Foundation/Foundation.h>
#include <IOKit/IOKitLib.h>
#include <Metal/Metal.h>
#include <MetalKit/MetalKit.h>
#include <iostream>

#include "../deps/imgui/backends/imgui_impl_metal.h"
#include "../deps/imgui/backends/imgui_impl_osx.h"
#include "../deps/imgui/imgui.h"
#include "../deps/imgui/misc/cpp/imgui_stdlib.h"

#include "./ImgUiEditModal.h"

#include "json.hpp"
using json = nlohmann::json;

#include "../consts.h"
#include "ImgUiConfig.h"
#include "ImGuiTheme.h"
#include "ImgUiRenderComponents.h"

//
// Headers
//
@interface MyImGuiView : MTKView {
  json currentRenderTree;
  ModalStatusCode resultStatus;
  ImGuiWindowFlags windowFlags;
  ImGuiModal::OnChangeCallback onChangeCallback;
}
@property(nonatomic, strong) id<MTLCommandQueue> commandQueue;

- (instancetype)initWithFrame:(NSRect)frameRect device:(id<MTLDevice>)device;

- (void)setRenderTree:(json)renderTree;
- (void)setOnChange:(ImGuiModal::OnChangeCallback)onChange;
- (ModalStatusCode)getStatusCode;
- (void)updateAndDrawView;
@end

@interface WindowController : NSWindowController {
  id<MTLDevice> device;
  MyImGuiView* imGuiView;
}
- (instancetype)initWithWindow:(NSWindow*)window;
- (void)updateRenderTree:(json)renderTree;
- (ModalStatusCode)runModal:(json)renderTree onChange:(ImGuiModal::OnChangeCallback)onChange;
- (void)releaseDialog;
@end

//
// Implementations
//
class ImGuiModalOSX : public ImGuiModal::IModalImpl {
 public:
  ImGuiModalOSX() {
    NSRect frame = NSMakeRect(0, 0, kMyDialogWidth, kMyDialogHeight);

    // append "| NSWindowStyleMaskResizable" if it needs
    NSWindow* window = this->window = [[NSWindow alloc] initWithContentRect:frame
                                                                  styleMask:NSWindowStyleMaskTitled |
                                                                            NSWindowStyleMaskClosable |
                                                                            NSWindowStyleMaskMiniaturizable |
                                                                            NSWindowStyleMaskResizable
                                                                    backing:NSBackingStoreBuffered
                                                                      defer:YES];
    // window.titlebarAppearsTransparent = true;
    window.titleVisibility = NSWindowTitleHidden;

    WindowController* windowController = [[WindowController alloc] initWithWindow:window];
    this->controller = windowController;
  }

  ModalStatusCode runModal(const json& renderTree, ImGuiModal::OnChangeCallback onChange) override {
    ModalStatusCode result = ModalStatusCode::None;

    result = [this->controller runModal:renderTree onChange:onChange];
    [this->controller releaseDialog];
    this->controller = nullptr;

    return result;
  }

  void updateRenderTree(const json& renderTree) override {
    if (this->controller == nullptr) return;
    [this->controller updateRenderTree:renderTree];
  }

 private:
  ImGuiModal::OnChangeCallback onChangeCallback;
  WindowController* controller;
  NSWindow* window;
};

@implementation WindowController

- (instancetype)initWithWindow:(NSWindow*)window;
{
  [window setTitle:[NSString stringWithUTF8String:kMyDialogTitle]];
  [window setAcceptsMouseMovedEvents:YES];
  [window setOpaque:YES];

  device = MTLCreateSystemDefaultDevice();

  MyImGuiView* imGuiView = [[MyImGuiView alloc] initWithFrame:window.frame device:device];
  self->imGuiView = imGuiView;

  [window setContentView:imGuiView];

  // Setup Dear ImGui context
  IMGUI_CHECKVERSION();

  ImGui::CreateContext();
  ImGuiIO& io = ImGui::GetIO();
  io.IniFilename = nullptr; // Disable .ini file

  io.ConfigFlags |= ImGuiConfigFlags_NavEnableKeyboard;  // Enable
//  io.Fonts->AddFontDefault();
  ImGuiSetSpectrumTheme();

  // Setup Platform/Renderer bindings
  ImGui_ImplOSX_Init(imGuiView);
  ImGui_ImplMetal_Init(device);

  // Load Fonts
  // - If no fonts are loaded, dear imgui will use the default font. You can
  // also load multiple fonts and use ImGui::PushFont()/PopFont() to select
  // them.
  // - AddFontFromFileTTF() will return the ImFont* so you can store it if
  // you need to select the font among multiple.
  // - If the file cannot be loaded, the function will return NULL. Please
  // handle those errors in your application (e.g. use an assertion, or
  // display an error and quit).
  // - The fonts will be rasterized at a given size (w/ oversampling) and
  // stored into a texture when calling
  // ImFontAtlas::Build()/GetTexDataAsXXXX(), which ImGui_ImplXXXX_NewFrame
  // below will call.
  // - Read 'docs/FONTS.txt' for more instructions and details.
  // - Remember that in C/C++ if you want to include a backslash \ in a
  // string literal you need to write a double backslash \\ !
  // io.Fonts->AddFontDefault();
  // io.Fonts->AddFontFromFileTTF("../../misc/fonts/Roboto-Medium.ttf", 16.0f);
  // io.Fonts->AddFontFromFileTTF("../../misc/fonts/Cousine-Regular.ttf", 15.0f);
  // io.Fonts->AddFontFromFileTTF("../../misc/fonts/DroidSans.ttf", 16.0f);
  // io.Fonts->AddFontFromFileTTF("../../misc/fonts/ProggyTiny.ttf", 10.0f);
  // ImFont* font =
  // io.Fonts->AddFontFromFileTTF("c:\\Windows\\Fonts\\ArialUni.ttf", 18.0f,
  // NULL, io.Fonts->GetGlyphRangesJapanese()); IM_ASSERT(font != NULL);

  // Setup fonts
  ImFontConfig config;
//    config.FontNo = 1;
  config.MergeMode = false;

  // Specify CJK ranges
  static const ImWchar ranges[] = {
      0x0020, 0x00FF, // 基本ラテン + ラテン補助
      0x3000, 0x30FF, // CJK記号・句読点 + 平仮名・片仮名
      0x31F0, 0x31FF, // 片仮名拡張
      0xFF00, 0xFFEF, // 半角・全角形
      0x4e00, 0x9FAF, // CJK統合漢字
      0,
  };

  std::string fontPath = ImGuiModal::getSystemFontPath();
  ImFont* font = io.Fonts->AddFontFromFileTTF(fontPath.c_str(), 12.0f, &config, io.Fonts->GetGlyphRangesJapanese());
  IM_ASSERT(font != NULL);

  if (io.Fonts->Fonts.Size == 0) {
      io.Fonts->AddFontDefault();
      printf("Failed to load CJK font, using default font instead.\n");
  }

  return [super initWithWindow:window];
}

- (void)updateRenderTree:(json)renderTree {
  // if (imGuiView == nullptr) return;
  std::cout << "updateRenderTree: " << renderTree.dump() << std::endl;
  [self->imGuiView setRenderTree:renderTree];
}

- (ModalStatusCode)runModal:(json)renderNodes onChange:(ImGuiModal::OnChangeCallback)callbackFunc {

  ModalStatusCode result = ModalStatusCode::None;
  //    [self.window.contentView setParms:parms];
  [self.window.contentView setOnChange:callbackFunc];

  NSModalSession session =
      [[NSApplication sharedApplication] beginModalSessionForWindow:self.window];

  [self->imGuiView setRenderTree:renderNodes];

  while ([self.window isVisible]) {
    if ([NSApp runModalSession:session] != NSModalResponseContinue) break;

    [self.window.contentView updateAndDrawView];

    result = [self.window.contentView getStatusCode];

    if (result != ModalStatusCode::None) break;
  }
  [NSApp endModalSession:session];

  if (result != ModalStatusCode::None) [self.window performClose:nil];

  return result;
}

- (void)releaseDialog {
  ImGui_ImplMetal_Shutdown();
  ImGui_ImplOSX_Shutdown();
  ImGui::DestroyContext();
  [self.window close];
}
@end

@implementation MyImGuiView

- (instancetype)initWithFrame:(NSRect)frameRect device:(id<MTLDevice>)device {
  self = [super initWithFrame:frameRect device:device];

  if (self) {
    self.device = device;
    self.commandQueue = [device newCommandQueue];
    resultStatus = ModalStatusCode::None;
    windowFlags =
      ImGuiWindowFlags_NoTitleBar
      | ImGuiWindowFlags_NoResize
      | ImGuiWindowFlags_NoMove
      | ImGuiWindowFlags_NoScrollbar
      | ImGuiWindowFlags_NoScrollWithMouse
      | ImGuiWindowFlags_NoCollapse
      | ImGuiWindowFlags_NoBackground
      | ImGuiWindowFlags_NoBringToFrontOnFocus
      | ImGuiWindowFlags_NoNav
      | ImGuiWindowFlags_NoSavedSettings
      | ImGuiWindowFlags_AlwaysAutoResize
      | ImGuiWindowFlags_NoFocusOnAppearing;
  }

  return self;
}

- (void)setRenderTree:(json)tree {
  self->currentRenderTree = tree;
}

- (void)setOnChange:(ImGuiModal::OnChangeCallback)callbackFunc {
  onChangeCallback = callbackFunc;
}

- (ModalStatusCode)getStatusCode {
  return resultStatus;
}

- (void)updateAndDrawView {
  ImGuiIO& io = ImGui::GetIO();
  io.DisplaySize.x = self.bounds.size.width;
  io.DisplaySize.y = self.bounds.size.height;

  CGFloat framebufferScale =
      self.window.screen.backingScaleFactor ?: NSScreen.mainScreen.backingScaleFactor;

  io.DisplayFramebufferScale = ImVec2(framebufferScale, framebufferScale);

  id<MTLCommandBuffer> commandBuffer = [self.commandQueue commandBuffer];

  MTLRenderPassDescriptor* renderPassDescriptor = self.currentRenderPassDescriptor;
  if (renderPassDescriptor == nil) {
    [commandBuffer commit];
    return;
  }

  // Start the Dear ImGui frame
  ImGui_ImplMetal_NewFrame(renderPassDescriptor);
  ImGui_ImplOSX_NewFrame(self);

//  ImVec2 windowSize;
  resultStatus = AiDenoImGuiRenderComponents(
    self->currentRenderTree,
    windowFlags,
    onChangeCallback
//    &windowSize
  );

//  std::cout << "windowSize: " << windowSize.x << ", " << windowSize.y << std::endl;

  ImDrawData* draw_data = ImGui::GetDrawData();

  //  static bool show_preview = true;
  static ImVec4 clear_color = ImVec4(0.25f, 0.25f, 0.25f, 1.0f);
  renderPassDescriptor.colorAttachments[0].clearColor =
      MTLClearColorMake(clear_color.x * clear_color.w, clear_color.y * clear_color.w,
                        clear_color.z * clear_color.w, clear_color.w);
  id<MTLRenderCommandEncoder> renderEncoder =
      [commandBuffer renderCommandEncoderWithDescriptor:renderPassDescriptor];
  [renderEncoder pushDebugGroup:@"Dear ImGui rendering"];
  ImGui_ImplMetal_RenderDrawData(draw_data, commandBuffer, renderEncoder);
  [renderEncoder popDebugGroup];
  [renderEncoder endEncoding];

  //  Present
  [commandBuffer presentDrawable:self.currentDrawable];
  [commandBuffer commit];
}

- (void)reshape {
  [self updateAndDrawView];
}

- (void)drawRect:(NSRect)bounds {
  [self updateAndDrawView];
}

- (BOOL)acceptsFirstResponder {
  return (YES);
}
- (BOOL)becomeFirstResponder {
  return (YES);
}
- (BOOL)resignFirstResponder {
  return (YES);
}

@end
