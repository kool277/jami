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

#ifndef COMMON_H
#define COMMON_H

#include <fstream>
#include <string>
#include <vector>

namespace string_utils {
#ifdef WIN32
std::wstring to_wstring(const std::string& str);
#endif // WIN32
void ffmpegFormatStringInline(std::string& str);
std::string ffmpegFormatString(const std::string& str);
void ffmpegScapeStringInline(std::string& str);
std::string ffmpegScapeString(const std::string& str);
std::vector<std::string> getWords(const std::string& text, const std::string& splits);
} // namespace string_utils

namespace file_utils {
void openStream(std::ifstream& file, const std::string& path);
}
#endif // COMMON_H
