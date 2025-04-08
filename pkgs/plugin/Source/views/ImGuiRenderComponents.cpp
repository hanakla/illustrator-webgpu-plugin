#pragma once

#include <climits>
#include <functional>
#include <iostream>
#include <limits>
#include <string>

#include "../../deps/imgui/imgui.h"
#include "../../deps/imgui/misc/cpp/imgui_stdlib.h"
#include "json.hpp"
using json = nlohmann::json;

#include "../consts.h"
#include "ImgUiEditModal.h"

#include "./ImGuiRenderComponents.h"

template <typename T>
std::optional<T> getOptional(json& j) {
  std::optional<T> result;

  if (j.is_null()) {
    return std::nullopt;
  } else {
    return result.emplace(j.template get<T>());
  }
}

ModalStatusCode AiDenoImGuiRenderComponents(
    json&                           renderTree,
    ImGuiWindowFlags                windowFlags,
    ImGuiModal::OnChangeCallback    onChangeCallback,
    ImGuiModal::OnFireEventCallback onFireEventCallback,
    ImVec2*                         currentSize
) {
  ModalStatusCode resultStatus = ModalStatusCode::None;

  // std::cout << "renderTree: " << renderTree.dump() << std::endl;

  std::function<void(json)> renderNode = [&](json node) -> void {
    if (node.is_null() || !node.is_object() || !node.contains("type") ||
        !node.contains("nodeId"))
      return;

    std::string type   = node["type"];
    std::string nodeId = node["nodeId"];
    std::string idStr  = "##" + nodeId;
    const char* id     = idStr.c_str();

    std::optional<std::string> key = getOptional<std::string>(node["key"]);

    if (type == "group") {
      if (!node.contains("children")) return;

      std::string         direction = node["direction"];
      std::optional<bool> disabled  = getOptional<bool>(node["disabled"]);

      ImGui::BeginGroup();
      if (disabled.value_or(false)) { ui::styleStack.beginDisabled(); }
      for (json& child : node["children"]) {
        renderNode(child);
        if (direction == "row") ImGui::SameLine();
      }
      if (disabled.value_or(false)) { ui::styleStack.endDisabled(); }
      ImGui::EndGroup();

    } else if (type == "text") {
      std::string text = node["text"];

      ImGui::Text("%s", text.c_str());

    } else if (type == "button") {
      std::string label = node["text"].get<std::string>() + idStr;

      ui::styleStack.pushVar(ImGuiStyleVar_FrameRounding, 16.0f);
      ui::styleStack.pushVar(ImGuiStyleVar_FramePadding, ImVec2(8.0f, 4.0f));
      if (ui::Button(
              label.c_str(),
              ButtonProps{.kind = ButtonKind::Default, .size = ButtonSize::Sm}
          )) {
        onFireEventCallback(ImGuiModal::EventCallbackPayload{
            .type   = "click",
            .nodeId = nodeId,
        });
      }
      ui::styleStack.clear();

    } else if (type == "textInput") {
      std::string value = node["value"].get<std::string>();

      if (ImGui::InputText(id, &value, ImGuiInputTextFlags_None)) {
        std::cout << "value: " << value << std::endl;
        if (key) { onChangeCallback(json::object({{key, value}})); }

        onFireEventCallback(ImGuiModal::EventCallbackPayload{
            .type   = "change",
            .nodeId = nodeId,
            .value  = value,
        });
      }

    } else if (type == "numberInput") {
      std::string          dataType    = node["dataType"];
      std::optional<float> min         = getOptional<float>(node["min"]);
      std::optional<float> max         = getOptional<float>(node["max"]);
      float                step        = getOptional<float>(node["step"]).value_or(1.0f);
      float                valueCommon = node["value"];
      float                original    = valueCommon;
      bool                 onChanged   = false;

      if (dataType == "int") {
        int value = (int)valueCommon;

        onChanged = ImGui::InputInt(id, &value, step, 10);
        if (onChanged) {
          std::cout << "original: " << original << ", next value: " << value << std::endl;
          valueCommon = std::clamp(
              static_cast<float>(value), min.value_or(INT_MIN), max.value_or(INT_MAX)
          );

          if (key) { onChangeCallback(json::object({{key, static_cast<int>(value)}})); }
          onFireEventCallback(ImGuiModal::EventCallbackPayload{
              .type   = "change",
              .nodeId = nodeId,
              .value  = value,
          });
        }
      } else if (dataType == "float") {
        float value = valueCommon;

        onChanged = ImGui::InputFloat(id, &value, step, 1.0f, "%.2f");
        if (onChanged) {
          valueCommon = std::clamp(value, min.value_or(INT_MIN), max.value_or(INT_MAX));

          if (key) { onChangeCallback(json::object({{key, value}})); }
          onFireEventCallback(ImGuiModal::EventCallbackPayload{
              .type   = "change",
              .nodeId = nodeId,
              .value  = value,
          });
        }
      }

      if (!onChanged && ImGui::IsItemActive() && ImGui::IsItemFocused()) {
        ImGui::SetItemKeyOwner(ImGuiKey_UpArrow);
        ImGui::SetItemKeyOwner(ImGuiKey_DownArrow);

        bool isUpArrow   = ImGui::IsKeyPressed(ImGuiKey_UpArrow);
        bool isDownArrow = ImGui::IsKeyPressed(ImGuiKey_DownArrow);

        if (isUpArrow) {
          valueCommon += step;
        } else if (isDownArrow) {
          valueCommon -= step;
        }

        valueCommon =
            std::clamp(valueCommon, min.value_or(INT_MIN), max.value_or(INT_MAX));
        valueCommon = dataType == "int" ? std::floor(valueCommon) : valueCommon;

        std::cout << "isUpArrow: " << isUpArrow << ", isDownArrow: " << isDownArrow
                  << std::endl;
        std::cout << "original: " << original << ", valueCommon: " << valueCommon
                  << ", step: " << step << std::endl;

        if (isUpArrow || isDownArrow) {
          if (key) { onChangeCallback(json::object({{key, valueCommon}})); }
          onFireEventCallback(ImGuiModal::EventCallbackPayload{
              .type   = "change",
              .nodeId = nodeId,
              .value  = valueCommon,
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
                    ImGuiColorEditFlags_DisplayRGB | ImGuiColorEditFlags_DisplayHSV |
                    ImGuiColorEditFlags_AlphaBar | ImGuiColorEditFlags_AlphaPreview
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
              .nodeId = nodeId,
              .value  = jsonValue,
          });
        }

        ImGui::EndPopup();
      }

    } else if (type == "checkbox") {
      std::string label = node["label"].get<std::string>() + idStr;
      bool        value = node["value"].get<bool>();

      if (ImGui::Checkbox(label.c_str(), &value)) {
        if (key) { onChangeCallback(json({{key, value}})); }

        onFireEventCallback(ImGuiModal::EventCallbackPayload{
            .type   = "change",
            .nodeId = nodeId,
            .value  = value,
        });
      }

    } else if (type == "slider") {
      std::string dataType = node["dataType"].get<std::string>();
      float       min      = node["min"].get<float>();
      float       max      = node["max"].get<float>();

      if (dataType == "int") {
        int value = node["value"];

        if (ImGui::SliderInt(id, &value, (int)min, (int)max)) {
          if (key) { onChangeCallback(json({{key, value}})); }
          onFireEventCallback(ImGuiModal::EventCallbackPayload{
              .type   = "change",
              .nodeId = nodeId,
              .value  = value,
          });
        }
      } else if (dataType == "float") {
        float value = node["value"];

        if (ImGui::SliderFloat(id, &value, min, max)) {
          if (key) { onChangeCallback(json({{key, value}})); }
          onFireEventCallback(ImGuiModal::EventCallbackPayload{
              .type   = "change",
              .nodeId = nodeId,
              .value  = value,
          });
        }
      }

    } else if (type == "select") {
      int selectedIndex            = node["selectedIndex"].get<int>();
      auto [labels, values, count] = parseSelectOptions(node["options"]);

      ui::styleStack.pushColor(ImGuiCol_FrameBg, currentTheme.gray50);
      ui::styleStack.pushColor(ImGuiCol_FrameBgHovered, currentTheme.gray200);
      ui::styleStack.pushColor(ImGuiCol_FrameBgActive, currentTheme.gray100);
      if (ImGui::Combo(id, &selectedIndex, labels, count, -1)) {
        if (key) { onChangeCallback(json({{key, values[selectedIndex]}})); }

        onFireEventCallback(ImGuiModal::EventCallbackPayload{
            .type   = "change",
            .nodeId = nodeId,
            .value  = values[selectedIndex],
        });
      }
      ui::styleStack.clear();

      freeSelectOptions(labels, count);

    } else if (type == "separator") {
      ui::styleStack.pushVar(ImGuiStyleVar_FramePadding, ImVec2(0.0f, 4.0f));
      ImGui::Separator();
      ui::styleStack.clear();
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
    // std::cout << "WindowSize: " << size.x << ", " << size.y << std::endl;
  }

  ui::keyStack.reset();

  if (ImGui::IsKeyPressed(ImGuiKey_Escape)) { resultStatus = ModalStatusCode::Cancel; }
  if (ImGui::IsKeyPressed(ImGuiKey_Enter)) { resultStatus = ModalStatusCode::OK; }

  ImGui::End();

  return resultStatus;
}
