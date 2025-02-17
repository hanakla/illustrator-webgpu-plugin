#pragma once

#include "ImgUiEditModal.h"
#include "json.hpp"
using json = nlohmann::json;

#import "./ImgUIEditModal_osx.mm"

int ImgUiEditModal::runModal(json nodes,
                             std::function<void(void)> callbackFunc) {
  return [ModalEntryObj runModal:nodes completion:callbackFunc];
}
