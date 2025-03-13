//
//  main.cpp
//  Sandbox
//
//  Created by Hanakla on 2025/03/13.

#include <iostream>
#include <optional>
#define JSON_USE_IMPLICIT_CONVERSIONS 0
#include "../deps/json/json.hpp"

using json = nlohmann::json;

template <typename T>
std::optional<T> getOptional(json& j) {
  std::optional<T> result;

  if (j.is_null()) {
    return std::nullopt;
  } else {
    return result.emplace(j.template get<T>());
  }
}

int main(int argc, const char* argv[]) {
  // json j = json::parse(R"({"A": 1, "B": 2, "C": 3})");
  // std::optional<int> min = getOptional<int>(j["A"]);

  // std::cout << "has value: " << min.has_value() << std::endl;
  // std::cout << "min: " << min.value_or(0) << std::endl;

  int a = 99;
  std::cout << "a: " << (float)a << std::endl;

  return 0;
}
