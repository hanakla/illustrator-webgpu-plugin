#include <regex>

// via https://github.com/sindresorhus/escape-string-regexp/blob/main/index.js
std::string escapeStringRegexp(const std::string& input) {
    if (input.empty()) {
        return "";
    }

    static const std::regex specialChars(R"([|\\{}()\[\]^$+*?.])");
    static const std::regex dash(R"(-)");

    std::string escaped = std::regex_replace(input, specialChars, R"(\$&)");
    escaped = std::regex_replace(escaped, dash, R"(\x2d)");

    return escaped;
}
