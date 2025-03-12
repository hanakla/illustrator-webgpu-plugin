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
    const char* id   = (std::string("##") + node["nodeId"].get<std::string>()).c_str();

    std::optional<std::string> key = node["key"];

    if (type == "group") {
      std::string direction = node["direction"].get<std::string>();

      ImGui::BeginGroup();
      for (json& xx : node["children"]) {
        renderNode(xx);
        if (direction == "row") ImGui::SameLine();
      }
      ImGui::EndGroup();

    } else if (type == "text") {
      std::string text = node["text"];

      ImGui::Text("%s", text.c_str());

    } else if (type == "button") {
      std::string label = node["text"];

      ui::styleStack.pushVar(ImGuiStyleVar_FrameRounding, 16.0f);
      ui::styleStack.pushVar(ImGuiStyleVar_FramePadding, ImVec2(8.0f, 4.0f));
      if (ImGui::Button(label.c_str())) {
        onFireEventCallback(ImGuiModal::EventCallbackPayload{
            .type   = "click",
            .nodeId = node["nodeId"],
        });
      }
      ui::styleStack.clear();

    } else if (type == "textInput") {
      std::string value = node["value"].get<std::string>();

      if (ImGui::InputText(id, &value, ImGuiInputTextFlags_None)) {
        if (key) { onChangeCallback(json::object({{key, value}})); }

        onFireEventCallback(ImGuiModal::EventCallbackPayload{
            .type   = "change",
            .nodeId = node["nodeId"],
            .value  = value,
        });
      }

    } else if (type == "numberInput") {
      std::string dataType = node["dataType"];

      if (dataType == "int") {
        std::optional<int> min   = node["min"];
        std::optional<int> max   = node["max"];
        int                step  = node["step"].is_null() ? 1 : node["step"].get<int>();
        int                value = node["value"].get<int>();

        if (ImGui::InputInt(id, &value, step, 10, ImGuiInputTextFlags_CharsNoBlank)) {
          if (min.has_value() && value < min.value()) value = min.value();
          if (max.has_value() && value > max.value()) value = max.value();
          if (key) { onChangeCallback(json::object({{key, value}})); }
          onFireEventCallback(ImGuiModal::EventCallbackPayload{
              .type   = "change",
              .nodeId = node["nodeId"],
              .value  = value,
          });
        }
      } else if (dataType == "float") {
        std::optional<float> min = node["min"];
        std::optional<float> max = node["max"];
        float step  = node["step"].is_null() ? 0.1f : node["step"].get<float>();
        float value = node["value"].get<float>();

        if (ImGui::InputFloat(
                id, &value, step, 1.0f, "%.2f", ImGuiInputTextFlags_CharsNoBlank
            )) {
          if (min.has_value() && value < min.value()) value = min.value();
          if (max.has_value() && value > max.value()) value = max.value();
          if (key) { onChangeCallback(json::object({{key, value}})); }
          onFireEventCallback(ImGuiModal::EventCallbackPayload{
              .type   = "change",
              .nodeId = node["nodeId"],
              .value  = value,
          });
        }
      }
    } else if (type == "colorInput") {
      std::string popupId  = std::string(id) + "-color_picker_popup";
      json        rawValue = node["value"];

      float channels[4] = {
          rawValue["r"].get<float>(), rawValue["g"].get<float>(),
          rawValue["b"].get<float>(), rawValue["a"].get<float>()
      };

      ImVec4 colorVec = ImVec4(channels[0], channels[1], channels[2], channels[3]);

      if (ImGui::ColorButton(id, colorVec)) { ImGui::OpenPopup(popupId.c_str()); }

      // ポップアップカラーピッカー
      if (ImGui::BeginPopup(popupId.c_str())) {
        if (ImGui::ColorPicker4(
                (std::string(id) + "-colorpicker").c_str(), channels,
                ImGuiColorEditFlags_InputRGB | ImGuiColorEditFlags_Float |
                    ImGuiColorEditFlags_DisplayRGB | ImGuiColorEditFlags_DisplayHSV
            )) {
          json jsonValue = json({
              {"r", channels[0]},
              {"g", channels[1]},
              {"b", channels[2]},
              {"a", channels[3]},
          });

          if (key) {
            onChangeCallback(json({
                {key, jsonValue},
            }));
          }

          onFireEventCallback(ImGuiModal::EventCallbackPayload{
              .type   = "change",
              .nodeId = node["nodeId"],
              .value  = jsonValue,
          });
        }

        ImGui::EndPopup();
      }

    } else if (type == "checkbox") {
      std::string label = node["label"].get<std::string>();
      bool        value = node["value"].get<bool>();

      if (ImGui::Checkbox(label.c_str(), &value)) {
        if (key) { onChangeCallback(json({{key, value}})); }

        onFireEventCallback(ImGuiModal::EventCallbackPayload{
            .type   = "change",
            .nodeId = node["nodeId"],
            .value  = value,
        });
      }

    } else if (type == "slider") {
      std::string dataType = node["dataType"].get<std::string>();

      if (dataType == "int") {
        int min   = node["min"];
        int max   = node["max"];
        int value = node["value"];

        if (ImGui::SliderInt(id, &value, min, max)) {
          if (key) { onChangeCallback(json({{key, value}})); }
          onFireEventCallback(ImGuiModal::EventCallbackPayload{
              .type   = "change",
              .nodeId = node["nodeId"],
              .value  = value,
          });
        }
      } else if (dataType == "float") {
        float min   = node["min"];
        float max   = node["max"];
        float value = node["value"];

        if (ImGui::SliderFloat(id, &value, min, max)) {
          if (key) { onChangeCallback(json({{key, value}})); }
          onFireEventCallback(ImGuiModal::EventCallbackPayload{
              .type   = "change",
              .nodeId = node["nodeId"],
              .value  = value,
          });
        }
      }

    } else if (type == "select") {
      int selectedIndex            = node["selectedIndex"].get<int>();
      auto [labels, values, count] = parseSelectOptions(node["options"]);

      if (ImGui::Combo(id, &selectedIndex, labels, count, -1)) {
        if (key) { onChangeCallback(json({{key, values[selectedIndex]}})); }

        onFireEventCallback(ImGuiModal::EventCallbackPayload{
            .type   = "change",
            .nodeId = node["nodeId"],
            .value  = values[selectedIndex],
        });
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
    ImVec2 max  = ImGui::GetWindowContentRegionMax();
    ImVec2 min  = ImGui::GetWindowContentRegionMin();
    ImVec2 size = ImVec2(max.x - min.x, max.y - min.y);
    // ImVec2 size = ImGui::GetWindowSize();

    *currentSize = size;
  }

  ui::keyStack.reset();
  ImGui::End();

  return resultStatus;
}
