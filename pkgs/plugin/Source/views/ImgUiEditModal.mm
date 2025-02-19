#include "ImgUIEditModal.h"
#include "json.hpp"
using json = nlohmann::json;

#import "../consts.h"
#import "./ImgUIEditModal_osx.mm"

ImGuiModal::IModalImpl *ImGuiModal::createModal() {
  std::cout << "Creating OSX modal" << std::endl;
    ImGuiModal::IModalImpl *modal = new ImGuiModalOSX();
  return modal;
}
