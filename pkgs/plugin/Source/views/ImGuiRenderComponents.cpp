#pragma once

#include <functional>
#include <iostream>
#include <string>

#include "../../deps/imgui/imgui.h"
#include "../../deps/imgui/misc/cpp/imgui_stdlib.h"
#include "json.hpp"
using json = nlohmann::json;

#include "../consts.h"
#include "ImgUiEditModal.h"

#include "./ImGuiRenderComponents.h"

ModalStatusCode AiDenoImGuiRenderComponents(
    json&                           renderTree,
    ImGuiWindowFlags                windowFlags,
    ImGuiModal::OnChangeCallback    onChangeCallback,
    ImGuiModal::OnFireEventCallback onFireEventCallback,
    ImVec2*                         currentSize
) {
  ModalStatusCode resultStatus = ModalStatusCode::None;

  std::function<void(json)> renderNode = [&](json node) -> void {
    if (!node.contains("type")) return;

    std::string type = node["type"].get<std::string>();

    if (type == "group") {
      std::string direction = node["direction"].get<std::string>();

      ImGui::BeginGroup();
      for (json& xx : node["children"]) {
        renderNode(xx);
        if (direction == "row") ImGui::SameLine();
      }
      ImGui::EndGroup();

    } else if (type == "text") {
      std::string textString = node["text"].get<std::string>();
      const char* text       = textString.c_str();
      ImGui::Text("%s", text);

    } else if (type == "button") {
      std::string label = node["text"].get<std::string>();

      ui::styleStack.pushVar(ImGuiStyleVar_FrameRounding, 16.0f);
      ui::styleStack.pushVar(ImGuiStyleVar_FramePadding, ImVec2(8.0f, 4.0f));
      if (ImGui::Button(label.c_str())) {
        json payload = ImGuiModal::EventCallbackPayload{
            .type   = "click",
            .nodeId = node["nodeId"].get<std::string>(),
        };

        std::cout << "Firing event: " << payload.dump() << std::endl;

        onFireEventCallback(payload);
      }
      ui::styleStack.clear();

    } else if (type == "textInput") {
      std::string keyStr = node["key"].get<std::string>();
      const char* key    = std::string("###" + keyStr).c_str();
      std::string value  = node["value"].get<std::string>();

      ImGui::PushItemWidth(-1);
      if (ImGui::InputText(key, &value, ImGuiInputTextFlags_None)) {
        onChangeCallback(json::object({{key, value}}));
      }
      ImGui::PopItemWidth();

    } else if (type == "numberInput") {
      std::string key      = node["key"].get<std::string>();
      std::string label    = "###" + node["label"].get<std::string>();
      std::string dataType = node["dataType"].get<std::string>();

      if (dataType == "int") {
        std::optional<int> min   = node["min"].is_null()
                                       ? std::nullopt
                                       : std::optional<int>{node["min"].get<int>()};
        std::optional<int> max   = node["max"].is_null()
                                       ? std::nullopt
                                       : std::optional<int>{node["max"].get<int>()};
        int                step  = node["step"].is_null() ? 1 : node["step"].get<int>();
        int                value = node["value"].get<int>();

        if (ImGui::InputInt(
                label.c_str(), &value, step, 10, ImGuiInputTextFlags_CharsNoBlank
            )) {
          if (min.has_value() && value < min.value()) value = min.value();
          if (max.has_value() && value > max.value()) value = max.value();

          onChangeCallback(json::object({{key, value}}));
        }
      } else if (dataType == "float") {
        std::optional<float> min = node["min"].is_null()
                                       ? std::nullopt
                                       : std::optional<float>{node["min"].get<float>()};
        std::optional<float> max = node["max"].is_null()
                                       ? std::nullopt
                                       : std::optional<float>{node["max"].get<float>()};
        float step  = node["step"].is_null() ? 0.1f : node["step"].get<float>();
        float value = node["value"].get<float>();

        if (ImGui::InputFloat(
                label.c_str(), &value, step, 1.0f, "%.2f",
                ImGuiInputTextFlags_CharsNoBlank
            )) {
          if (min.has_value() && value < min.value()) value = min.value();
          if (max.has_value() && value > max.value()) value = max.value();

          onChangeCallback(json::object({{key, value}}));
        }
      }
    } else if (type == "checkbox") {
      std::string key   = node["key"].get<std::string>();
      std::string label = node["label"].get<std::string>();
      bool        value = node["value"].get<bool>();

      if (ImGui::Checkbox(label.c_str(), &value)) {
        onChangeCallback(json::object({{key, value}}));
      }
    } else if (type == "slider") {
      std::string key      = node["key"].get<std::string>();
      std::string dataType = node["dataType"].get<std::string>();
      std::string label    = "###" + node["label"].get<std::string>();

      if (dataType == "int") {
        int min   = node["min"].get<int>();
        int max   = node["max"].get<int>();
        int value = node["value"].get<int>();

        if (ImGui::SliderInt(label.c_str(), &value, min, max)) {
          onChangeCallback(json::object({{key, value}}));
        }
      } else if (dataType == "float") {
        float min   = node["min"].get<float>();
        float max   = node["max"].get<float>();
        float value = node["value"].get<float>();

        if (ImGui::SliderFloat(label.c_str(), &value, min, max)) {
          onChangeCallback(json::object({{key, value}}));
        }
      }

    } else if (type == "select") {
      std::string label            = "###" + node["label"].get<std::string>();
      std::string key              = node["key"].get<std::string>();
      int         selectedIndex    = node["selectedIndex"].get<int>();
      auto [labels, values, count] = parseSelectOptions(node["options"]);

      if (ImGui::Combo(label.c_str(), &selectedIndex, labels, count, -1)) {
        onChangeCallback(json::object({{key, values[selectedIndex]}}));
      }

      freeSelectOptions(labels, count);
    } else if (type == "separator") {
      ImGui::Separator();
    }
  };

  static bool is_open = true;

  ImGui::SetNextWindowPos(ImVec2(0, 0), 0, ImVec2(0, 0));
  ImGui::Begin("polygon specs", &is_open, windowFlags);

  renderNode(renderTree);

  ImGui::Dummy(ImVec2(0, 8));

  ImGui::Dummy(ImVec2(64, 0));
  ImGui::SameLine();

  static ButtonProps cancelBtnProps{.kind = ButtonKind::Default};
  if (ui::Button("Cancel", cancelBtnProps)) { resultStatus = ModalStatusCode::Cancel; }
  ImGui::SameLine();

  static ButtonProps okBtnProps{.kind = ButtonKind::Primary};
  if (ui::Button("  OK  ", okBtnProps)) { resultStatus = ModalStatusCode::OK; }

  if (currentSize != nullptr) {
    // ImVec2 max  = ImGui::GetWindowContentRegionMax();
    // ImVec2 min  = ImGui::GetWindowContentRegionMin();
    // ImVec2 size = ImVec2(max.x - min.x, max.y - min.y);
    ImVec2 size = ImGui::GetWindowSize();

    *currentSize = size;
  }

  ImGui::End();

  return resultStatus;
}
