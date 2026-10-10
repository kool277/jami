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
#include "pluginMediaHandler.h"

#ifdef __DEBUG__
#include <assert.h>
#include <yaml-cpp/yaml.h>
#include <fstream>
#include <AVFrameIO.h>
#include <common.h>
#endif

#ifdef WIN32
#define EXPORT_PLUGIN __declspec(dllexport)
#else
#define EXPORT_PLUGIN
#endif

#define GreenScreen_VERSION_MAJOR 2
#define GreenScreen_VERSION_MINOR 0
#define GreenScreen_VERSION_PATCH 0

extern "C" {
void
pluginExit(void)
{}

EXPORT_PLUGIN JAMI_PluginExitFunc
JAMI_dynPluginInit(const JAMI_PluginAPI* api)
{
    std::cout << "*******************" << std::endl;
    std::cout << "**  GreenScreen  **" << std::endl;
    std::cout << "*******************" << std::endl << std::endl;
    std::cout << "Version " << GreenScreen_VERSION_MAJOR << "." << GreenScreen_VERSION_MINOR << "."
              << GreenScreen_VERSION_PATCH << std::endl;

    // If invokeService doesn't return an error
    if (api) {
        std::map<std::string, std::string> preferences;
        api->invokeService(api, "getPluginPreferences", &preferences);
        std::string dataPath;
        api->invokeService(api, "getPluginDataPath", &dataPath);
        auto fmp = std::make_unique<jami::PluginMediaHandler>(std::move(preferences),
                                                              std::move(dataPath));

        if (!api->manageComponent(api, "CallMediaHandlerManager", fmp.release())) {
            return pluginExit;
        }
    }
    return nullptr;
}
}

#ifdef __DEBUG__

int
main ()
{
    std::cout << "*********************************" << std::endl;
    std::cout << "**  GreenScreen Debug Version  **" << std::endl;
    std::cout << "*********************************" << std::endl;
    std::cout << "Version " << GreenScreen_VERSION_MAJOR << "." << GreenScreen_VERSION_MINOR << "."
              << GreenScreen_VERSION_PATCH << std::endl << std::endl;

    std::ifstream file;
    file_utils::openStream(file, "testPreferences.yml");

    assert(file.is_open());
    YAML::Node node = YAML::Load(file);

    assert(node.IsMap());
    std::map<std::string, std::string> preferences;
    for (const auto& kv : node) {
        preferences[kv.first.as<std::string>()] = kv.second.as<std::string>();
        std::cout << "Key: " << kv.first.as<std::string>() << "; Value: " << kv.second.as<std::string>() << std::endl;
    }

#ifdef _WIN32
    std::string dataPath = "../data";
#else
    std::string dataPath = "data";
#endif
    preferences["background"] = dataPath + separator() + preferences["background"];

    auto fmp = std::make_unique<jami::PluginMediaHandler>(std::move(preferences), std::move(dataPath));

    auto subject = std::make_shared<jami::PublishObservable<AVFrame*>>();

    // Valid Read frames from sample file and send to subscriber
    std::cout << "Test 1" << std::endl << "Sent video: " << preferences["sample"] << std::endl;
    fmp->notifyAVFrameSubject(StreamData("testCall", false, StreamType::video, "origin", "destiny"), subject);
    av_utils::readAndNotifyAVFrame(preferences["sample"], subject.get(), preferences["output"], AVMEDIA_TYPE_VIDEO);

    return 0;
}
#endif
