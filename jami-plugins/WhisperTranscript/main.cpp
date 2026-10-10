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

#include <iostream>
#include <string.h>
#include <thread>
#include <memory>
#include <plugin/jamiplugin.h>

#include "TranscriptMediaHandler.h"
#include "PluginPreferenceHandler.h"

#ifdef STANDALONE
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

#define WhisperTranscript_VERSION_MAJOR 1
#define WhisperTranscript_VERSION_MINOR 1
#define WhisperTranscript_VERSION_PATCH 0

extern "C" {

void
pluginExit(void)
{}

EXPORT_PLUGIN JAMI_PluginExitFunc
JAMI_dynPluginInit(const JAMI_PluginAPI* api)
{
    std::cout << "**************************" << std::endl;
    std::cout << "**  WhisperTranscript  **" << std::endl;
    std::cout << "**************************" << std::endl << std::endl;
    std::cout << "Version " << WhisperTranscript_VERSION_MAJOR << "." << WhisperTranscript_VERSION_MINOR << "."
              << WhisperTranscript_VERSION_PATCH << std::endl;

    // If invokeService doesn't return an error
    if (api) {
        if (api->version.api < JAMI_PLUGIN_API_VERSION)
            return nullptr;

        std::map<std::string, std::map<std::string, std::string>> preferences;
        api->invokeService(api, "getPluginAccPreferences", &preferences);
        std::string dataPath;
        api->invokeService(api, "getPluginDataPath", &dataPath);

        auto fmpPluginPreferenceHandler
            = std::make_unique<jami::PluginPreferenceHandler>(api,
                                                              std::move(preferences),
                                                              dataPath);

        auto fmpTranscriptMediaHandler
            = std::make_unique<jami::TranscriptMediaHandler>(std::move(dataPath),
                                                             fmpPluginPreferenceHandler.get());

        fmpPluginPreferenceHandler->setTranscriptHandler(fmpTranscriptMediaHandler.get());

        if (api->manageComponent(api,
                                 "CallMediaHandlerManager",
                                 fmpTranscriptMediaHandler.release())) {
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

#ifdef STANDALONE

int
main ()
{
    std::cout << "***************************************" << std::endl;
    std::cout << "**  WhisperTranscript Debug Version  **" << std::endl;
    std::cout << "***************************************" << std::endl;
    std::cout << "Version " << WhisperTranscript_VERSION_MAJOR << "." << WhisperTranscript_VERSION_MINOR << "."
              << WhisperTranscript_VERSION_PATCH << std::endl;

    std::ifstream file;
    av_log_set_level(1);
    file_utils::openStream(file, "../testPreferences.yml"); // Ensure the file is in the current working directory
    if (!file.is_open()) {
        std::cerr << "Error: Unable to open testPreferences.yml. Please ensure the file exists in the correct directory." << std::endl;
        return 1; // Exit with error code
    }

    assert(file.is_open());
    YAML::Node node = YAML::Load(file);

    assert(node.IsMap());
    std::map<std::string, std::map<std::string, std::string>> preferences;
    preferences["default"] = {};
    for (const auto& kv : node) {
        preferences["default"][kv.first.as<std::string>()] = kv.second.as<std::string>();
        std::cout << "Key: " << kv.first.as<std::string>() << "; Value: " << kv.second.as<std::string>() << std::endl;
    }

    std::string dataPath = "../data";

    auto fmpPluginPreferenceHandler
            = std::make_unique<jami::PluginPreferenceHandler>(nullptr, std::move(preferences), dataPath);
    auto fmpTranscriptMediaHandler
            = std::make_unique<jami::TranscriptMediaHandler>(std::move(dataPath),
                                                             fmpPluginPreferenceHandler.get());
    fmpPluginPreferenceHandler->setTranscriptHandler(fmpTranscriptMediaHandler.get());

    auto subject = std::make_shared<jami::PublishObservable<AVFrame*>>();

    // Valid Read frames from audio sample file and send to subscriber
    fmpTranscriptMediaHandler->notifyAVFrameSubject(StreamData("testCall",
                                                               true,
                                                               StreamType::audio,
                                                               "origin",
                                                               "destiny"),
                                                    subject);
    av_utils::readAndNotifyAVFrame(preferences["default"]["audiosample"],
                                   subject.get(),
                                   preferences["default"]["audiooutput"],
                                   AVMEDIA_TYPE_AUDIO);

    // Valid Read frames from video sample file and send to subscriber
    fmpTranscriptMediaHandler->notifyAVFrameSubject(StreamData("testCall",
                                                               true,
                                                               StreamType::video,
                                                               "origin",
                                                               "destiny"),
                                                    subject);
    av_utils::readAndNotifyAVFrame(preferences["default"]["videosample"],
                                   subject.get(),
                                   preferences["default"]["videooutput"],
                                   AVMEDIA_TYPE_VIDEO);



    return 0;
}

#endif
