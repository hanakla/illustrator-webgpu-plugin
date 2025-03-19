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
  ImGuiModal::OnFireEventCallback onFireEventCallback;
  bool isFirstSized;
}
@property(nonatomic, strong) id<MTLCommandQueue> commandQueue;

- (instancetype)initWithFrame:(NSRect)frameRect device:(id<MTLDevice>)device;
- (void)setRenderTree:(json)renderTree;
- (void)setOnChange:(ImGuiModal::OnChangeCallback)onChange;
- (void)setOnFireEventCallback:(ImGuiModal::OnFireEventCallback)onFireEvent;
- (ModalStatusCode)getStatusCode;
- (void)updateAndDrawView;
@end

@interface WindowController : NSWindowController {
  id<MTLDevice> device;
  MyImGuiView* imGuiView;
}
- (instancetype)initWithWindow:(NSWindow*)window;
- (void)updateRenderTree:(json)renderTree;
- (ModalStatusCode)runModal:(json)renderTree
    lastPosition:(std::tuple<int, int>*)lastPosition
    onChange:(ImGuiModal::OnChangeCallback)onChange
    onFireEvent:(ImGuiModal::OnFireEventCallback)onFireEventCallback;
- (void)restoreWindowPosition:(NSWindow *)window pos:(std::tuple<int, int>)pos;
- (void)releaseDialog;
@end

//
// Implementations
//
class ImGuiModalOSX : public ImGuiModal::IModalImpl {
 public:
  ImGuiModalOSX() {
    NSRect frame = NSMakeRect(0, 0, kMyDialogWidth + kMyDialogPadding * 2, kMyDialogHeight + kMyDialogPadding * 2);

    // append "| NSWindowStyleMaskResizable" if it needs
    NSWindow* window = this->window = [[NSWindow alloc] initWithContentRect:frame
                                                                  styleMask:NSWindowStyleMaskTitled |
                                                                            NSWindowStyleMaskClosable |
                                                                            NSWindowStyleMaskResizable
                                                                    backing:NSBackingStoreBuffered
                                                                      defer:YES];
    // window.titlebarAppearsTransparent = true;
    window.titleVisibility = NSWindowTitleHidden;

    NSSize frameDifference = NSMakeSize(
      window.frame.size.width - window.contentLayoutRect.size.width,
      window.frame.size.height - window.contentLayoutRect.size.height
    );

    // std::cout << "frameDifference: " << frameDifference.width << ", " << frameDifference.height << std::endl;
    // std::cout << "window.frame.size: " << window.frame.size.width << ", " << window.frame.size.height << std::endl;
    // std::cout << "window.contentLayoutRect.size: " << window.contentLayoutRect.size.width << ", " << window.contentLayoutRect.size.height << std::endl;

    WindowController* windowController = [[WindowController alloc] initWithWindow:window];
    this->controller = windowController;
  }

