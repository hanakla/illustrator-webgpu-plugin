#pragma once

#include "../../deps/imgui/imgui.h"
#include "../consts.h"
#include "../spectrum-tokens.hpp"
#include "./ImGuiTheme.h"

void ImGuiSetSpectrumTheme() {
  SpectrumTokens tokens = currentTheme;
  ImGuiStyle&    style  = ImGui::GetStyle();
  ImVec4*        colors = style.Colors;

  colors[ImGuiCol_Text]         = tokens.gray900;
  colors[ImGuiCol_TextDisabled] = tokens.gray600;
  // colors[ImGuiCol_WindowBg]             = tokens.backgroundBaseColor;
  // colors[ImGuiCol_ChildBg]              = tokens.backgroundLayer1Color;
  // colors[ImGuiCol_PopupBg]              = tokens.backgroundLayer2Color;
  // colors[ImGuiCol_Border]               = tokens.colorAreaBorderColor;
  // colors[ImGuiCol_BorderShadow]         = ImVec4(0.00f, 0.00f, 0.00f, 0.00f);
  colors[ImGuiCol_FrameBg]        = tokens.gray50;
  colors[ImGuiCol_FrameBgHovered] = tokens.gray50;
  colors[ImGuiCol_FrameBgActive]  = tokens.gray50;
  // colors[ImGuiCol_TitleBg]              = tokens.backgroundLayer1Color;
  // colors[ImGuiCol_TitleBgActive]        = tokens.backgroundLayer2Color;
  // colors[ImGuiCol_MenuBarBg]            = tokens.backgroundLayer1Color;
  // colors[ImGuiCol_ScrollbarBg]          = tokens.backgroundLayer1Color;
  // colors[ImGuiCol_ScrollbarGrab]        = tokens.accentColor500;
  // colors[ImGuiCol_ScrollbarGrabHovered] = tokens.accentColor600;
  // colors[ImGuiCol_ScrollbarGrabActive]  = tokens.accentColor700;
  // colors[ImGuiCol_Button]               = tokens.accentColor500;
  // colors[ImGuiCol_ButtonHovered]        = tokens.accentColor600;
  // colors[ImGuiCol_ButtonActive]         = tokens.accentColor700;
  // colors[ImGuiCol_Header]               = tokens.accentColor500;
  // colors[ImGuiCol_HeaderHovered]        = tokens.accentColor600;
  // colors[ImGuiCol_HeaderActive]         = tokens.accentColor700;
  // colors[ImGuiCol_Separator]            = tokens.colorAreaBorderColor;
  // colors[ImGuiCol_SeparatorHovered]     = tokens.accentColor600;
  // colors[ImGuiCol_SeparatorActive]      = tokens.accentColor700;
  // colors[ImGuiCol_CheckMark]            = tokens.accentColor500;
  // colors[ImGuiCol_SliderGrab]           = tokens.accentColor500;
  // colors[ImGuiCol_SliderGrabActive]     = tokens.accentColor700;
  // colors[ImGuiCol_TextSelectedBg]       = tokens.accentColor600;

  // 他のカスタム設定（サイズなど）
  style.WindowPadding =
      ImVec2(kMyDialogPadding, kMyDialogPadding);  // ウィンドウのパディング
  style.FramePadding   = ImVec2(5, 5);             // フレームのパディング
  style.ItemSpacing    = ImVec2(12, 8);            // アイテム間のスペース
  style.ScrollbarSize  = 12.0f;                    // スクロールバーのサイズ
  style.GrabMinSize    = 10.0f;                    // グラブサイズ
  style.WindowRounding = 4.0f;                     // ウィンドウの角丸
  style.FrameRounding  = 4.0f;                     // フレームの角丸
  style.GrabRounding   = 4.0f;                     // グラブの角丸
  style.PopupRounding  = 4.0f;                     // ポップアップの角丸
}
