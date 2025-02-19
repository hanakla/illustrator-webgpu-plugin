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

//
// Headers
//

@interface WindowController : NSWindowController {
  id<MTLDevice> device;
}
- (instancetype)initWithWindow:(NSWindow *)window;
- (ModalStatusCode)runModal:(json)renderTree
                   onChange:(ImGuiModal::OnChangeCallback)onChange;
- (void)releaseDialog;
@end

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

class ImGuiModalOSX : public ImGuiModal::IModalImpl {
public:
  ImGuiModalOSX() {
    std::cout << "Creating OSX modal!!!" << std::endl;
    NSRect frame = NSMakeRect(0, 0, kMyDialogWidth, kMyDialogHeight);

    // append "| NSWindowStyleMaskResizable" if it needs
    NSWindow *window = this->window =
        [[NSWindow alloc] initWithContentRect:frame
                                    styleMask:NSWindowStyleMaskTitled
                                      backing:NSBackingStoreBuffered
                                        defer:YES];
    window.titlebarAppearsTransparent = true;
  }

  ModalStatusCode runModal(const json &renderTree,
                           ImGuiModal::OnChangeCallback onChange) override {
    std::cout << "runModal" << std::endl;
    ModalStatusCode result = ModalStatusCode::None;

    WindowController *windowController = this->controller =
        [[WindowController alloc] initWithWindow:window];

    result = [windowController runModal:renderTree onChange:onChange];
    [windowController releaseDialog];
    windowController = nullptr;

    return result;
  }

  void updateRenderTree(const json &renderTree) override {
    [this->controller.window.contentView setRenderTree:renderTree];
  }

private:
  ImGuiModal::OnChangeCallback onChangeCallback;
  WindowController *controller;
  NSWindow *window;
};

@implementation WindowController

- (instancetype)initWithWindow:(NSWindow *)window;
{
  [window setTitle:[NSString stringWithUTF8String:kMyDialogTitle]];
  [window setAcceptsMouseMovedEvents:YES];
  [window setOpaque:YES];

  device = MTLCreateSystemDefaultDevice();

  MyImGuiView *imguiview = [[MyImGuiView alloc] initWithFrame:window.frame
                                                       device:device];

  [window setContentView:imguiview];

  // Setup Dear ImGui context
  IMGUI_CHECKVERSION();

  ImGui::CreateContext();
  ImGuiIO &io = ImGui::GetIO();
  (void)io;

  io.ConfigFlags |= ImGuiConfigFlags_NavEnableKeyboard; // Enable
  // Keyboard Controls
  io.Fonts->AddFontDefault();

  // Setup Dear ImGui style
  ImGui::StyleColorsDark();
  ImGuiStyle *style = &ImGui::GetStyle();
  // background color of input fields
  style->Colors[ImGuiCol_FrameBg] = ImVec4(0.5f, 0.5f, 0.5f, 0.5f);

  // Setup Platform/Renderer bindings
  ImGui_ImplOSX_Init(imguiview);
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

  return [super initWithWindow:window];
}

- (ModalStatusCode)runModal:(json)renderNodes
                   onChange:(ImGuiModal::OnChangeCallback)callbackFunc {

  std::cout << "runModal: " << renderNodes.dump() << std::endl;

  ModalStatusCode result = ModalStatusCode::None;
  //    [self.window.contentView setParms:parms];
  [self.window.contentView setOnChange:callbackFunc];

  NSModalSession session = [[NSApplication sharedApplication]
      beginModalSessionForWindow:self.window];

  callbackFunc(json::object());

  [self.window.contentView setRenderTree:renderNodes];

  std::cout << "tree: " << std::endl << renderNodes.dump(2) << std::endl;
  while ([self.window isVisible]) {
    if ([NSApp runModalSession:session] != NSModalResponseContinue)
      break;

    [self.window.contentView updateAndDrawView];

    result = [self.window.contentView getStatusCode];

    if (result != ModalStatusCode::None)
      break;
  }
  [NSApp endModalSession:session];

  if (result != ModalStatusCode::None)
    [self.window performClose:nil];

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
    windowFlags = ImGuiWindowFlags_NoTitleBar | ImGuiWindowFlags_NoCollapse;
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
  ImGuiIO &io = ImGui::GetIO();
  io.DisplaySize.x = self.bounds.size.width;
  io.DisplaySize.y = self.bounds.size.height;

  CGFloat framebufferScale = self.window.screen.backingScaleFactor
                                 ?: NSScreen.mainScreen.backingScaleFactor;

  io.DisplayFramebufferScale = ImVec2(framebufferScale, framebufferScale);

  id<MTLCommandBuffer> commandBuffer = [self.commandQueue commandBuffer];

  MTLRenderPassDescriptor *renderPassDescriptor =
      self.currentRenderPassDescriptor;
  if (renderPassDescriptor == nil) {
    [commandBuffer commit];
    return;
  }

  // Start the Dear ImGui frame
  ImGui_ImplMetal_NewFrame(renderPassDescriptor);
  ImGui_ImplOSX_NewFrame(self);
  ImGui::NewFrame();

  //  static bool show_preview = true;
  static ImVec4 clear_color = ImVec4(0.25f, 0.25f, 0.25f, 1.0f);

  {
    ImGui::SetNextWindowPos(ImVec2(0, 0), 0, ImVec2(0, 0));

    static bool is_open = true;
    ImGui::Begin("polygon specs", &is_open, windowFlags);

    std::function<void(json)> renderNode = [&](json node) -> void {
      if (!node.contains("type"))
        return;

      std::string type = node["type"].template get<std::string>();

      if (type == "group") {

        ImGui::BeginGroup();
        for (json &xx : node["children"]) {
          renderNode(xx);
        }
        ImGui::EndGroup();

      } else if (type == "text") {

        std::string textString = node["text"].template get<std::string>();
        const char *text = textString.c_str();
        ImGui::Text("%s", text);

      } else if (type == "textInput") {
        std::string keyStr = node["key"].template get<std::string>();
        const char *key = keyStr.c_str();
        std::string value = node["value"].template get<std::string>();

        ImGui::InputText(key, &value, ImGuiInputTextFlags_None);
      } else if (type == "slider") {

        std::string dataType = node["dataType"].template get<std::string>();
        std::string label = node["label"].template get<std::string>();
        int min = node["min"].template get<int>();
        int max = node["max"].template get<int>();
        int value = node["value"].template get<int>();

        if (dataType == "int") {
          if (ImGui::SliderInt(label.c_str(), &value, min, max)) {
            onChangeCallback(
                json::object({{node["key"].get<std::string>(), value}}));
          }
        } else if (dataType == "float") {
          float fvalue = value;
          if (ImGui::SliderFloat(label.c_str(), &fvalue, min, max)) {
            value = fvalue;
            onChangeCallback(
                json::object({{node["key"].get<std::string>(), value}}));
          }
        }
      }
    };

    renderNode(self->currentRenderTree);

    ImGui::Spacing();
    if (ImGui::Button("Cancel")) {
      resultStatus = ModalStatusCode::Cancel;
    }
    ImGui::SameLine();
    if (ImGui::Button("  OK  ")) {
      resultStatus = ModalStatusCode::OK;
    }

    ImGui::End();
  }

  // Rendering
  ImGui::Render();

  ImDrawData *draw_data = ImGui::GetDrawData();

  renderPassDescriptor.colorAttachments[0].clearColor = MTLClearColorMake(
      clear_color.x * clear_color.w, clear_color.y * clear_color.w,
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
