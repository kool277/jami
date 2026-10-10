/**
 *  Copyright (C) 2021 Savoir-faire Linux Inc.
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

#include "WatermarkMediaHandler.h"
#include "PluginPreferenceHandler.h"

#ifdef __DEBUG__
#include <common.h>
#include <assert.h>
#include <yaml-cpp/yaml.h>
#include <fstream>
#include <AVFrameIO.h>
#endif

#ifdef WIN32
#define EXPORT_PLUGIN __declspec(dllexport)
#else
#define EXPORT_PLUGIN
#endif

#define WaterMark_VERSION_MAJOR 2
#define WaterMark_VERSION_MINOR 1
#define WaterMark_VERSION_PATCH 0

extern "C" {

void
pluginExit(void)
{}

EXPORT_PLUGIN JAMI_PluginExitFunc
JAMI_dynPluginInit(const JAMI_PluginAPI* api)
{
    std::cout << "*****************" << std::endl;
    std::cout << "**  WaterMark  **" << std::endl;
    std::cout << "*****************" << std::endl << std::endl;
    std::cout << "Version " << WaterMark_VERSION_MAJOR << "." << WaterMark_VERSION_MINOR << "."
              << WaterMark_VERSION_PATCH << std::endl;

    if (api) {
        if (api->version.api < JAMI_PLUGIN_API_VERSION)
            return nullptr;

        std::map<std::string, std::map<std::string, std::string>> preferences;
        api->invokeService(api, "getPluginAccPreferences", &preferences);
        std::string dataPath;
        api->invokeService(api, "getPluginDataPath", &dataPath);

        auto fmpPluginPreferenceHandler
            = std::make_unique<jami::PluginPreferenceHandler>(api, std::move(preferences), dataPath);
        auto fmpWatermarkMediaHandler
            = std::make_unique<jami::WatermarkMediaHandler>(std::move(dataPath),
                                                            fmpPluginPreferenceHandler.get());
        fmpPluginPreferenceHandler->setWaterMarkHandler(fmpWatermarkMediaHandler.get());
        if (api->manageComponent(api,
                                 "CallMediaHandlerManager",
                                 fmpWatermarkMediaHandler.release())) {
            return nullptr;
        }
        if (api->manageComponent(api,
                                 "PreferenceHandlerManager",
                                 fmpPluginPreferenceHandler.release())) {
            return nullptr;
        }
    }
    return pluginExit;
}
}

#ifdef __DEBUG__

int
main ()
{
    std::cout << "*******************************" << std::endl;
    std::cout << "**  WaterMark Debug Version  **" << std::endl;
    std::cout << "*******************************" << std::endl;
    std::cout << "Version " << WaterMark_VERSION_MAJOR << "." << WaterMark_VERSION_MINOR << "."
              << WaterMark_VERSION_PATCH << std::endl << std::endl;

    std::ifstream file;
    file_utils::openStream(file, "testPreferences.yml");

    assert(file.is_open());
    YAML::Node node = YAML::Load(file);

    assert(node.IsMap());
    std::map<std::string, std::map<std::string, std::string>> preferences;
    preferences["default"] = {};
    for (const auto& kv : node) {
        preferences["default"][kv.first.as<std::string>()] = kv.second.as<std::string>();
        std::cout << "Key: " << kv.first.as<std::string>() << "; Value: " << kv.second.as<std::string>() << std::endl;
    }

#ifdef _WIN32
    std::string dataPath = "../data";
#else
    std::string dataPath = "data";
#endif
    preferences["default"]["mark"] = dataPath + separator() + preferences["default"]["mark"];

    auto fmpPluginPreferenceHandler
        = std::make_unique<jami::PluginPreferenceHandler>(nullptr, std::move(preferences), dataPath);
    auto fmpWatermarkMediaHandler
        = std::make_unique<jami::WatermarkMediaHandler>(std::move(dataPath),
                                                        fmpPluginPreferenceHandler.get());
    fmpPluginPreferenceHandler->setWaterMarkHandler(fmpWatermarkMediaHandler.get());

    auto subject = std::make_shared<jami::PublishObservable<AVFrame*>>();

    // Valid Read frames from sample file and send to subscriber
    std::cout << "Test 1" << std::endl << "Received video: " << preferences["default"]["sample"] << std::endl;
    fmpWatermarkMediaHandler->notifyAVFrameSubject(StreamData("testCall", true, StreamType::video, "origin", "destiny"), subject);
    av_utils::readAndNotifyAVFrame(preferences["default"]["sample"], subject.get(), preferences["default"]["output"], AVMEDIA_TYPE_VIDEO);

    return 0;
}

#endif
