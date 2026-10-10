/**
 *  Copyright (C) 2020-2021 Savoir-faire Linux Inc.
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

#ifndef PLUGLOG_H
#define PLUGLOG_H

#include <string>
#include <sstream>

#ifndef __ANDROID__
#include <iostream>
#endif

#ifdef __ANDROID__
#include <android/log.h>
#endif

inline char
separator()
{
    return '/';
}

class Plog
{
private:
    Plog() = delete;
    Plog(const Plog&) = delete;
    Plog(Plog&&) = default;

public:
    enum class LogPriority {
        /** For internal use only.  */
        UNKNOWN,
        /** The default priority, for internal use only.  */
        DEFAULT,
        /** Verbose logging. Should typically be disabled for a release apk. */
        VERBOSE,
        /** Debug logging. Should typically be disabled for a release apk. */
        DEBUG,
        /** Informational logging. Should typically be disabled for a release apk. */
        INFO,
        /** Warning logging. For use with recoverable failures. */
        WARN,
        /** Error logging. For use with unrecoverable failures. */
        ERR,
        /** Fatal logging. For use when aborting. */
        FATAL,
        /** For internal use only.  */
        SILENT, /* only for SetMinPriority(); must be last */
    };

    static void log(const LogPriority priority, const std::string& tag, const std::string& s)
    {
// Android only
#ifdef __ANDROID__
        switch (priority) {
        case LogPriority::DEBUG:
            __android_log_print(ANDROID_LOG_DEBUG, tag.c_str(), ": %s", s.c_str());
            break;
        case LogPriority::INFO:
            __android_log_print(ANDROID_LOG_INFO, tag.c_str(), ": %s", s.c_str());
            break;
        case LogPriority::WARN:
            __android_log_print(ANDROID_LOG_WARN, tag.c_str(), ": %s", s.c_str());
            break;
        case LogPriority::ERR:
            __android_log_print(ANDROID_LOG_ERROR, tag.c_str(), ": %s", s.c_str());
        default:
            break;
        }

// Anything but Android
#else
        switch (priority) {
        case LogPriority::UNKNOWN:
        case LogPriority::DEFAULT:
        case LogPriority::VERBOSE:
        case LogPriority::DEBUG:
        case LogPriority::INFO:
            std::cout << tag << ": " << s << std::endl;
            break;
        case LogPriority::WARN:
            std::cout << tag << ": " << s << std::endl;
            break;
        case LogPriority::ERR:
        case LogPriority::FATAL:
            std::cerr << tag << ": " << s << std::endl;
            break;
        case LogPriority::SILENT:
            break;
        }

#endif
    }
};

#endif // PLUGLOG_H
