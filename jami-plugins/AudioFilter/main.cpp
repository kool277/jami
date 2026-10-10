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

#include "FilterMediaHandler.h"

#ifdef __DEBUG__
#include <common.h>
#include <assert.h>
#include <yaml-cpp/yaml.h>
#include <AVFrameIO.h>
#endif

#ifdef WIN32
#define EXPORT_PLUGIN __declspec(dllexport)
#else
#define EXPORT_PLUGIN
#endif

#define AudioFilter_VERSION_MAJOR 1
#define AudioFilter_VERSION_MINOR 0
#define AudioFilter_VERSION_PATCH 1

extern "C" {

void
pluginExit(void)
{}

EXPORT_PLUGIN JAMI_PluginExitFunc
JAMI_dynPluginInit(const JAMI_PluginAPI* api)
{
    std::cout << "*******************" << std::endl;
    std::cout << "**  AudioFilter  **" << std::endl;
    std::cout << "*******************" << std::endl << std::endl;
    std::cout << "Version " << AudioFilter_VERSION_MAJOR << "." << AudioFilter_VERSION_MINOR << "."
              << AudioFilter_VERSION_PATCH << std::endl;

    // If invokeService doesn't return an error
    if (api) {
        std::map<std::string, std::string> preferences;
        api->invokeService(api, "getPluginPreferences", &preferences);
        std::string dataPath;
        api->invokeService(api, "getPluginDataPath", &dataPath);

        auto fmpFilterMediaHandler = std::make_unique<jami::FilterMediaHandler>(std::move(
                                                                                    preferences),
                                                                                std::move(dataPath));
        if (api->manageComponent(api, "CallMediaHandlerManager", fmpFilterMediaHandler.release())) {
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
    std::cout << "*********************************" << std::endl;
    std::cout << "**  AudioFilter Debug Version  **" << std::endl;
    std::cout << "*********************************" << std::endl;
    std::cout << "Version " << AudioFilter_VERSION_MAJOR << "." << AudioFilter_VERSION_MINOR << "."
              << AudioFilter_VERSION_PATCH << std::endl << std::endl;

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

    auto fmpFilterMediaHandler = std::make_unique<jami::FilterMediaHandler>(std::move(
                                                                                preferences),
                                                                            std::move(dataPath));

    auto subject = std::make_shared<jami::PublishObservable<AVFrame*>>();

    // Valid Read frames from sample file and send to subscriber
    std::cout << "Test 1" << std::endl << "Received audio: " << preferences["sample"] << std::endl;
    fmpFilterMediaHandler->notifyAVFrameSubject(StreamData("testCall", true, StreamType::audio, "origin", "destiny"), subject);
    av_utils::readAndNotifyAVFrame(preferences["sample"], subject.get(), preferences["output1"], AVMEDIA_TYPE_AUDIO);

    // Valid Read frames from sample file and send to subscriber
    std::cout << "Test 2" << std::endl << "Sent audio: " << preferences["sample"] << std::endl;
    fmpFilterMediaHandler->detach();
    fmpFilterMediaHandler->notifyAVFrameSubject(StreamData("testCall", false, StreamType::audio, "origin", "destiny"), subject);
    av_utils::readAndNotifyAVFrame(preferences["sample"], subject.get(), preferences["output2"], AVMEDIA_TYPE_AUDIO);

    return 0;
}
#endif
