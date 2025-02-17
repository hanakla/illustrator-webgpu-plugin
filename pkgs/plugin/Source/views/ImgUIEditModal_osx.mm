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

#include "json.hpp"
using json = nlohmann::json;

#include "ImgUiConfig.h"

//
// Headers
//

@interface ModalEntryObj : NSObject
+ (int)runModal:(json)parms completion:(std::function<void(void)>)callbackFunc;
@end

@interface WindowController : NSWindowController {
  id<MTLDevice> device;
}
- (instancetype)initWithWindow:(NSWindow *)window;
- (int)runModal:(json)params completion:(std::function<void(void)>)callbackFunc;
- (void)releaseDialog;
@end

@interface MyImGuiView : MTKView {
  json tree;
  int m_result;
  ImGuiWindowFlags m_flag;
  std::function<void(void)> m_callbackFunc;
}
// @property(nonatomic, strong) id<MTLDevice> device;
@property(nonatomic, strong) id<MTLCommandQueue> commandQueue;

- (instancetype)initWithFrame:(NSRect)frameRect device:(id<MTLDevice>)device;

- (void)setRenderTree:(json)tree;
- (void)setCallback:(std::function<void(void)>)callbackFunc;
- (int)getResult;
- (void)updateAndDrawView;
@end

//
// Imples
//

@implementation ModalEntryObj
+ (int)runModal:(json)nodes completion:(std::function<void(void)>)callbackFunc {
  int result = 0;

  NSRect frame = NSMakeRect(0, 0, kMyDialogWidth, kMyDialogHeight);

  // append "| NSWindowStyleMaskResizable" if it needs
  NSWindow *window =
      [[NSWindow alloc] initWithContentRect:frame
                                  styleMask:NSWindowStyleMaskTitled
                                    backing:NSBackingStoreBuffered
                                      defer:YES];
  window.titlebarAppearsTransparent = true;

  WindowController *windowController =
      [[WindowController alloc] initWithWindow:window];

  if (windowController) {
    result = [windowController runModal:nodes completion:callbackFunc];
    [windowController releaseDialog];
    windowController = nil;
  }

  return result;
}
@end

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

- (int)runModal:(json)renderNodes
     completion:(std::function<void(void)>)callbackFunc {
  int result = 0;
  //    [self.window.contentView setParms:parms];
  [self.window.contentView setCallback:callbackFunc];

  NSModalSession session = [[NSApplication sharedApplication]
      beginModalSessionForWindow:self.window];

  callbackFunc();

  std::cout << "setRenderTree" << std::endl;
  [self.window.contentView setRenderTree:renderNodes];

  std::cout << "start loop" << std::endl;
  while ([self.window isVisible]) {
    if ([NSApp runModalSession:session] != NSModalResponseContinue)
      break;
    [self.window.contentView updateAndDrawView];

    result = [self.window.contentView getResult];

    if (result != 0)
      break;
  }
  [NSApp endModalSession:session];

  if (result != 0)
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
    m_result = 0;
    m_flag = ImGuiWindowFlags_None;
  }

  return self;
}

- (void)setRenderTree:(json)tree {
  std::cout << tree.dump() << std::endl;
  self->tree = tree;
}

- (void)setCallback:(std::function<void(void)>)callbackFunc {
  m_callbackFunc = callbackFunc;
}

- (int)getResult {
  return m_result;
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
    ImGui::Begin("polygon specs", &is_open, m_flag);

    std::function<void(json)> renderNode = [&](json node) -> void {
      if (!node.contains("type")) return;

      std::string type = tree["type"].get<std::string>();

      if (type == "group") {
        ImGui::BeginGroup();
        for (json &xx : tree["children"]) {
          renderNode(xx);
        }
        ImGui::EndGroup();
      } else if (type == "text") {
        ImGui::Text("%s", node["text"].get<std::string>().c_str());
      } else if (type == "textInput") {
        std::string keyStr = node["key"].get<std::string>();
        const char *key = keyStr.c_str();
        std::string value = node["value"].get<std::string>();

        ImGui::InputText(key, &value);
      }
    };

    renderNode(self->tree);

    ImGui::Spacing();
    if (ImGui::Button("Cancel")) {
      m_result = 1;
    }
    ImGui::SameLine();
    if (ImGui::Button("  OK  ")) {
      m_result = 2;
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
  [[self openGLContext] update];
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
