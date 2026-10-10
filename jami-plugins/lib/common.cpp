/**
 *  Copyright (C) 2022 Savoir-faire Linux Inc.
 *
 *  Author: Aline Gondim Santos <aline.gondimsantos@savoirfairelinux.com>
 *
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation; either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program; if not, write to the Free Software
 *  Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301 USA.
 */

#include "common.h"

#ifdef WIN32
#include <WTypes.h>
#include <stdexcept>
#endif // WIN32

#include <cstring>

namespace string_utils {

#ifdef WIN32
std::wstring
to_wstring(const std::string& str) {
    int codePage = CP_UTF8;
    int srcLength = (int) str.length();
    int requiredSize = MultiByteToWideChar(codePage, 0, str.c_str(), srcLength, nullptr, 0);
    if (!requiredSize) {
        throw std::runtime_error("Can't convert string to wstring");
    }
    std::wstring result((size_t) requiredSize, 0);
    if (!MultiByteToWideChar(codePage, 0, str.c_str(), srcLength, &(*result.begin()), requiredSize)) {
        throw std::runtime_error("Can't convert string to wstring");
    }
    return result;
}
#endif // WIN32

void ffmpegFormatStringInline(std::string& str)
{
#ifdef WIN32
    for (int i = str.size(); i > 0; i--)
        if (str[i] == '\\')
            str.replace(str.begin() + i, str.begin() + i + 1, "/");
    str = str.insert(1, "\\");
#endif
}

void ffmpegScapeStringInline(std::string& str)
{
    std::string newStr;
    newStr.reserve(str.size());
    for (size_t i = 0; i < str.size(); i ++) {
        switch (str[i]) {
            case '\'':
                newStr.append("´");
                break;
            case '%':
                newStr.append("\\%");
                break;
            case ':':
                newStr.append("\\:");
                break;
            case '\\':
                newStr.append("\\\\");
                break;
            default:
                newStr.insert(newStr.end(), str[i]);
                break;
        }
    }
    std::swap(newStr, str);
}

std::string ffmpegFormatString(const std::string& str)
{
    std::string ret = str;
    ffmpegFormatStringInline(ret);
    return ret;
}

std::string ffmpegScapeString(const std::string& str)
{
    std::string ret = str;
    ffmpegScapeStringInline(ret);
    return ret;
}

std::vector<std::string>
getWords(const std::string& text, const std::string& splits)
{
    std::vector<std::string> words;
    auto token = std::strtok (const_cast<char*>(text.c_str()), const_cast<char*>(splits.c_str()));
    while (token != NULL) {
        words.emplace_back(token);
        token = std::strtok (NULL, const_cast<char*>(splits.c_str()));
    }
    return words;
}
} // namespace string_utils

namespace file_utils {

void
openStream(std::ifstream& file, const std::string& path)
{
#ifdef _WIN32
    file = std::ifstream(string_utils::to_wstring(path));
#else
    file = std::ifstream(path);
#endif
}
} // namespace file_utils
