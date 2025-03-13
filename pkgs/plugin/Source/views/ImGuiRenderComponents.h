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

  enum class ButtonSize {
    Normal,
    Sm,
  };

  struct ButtonProps {
    // ImVec2     size = ImVec2(0, 0);
    ButtonSize size = ButtonSize::Normal;
    ButtonKind kind = ButtonKind::Default;
  };

  class KeyStack {
   public:
    std::string getAndIncrement() { return std::to_string(++counter); }

    void reset() { counter = 0; }

   private:
    int32_t counter = 0;
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

  std::tuple<const char**, std::vector<std::string>, size_t>
  parseSelectOptions(const json& j) {
    // j =  Array<{ value: string; label: string }>
    size_t size = j.size();

    std::vector<std::string> labelsVec;
    std::vector<std::string> valuesVec;

    for (size_t i = 0; i < size; i++) {
      if (!j[i].contains("value") || !j[i].contains("label")) {
        throw std::runtime_error("Invalid select options");
      }

      valuesVec.push_back(j[i]["value"].get<std::string>());
      labelsVec.push_back(j[i]["label"].get<std::string>());
    }

    const char** labels = new const char*[size];
    for (size_t i = 0; i < size; i++) {
      labels[i] = strdup(labelsVec[i].c_str());
    }

    return {labels, valuesVec, size};
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
    KeyStack   keyStack   = KeyStack();

    bool Button(const char* label, ButtonProps props) {
      styleStack.pushVar(ImGuiStyleVar_FrameRounding, 16.0f);

      if (props.size == ButtonSize::Sm) {
        styleStack.pushVar(ImGuiStyleVar_FramePadding, ImVec2(8.0f, 4.0f));
      } else if (props.size == ButtonSize::Normal) {
        styleStack.pushVar(ImGuiStyleVar_FramePadding, ImVec2(16.0f, 8.0f));
      }

      if (props.kind == ButtonKind::Primary) {
        styleStack.pushColor(ImGuiCol_Button, currentTheme.accentColor500);
        styleStack.pushColor(ImGuiCol_ButtonHovered, currentTheme.accentColor600);
        styleStack.pushColor(ImGuiCol_ButtonActive, currentTheme.accentColor700);
      } else if (props.kind == ButtonKind::Default) {
        styleStack.pushVar(ImGuiStyleVar_FrameBorderSize, .5f);
        styleStack.pushColor(ImGuiCol_Border, currentTheme.gray600);
        styleStack.pushColor(ImGuiCol_Button, ImVec4(0.0f, 0.0f, 0.0f, 0.0f));
        styleStack.pushColor(ImGuiCol_ButtonHovered, currentTheme.gray500);
        styleStack.pushColor(ImGuiCol_ButtonActive, currentTheme.gray600);
      }

      bool result = ImGui::Button(label);
      styleStack.clear();

      return result;
    }
  }  // namespace ui
}  // namespace

ModalStatusCode AiDenoImGuiRenderComponents(
    json& renderTree,
    ImGuiWindowFlags,
    ImGuiModal::OnChangeCallback,
    ImGuiModal::OnFireEventCallback,
    ImVec2* currentSize
);

#endif
