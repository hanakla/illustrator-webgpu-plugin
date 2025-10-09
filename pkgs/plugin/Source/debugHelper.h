#pragma once

#include <iostream>
#include <sstream>
#include <string>
#include <stack>
#include <chrono>
#include <vector>
#include "./libs/format.h"
#include "IllustratorSDK.h"
#include "json.hpp"

using json = nlohmann::json;

std::string indentLines(std::string str, std::string indent) {
  std::vector<std::string> lines;
  std::string              line;
  std::istringstream       ss(str);

  while (std::getline(ss, line, '\n')) {
    lines.push_back(line);
  }

  std::string result = "";
  for (size_t i = 0; i < lines.size(); i++) {
    result += indent + lines[i];
    if (i < lines.size() - 1) result += "\n";
  }

  return result;
}

template <typename T, size_t N>
std::string arrayToString(T (&arr)[N]) {
  std::string str = "";
  for (size_t i = 0; i < N; i++) {
    str += std::to_string(arr[i]);
    if (i < N - 1) str += ", ";
  }
  return str;
}

template <typename... Args>
void csl(const char* format, Args... args) {
  if (!AI_DENO_DEBUG) return;

  std::ostringstream ss;
  ss << string_format(format, args...) << std::endl;

  std::cout << indentLines(ss.str(), "\033[1m[deno_ai(C)]\033[0m ") << std::endl;
}

template <typename... Args>
void cse(const char* format, Args... args) {
  if (!AI_DENO_DEBUG) return;

  std::ostringstream ss;
  ss << string_format(format, args...) << std::endl;

  std::cerr << indentLines(ss.str(), "\033[1m[deno_ai(C)]\033[0m ") << std::endl;
}

// print as hex binary json array
void csb(const char* label, const char* value) {
  if (!AI_DENO_DEBUG) return;

  size_t len = strlen(value);

  std::stringstream ss;
  for (size_t i = 0; i < len; ++i) {
    ss << std::hex << std::uppercase << (int)value[i];
    if (i < len - 1) ss << ", ";
  }
  std::cout << "\033[1m[deno_ai(C)]\033[0m " << label << " [" << ss.str() << "]"
            << std::endl;
}

class dbg__Measuring {
 public:
  const char* label;

  dbg__Measuring(const char* label = nullptr) : label(label) {
    start = std::chrono::system_clock::now();
  }

  double elapsed() {
    end = std::chrono::system_clock::now();
    return std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count();
  }

 private:
  std::chrono::system_clock::time_point start, end;
};

std::stack<dbg__Measuring> dbg_cstCurrent;

void timeStart(const char* label) {
  if (!AI_DENO_DEBUG) return;
  auto m = new dbg__Measuring(label);
  dbg_cstCurrent.push(*m);
}

void timeEnd() {
  if (!AI_DENO_DEBUG) return;

  dbg__Measuring* m = &dbg_cstCurrent.top();
  dbg_cstCurrent.pop();
  if (m == nullptr) return;

  csl("%s Elapsed: %.2fms", m->label, m->elapsed());
}

// void print_PluginParams(const PluginParams* params) {
//   if (!AI_DENO_DEBUG) return;
//
//   cs l("PluginParams: \n \
//    effectName: %s \n \
//    params: %s",
//       params->effectName.c_str(), params->params.dump().c_str());
//   // std::cout << "PluginParams:" << std::endl;
//   // std::cout << "  effectName: " << params->effectName << std::endl;
//   // std::cout << "  params: " << params->params.dump() << std::endl;
//   // std::cout << std::endl;
// }

void print_json(json value, std::string label) {
  if (!AI_DENO_DEBUG) return;
  std::cout << "print_json:" << label << value.dump() << std::endl;
}

void print_stringBin(const char* str, std::string label) {
  if (!AI_DENO_DEBUG) return;
  std::cout << "print_stringBin(char*):" << label << std::endl;

  std::ostringstream ss;

  size_t l = strlen(str);
  for (size_t i = 0; i < l; i++) {
    ss << std::hex << std::uppercase << (int)str[i] << " ";
  }

  std::cout << "  hex: " << ss.str() << std::endl;
  std::cout << "  str: " << str << std::endl;
}

void print_stringBin(const std::string& str, std::string label) {
  if (!AI_DENO_DEBUG) return;
  std::cout << "print_stringBin:" << label << std::endl;

  std::ostringstream ss;

  for (size_t i = 0; i < str.size(); i++) {
    ss << std::hex << std::uppercase << (int)str[i];
  }

  std::cout << "  hex: " << ss.str() << std::endl;
  std::cout << "  str: " << str << std::endl;
}
