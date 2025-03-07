#pragma once
#ifndef IMGUI_RENDER_COMPONENTS_H
#define IMGUI_RENDER_COMPONENTS_H

#include <functional>
#include <iostream>
#include <string>

#include "../../deps/imgui/imgui.h"
#include "../../deps/imgui/misc/cpp/imgui_stdlib.h"
#include "json.hpp"
using json = nlohmann::json;

#include "../consts.h"
#include "ImgUiEditModal.h"

namespace {
  enum class ButtonKind {
    Default,
    Primary,
    // Secondary,
    // Danger,
  };

  struct ButtonProps {
    ImVec2     size = ImVec2(0, 0);
    ButtonKind kind = ButtonKind::Default;
  };

  class StyleStack {
   public:
    void pushColor(ImGuiCol color, const ImVec4& value) {
      ImGui::PushStyleColor(color, value);
      pushedColor++;
    }

    void pushVar(ImGuiStyleVar var, float value) {
      ImGui::PushStyleVar(var, value);
      pushedVars++;
    }

    void pushVar(ImGuiStyleVar var, const ImVec2& value) {
      ImGui::PushStyleVar(var, value);
      pushedVars++;
    }

    void clear() {
      ImGui::PopStyleColor(pushedColor);
      ImGui::PopStyleVar(pushedVars);

      pushedVars  = 0;
      pushedColor = 0;
    }

   private:
    int pushedVars  = 0;
    int pushedColor = 0;
  };

  std::tuple<const char**, size_t> parseSelectOptions(const json& j) {
    std::vector<std::string> stringVec = j.get<std::vector<std::string>>();
    size_t                   size      = stringVec.size();

    const char** result = new const char*[size];
    for (size_t i = 0; i < size; i++) {
      result[i] = strdup(stringVec[i].c_str());
    }

    return {result, size};
  }

  void freeSelectOptions(const char** options, size_t size) {
    if (options) {
      for (size_t i = 0; i < size; i++) {
        free((void*)options[i]);  // strdupされた各文字列を解放
      }
      delete[] options;  // 配列自体を解放
    }
  }

  namespace ui {
    StyleStack styleStack = StyleStack();

    bool Button(const char* label, ButtonProps props) {
      styleStack.pushVar(ImGuiStyleVar_FrameRounding, 16.0f);
      styleStack.pushVar(ImGuiStyleVar_FramePadding, ImVec2(1.0f, 4.0f));

      if (props.kind == ButtonKind::Primary) {
        styleStack.pushColor(ImGuiCol_Button, currentTheme.accentColor500);
        styleStack.pushColor(ImGuiCol_ButtonHovered, currentTheme.accentColor600);
        styleStack.pushColor(ImGuiCol_ButtonActive, currentTheme.accentColor700);
        styleStack.pushVar(ImGuiStyleVar_FrameRounding, 16.0f);
      } else if (props.kind == ButtonKind::Default) {
        styleStack.pushVar(ImGuiStyleVar_FrameBorderSize, 2.0f);
        styleStack.pushColor(ImGuiCol_Button, ImVec4(0.0f, 0.0f, 0.0f, 0.0f));
        styleStack.pushColor(ImGuiCol_ButtonHovered, currentTheme.gray800);
        styleStack.pushColor(ImGuiCol_ButtonActive, currentTheme.gray700);
      }

      bool result = ImGui::Button(label, props.size);
      styleStack.clear();

      return result;
    }
  }  // namespace ui
}  // namespace

ModalStatusCode AiDenoImGuiRenderComponents(
    json&                        renderTree,
    ImGuiWindowFlags             windowFlags,
    ImGuiModal::OnChangeCallback onChangeCallback
);

#endif
