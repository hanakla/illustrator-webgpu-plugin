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

        if (ImGui::InputText(key, &value, ImGuiInputTextFlags_None)) {
          onChangeCallback(json::object({{node["key"].get<std::string>(), value}
          }));
        }
      } else if (type == "slider") {
        std::string dataType = node["dataType"].get<std::string>();
        std::string label    = node["label"].get<std::string>();
        int         min      = node["min"].get<int>();
        int         max      = node["max"].get<int>();
        int         value    = node["value"].get<int>();

        if (dataType == "int") {
          if (ImGui::SliderInt(label.c_str(), &value, min, max)) {
            onChangeCallback(
                json::object({{node["key"].get<std::string>(), value}})
            );
          }
        } else if (dataType == "float") {
          float fvalue = value;
          if (ImGui::SliderFloat(label.c_str(), &fvalue, min, max)) {
            value = fvalue;
            onChangeCallback(
                json::object({{node["key"].get<std::string>(), value}})
            );
          }
        }
      }
    };

    renderNode(renderTree);

    ImGui::Spacing();
    if (ui::Button("Cancel", ButtonProps{.kind = ButtonKind::Default})) {
      resultStatus = ModalStatusCode::Cancel;
    }
    ImGui::SameLine();
    if (ui::Button("  OK  ", ButtonProps{.kind = ButtonKind::Primary})) {
      resultStatus = ModalStatusCode::OK;
    }

    ImGui::End();
  }

  // Rendering
  ImGui::Render();

  return resultStatus;
}