  ModalStatusCode runModal(
    const json& renderTree,
    std::tuple<int, int>* lastPosition,
    ImGuiModal::OnChangeCallback onChange,
    ImGuiModal::OnFireEventCallback onFireEventCallback
  ) override {
    ModalStatusCode result = ModalStatusCode::None;

    result = [this->controller runModal:renderTree lastPosition:lastPosition onChange:onChange onFireEvent:onFireEventCallback];
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
  ImGuiModal::OnFireEventCallback onFireEventCallback;
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

  io.ConfigInputTextCursorBlink = true;
  io.ConfigFlags |= ImGuiConfigFlags_NavEnableKeyboard;
  io.ConfigMacOSXBehaviors  = true;
  // io.Fonts->AddFontDefault();
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
  //  config.FontNo = 1;
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

- (void) updateRenderTree:(json)renderTree {
  // if (imGuiView == nullptr) return;
  [self->imGuiView setRenderTree:renderTree];
}

- (ModalStatusCode) runModal:(json)renderNodes
  lastPosition:(std::tuple<int, int>*)lastPosition
  onChange:(ImGuiModal::OnChangeCallback)callbackFunc
  onFireEvent:(ImGuiModal::OnFireEventCallback)onFireEventCallback
{
  ModalStatusCode result = ModalStatusCode::None;
  [self.window.contentView setOnChange:callbackFunc];
  [self.window.contentView setOnFireEventCallback:onFireEventCallback];

  NSModalSession session =
      [[NSApplication sharedApplication] beginModalSessionForWindow:self.window];

  [self restoreWindowPosition:lastPosition];
  [self->imGuiView setRenderTree:renderNodes];

  NSTimeInterval lastFrameTime = [NSDate timeIntervalSinceReferenceDate];
  NSTimeInterval targetFrameTime = 1.0/60.0; // 60fps

  while ([self.window isVisible]) {
    if ([NSApp runModalSession:session] != NSModalResponseContinue) break;

    NSTimeInterval currentTime = [NSDate timeIntervalSinceReferenceDate];
    NSTimeInterval elapsedTime = currentTime - lastFrameTime;

    if (elapsedTime >= targetFrameTime) {
      [self.window.contentView updateAndDrawView];
      lastFrameTime = currentTime;
    } else {
      [NSThread sleepForTimeInterval:0.001];
    }


    result = [self.window.contentView getStatusCode];
    if (result != ModalStatusCode::None) break;
  }

  [NSApp endModalSession:session];

  NSPoint pos = [self.window frame].origin;
  *lastPosition = std::make_tuple(static_cast<int>(pos.x), static_cast<int>(pos.y));

  if (result != ModalStatusCode::None) [self.window performClose:nil];

  return result;
}

- (void)restoreWindowPosition:(std::tuple<int, int>*)pos {
     NSScreen *screen = [self.window screen] ?: [NSScreen mainScreen];
     NSRect screenFrame = [screen visibleFrame];

     NSSize windowSize = [self.window frame].size;

     std::tuple<int, int> position = pos == nullptr ? std::make_tuple(
         (int)(NSMidX(screenFrame) - windowSize.width * .5),
         (int)(NSMidY(screenFrame) - windowSize.height * .5)
     ) : *pos;

     auto [x,y] = position;

     NSPoint targetPoint = NSMakePoint(x, y);


     if (targetPoint.x + windowSize.width > NSMaxX(screenFrame)) {
         targetPoint.x = NSMaxX(screenFrame) - windowSize.width;
     }
     if (targetPoint.x < NSMinX(screenFrame)) {
         targetPoint.x = NSMinX(screenFrame);
     }

     if (targetPoint.y + windowSize.height > NSMaxY(screenFrame)) {
         targetPoint.y = NSMaxY(screenFrame) - windowSize.height;
     }
     if (targetPoint.y < NSMinY(screenFrame)) {
         targetPoint.y = NSMinY(screenFrame);
     }

     [self.window setFrameOrigin:targetPoint];
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
    // | ImGuiWindowFlags_NoNav
    | ImGuiWindowFlags_NoSavedSettings
    | ImGuiWindowFlags_AlwaysAutoResize;
    // | ImGuiWindowFlags_NoFocusOnAppearing;

    self->isFirstSized = false;

  return self;
}

- (void)setRenderTree:(json)tree {
  self->currentRenderTree = tree;
}

- (void)setOnChange:(ImGuiModal::OnChangeCallback)callbackFunc {
  onChangeCallback = callbackFunc;
}

- (void)setOnFireEventCallback:(ImGuiModal::OnFireEventCallback)onFireEventCallback {
  self->onFireEventCallback = onFireEventCallback;
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
  ImGui::NewFrame();

  ImVec2 windowSize;
  json toRenderTree = self->currentRenderTree;
  resultStatus = AiDenoImGuiRenderComponents(
    toRenderTree,
    windowFlags,
    onChangeCallback,
    onFireEventCallback,
    &windowSize
  );

  ImGui::Render();

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

  // Update window size based on ImGui content
  if (!self->isFirstSized && ImGui::GetFrameCount() > 1) {
    self->isFirstSized = true;

    NSRect frame = NSMakeRect(0, 0, windowSize.x, windowSize.y);
    [self setFrame:frame];

    NSRect winFrame = NSMakeRect(
      self.window.frame.origin.x,
      self.window.frame.origin.y,
      MAX(windowSize.x, kMyDialogWidth),
      MAX(windowSize.y, kMyDialogWidth)
    );

    [[self window] setFrame:[[self window] frameRectForContentRect:winFrame] display:YES];
  }
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
