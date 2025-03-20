#pragma once

#include <functional>
#include <iostream>

#include "./super-illustrator.h"
#include "IllustratorSDK.h"

using AdjustColorCallbackLambda = std::function<const char*(const char*)>;

// extern "C" {
//   const char* ai_deno_trampoline_adjust_color_callback(void* ptr, const char* color);

//   void        ai_deno_alert(const char* message);
//   const char* ai_deno_get_user_locale();
// }

extern "C" {
  const char* ai_deno_trampoline_adjust_color_callback(void* ptr, const char* color) {
    auto* lambda_ptr = static_cast<AdjustColorCallbackLambda*>(ptr);
    return (*lambda_ptr)(color);
  }

  void ai_deno_alert(const char* message) {
    auto msgStr = suai::str::toAiUnicodeStringUtf8(message);
    sAIUser->MessageAlert(msgStr);
  }

  const char* ai_deno_get_user_locale() {
    ai::UnicodeString locale;
    sAIUser->GetAILanguageCode(locale);

    return suai::str::toUtf8StdString(locale).c_str();
  }
}
