/**
 *  Copyright (C) 2024-2026 Savoir-faire Linux Inc.
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

#pragma once

#include "pluglog.h"
#include <chrono>
#include <format>
#ifdef _WIN32
#  define NOMINMAX
#  include <windows.h>
#else
#  include <sys/syscall.h>
#  include <unistd.h>
#endif

#ifdef _WIN32
static inline long _plog_gettid() { return static_cast<long>(GetCurrentThreadId()); }
#else
static inline long _plog_gettid() { return syscall(SYS_gettid); }
#endif

const char sep = separator();

template<typename... Args>
inline void plog_(const char* file, const int line, const Plog::LogPriority priority,
                  const std::string& tag, const std::string_view fmt, Args&&... args)
{
    const double ts = std::chrono::duration<double>(
                          std::chrono::system_clock::now().time_since_epoch())
                          .count();
    const long tid = _plog_gettid();
    const std::string_view sv(file);
    const auto slashPos = sv.find_last_of("/\\");
    const std::string_view f = (slashPos != std::string_view::npos) ? sv.substr(slashPos + 1) : sv;
    const auto loc = std::format("\033[34m[{:.3f}|{}|{}:\t{}] \033[0m", ts, tid, f, line);
    Plog::log(priority, loc + tag, std::vformat(fmt, std::make_format_args(args...)));
}

#define PLOG(priority, tag, fmt, ...) \
    plog_(__FILE__, __LINE__, priority, tag, fmt __VA_OPT__(,) __VA_ARGS__)
