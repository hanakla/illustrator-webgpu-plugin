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
    json&                        renderTree,
    ImGuiWindowFlags             windowFlags,
    ImGuiModal::OnChangeCallback onChangeCallback
    //    ImVec2*                      currentSize
) {
  ModalStatusCode resultStatus = ModalStatusCode::None;

  ImGui::NewFrame();

  {
    ImGui::SetNextWindowPos(ImVec2(0, 0), 0, ImVec2(0, 0));

    static bool is_open = true;
    ImGui::Begin("polygon specs", &is_open, windowFlags);

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

      } else if (type == "textInput") {
        std::string keyStr = node["key"].get<std::string>();
        const char* key    = keyStr.c_str();
        std::string value  = node["value"].get<std::string>();

        ImGui::PushItemWidth(-1);
        if (ImGui::InputText(key, &value, ImGuiInputTextFlags_None)) {
          onChangeCallback(json::object({{node["key"].get<std::string>(), value}}));
        }
        ImGui::PopItemWidth();

      } else if (type == "checkbox") {
        std::string key   = node["key"].get<std::string>();
        std::string label = node["label"].get<std::string>();
        bool        value = node["value"].get<bool>();

        if (ImGui::Checkbox(label.c_str(), &value)) {
          onChangeCallback(json::object({{node["key"].get<std::string>(), value}}));
        }
      } else if (type == "slider") {
        std::string dataType = node["dataType"].get<std::string>();
        std::string label    = node["label"].get<std::string>();
        int         min      = node["min"].get<int>();
        int         max      = node["max"].get<int>();
        int         value    = node["value"].get<int>();

        ImGui::PushItemWidth(-1);
        if (dataType == "int") {
          if (ImGui::SliderInt(label.c_str(), &value, min, max)) {
            onChangeCallback(json::object({{node["key"].get<std::string>(), value}}));
          }
        } else if (dataType == "float") {
          float fvalue = value;
          if (ImGui::SliderFloat(label.c_str(), &fvalue, min, max)) {
            value = fvalue;
            onChangeCallback(json::object({{node["key"].get<std::string>(), value}}));
          }
        }
        ImGui::PopItemWidth();
      } else if (type == "select") {
        std::string label         = node["label"].get<std::string>();
        std::string key           = node["key"].get<std::string>();
        int         selectedIndex = node["selectedIndex"].get<int>();
        auto [items, count]       = parseSelectOptions(node["options"]);

        if (ImGui::Combo(label.c_str(), &selectedIndex, items, count, -1)) {
          onChangeCallback(json::object({{key, items[selectedIndex]}}));
        }

        freeSelectOptions(items, count);
      } else if (type == "separator") {
        ImGui::Separator();
      }
    };

    renderNode(renderTree);

    ImGui::Spacing();

    static ButtonProps cancelBtnProps{.kind = ButtonKind::Default};
    if (ui::Button("Cancel", cancelBtnProps)) { resultStatus = ModalStatusCode::Cancel; }
    ImGui::SameLine();

    static ButtonProps okBtnProps{.kind = ButtonKind::Primary};
    if (ui::Button("  OK  ", okBtnProps)) { resultStatus = ModalStatusCode::OK; }

    //    if (currentSize != nullptr) { *currentSize = ImGui::GetWindowSize(); }

    ImGui::End();
  };

  // Rendering
  ImGui::Render();

  return resultStatus;
}
