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

#include <iostream>
#include <string.h>
#include <thread>
#include <memory>
#include <plugin/jamiplugin.h>

#include "AudioHandlerTester.h"
#include "VideoHandlerTester.h"
#include "ChatHandlerTester.h"

#ifdef WIN32
#define EXPORT_PLUGIN __declspec(dllexport)
#else
#define EXPORT_PLUGIN
#endif

#define TestSuite_VERSION_MAJOR 1
#define TestSuite_VERSION_MINOR 0
#define TestSuite_VERSION_PATCH 1

extern "C" {
void
pluginExit(void)
{}

EXPORT_PLUGIN JAMI_PluginExitFunc
JAMI_dynPluginInit(const JAMI_PluginAPI* api)
{
    std::cout << "*******************" << std::endl;
    std::cout << "**   TestSuite   **" << std::endl;
    std::cout << "*******************" << std::endl << std::endl;
    std::cout << "Version " << TestSuite_VERSION_MAJOR << "." << TestSuite_VERSION_MINOR << "."
              << TestSuite_VERSION_PATCH << std::endl;

    // If invokeService doesn't return an error
    if (api) {
        std::string dataPath;
        api->invokeService(api, "getPluginDataPath", &dataPath);

        auto fmpAudio
            = std::make_unique<jami::AudioHandlerTester>(std::move(dataPath));
        if (api->manageComponent(api,
                                 "CallMediaHandlerManager",
                                 fmpAudio.release())) {
            return nullptr;
        }

        auto fmpVideo
            = std::make_unique<jami::VideoHandlerTester>(std::move(dataPath));
        if (api->manageComponent(api,
                                 "CallMediaHandlerManager",
                                 fmpVideo.release())) {
            return nullptr;
        }

        auto fmpChat
            = std::make_unique<jami::ChatHandlerTester>(std::move(dataPath));
        if (api->manageComponent(api,
                                 "ChatHandlerManager",
                                 fmpChat.release())) {
            return nullptr;
        }
    }
    return pluginExit;
}
}
