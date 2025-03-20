#include "ImgUIEditModal.h"
#include "json.hpp"
using json = nlohmann::json;

#import "../consts.h"
#import "./ImgUIEditModal_osx.h"

ImGuiModal::IModalImpl *ImGuiModal::createModal() {
  std::cout << "Creating OSX modal" << std::endl;
    ImGuiModal::IModalImpl *modal = new ImGuiModalOSX();
  return modal;
}

std::string ImGuiModal::getSystemFontPath() {
  return "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc";
}
