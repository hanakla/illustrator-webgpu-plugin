#pragma once

// via: https://stackoverflow.com/a/26221725
// Licensed under CC0 1.0.

#include <memory>
#include <string>
#include <stdexcept>

template <typename... Args>
std::string string_format(const std::string &format, Args... args)
{
    int size_s = std::snprintf(nullptr, 0, format.c_str(), args...) + 1; // Extra space for '\0'
    if (size_s <= 0)
    {
        throw std::runtime_error("Error during formatting.");
    }
    auto size = static_cast<size_t>(size_s);
    std::unique_ptr<char[]> buf(new char[size]);
    std::snprintf(buf.get(), size, format.c_str(), args...);
    return std::string(buf.get(), buf.get() + size - 1); // We don't want the '\0' inside
}

template <typename... Args>
std::string string_format(const char *format, Args... args)
{
    return string_format(std::string(format), args...);
}

template <typename... Args>
char *string_format_to_char(const char *format, Args... args)
{
    std::string result = string_format(std::string(format), args...);
    char *cstr = new char[result.length() + 1];
    strcpy(cstr, result.c_str());
    return cstr;
}
