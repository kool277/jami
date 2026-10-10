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
#include <map>
#include "plugin/jamiplugin.h"
#include "BotChatHandler.h"

#ifdef __DEBUG__
#include <common.h>
#include <assert.h>
#include <yaml-cpp/yaml.h>
#include <fstream>
#endif

#ifdef WIN32
#define EXPORT_PLUGIN __declspec(dllexport)
#else
#define EXPORT_PLUGIN
#endif

#define AutoAnswer_VERSION_MAJOR 2
#define AutoAnswer_VERSION_MINOR 0
#define AutoAnswer_VERSION_PATCH 0

extern "C" {

void
pluginExit(void)
{}

EXPORT_PLUGIN JAMI_PluginExitFunc
JAMI_dynPluginInit(const JAMI_PluginAPI* api)
{
    std::cout << "******************" << std::endl;
    std::cout << "**  AutoAnswer  **" << std::endl;
    std::cout << "******************" << std::endl << std::endl;
    std::cout << "Version " << AutoAnswer_VERSION_MAJOR << "." << AutoAnswer_VERSION_MINOR << "."
              << AutoAnswer_VERSION_PATCH << std::endl;

    // If invokeService doesn't return an error
    if (api) {
        if (api->version.api < JAMI_PLUGIN_API_VERSION)
            return nullptr;

        std::map<std::string, std::map<std::string, std::string>> preferences;
        api->invokeService(api, "getPluginAccPreferences", &preferences);
        std::string dataPath;
        api->invokeService(api, "getPluginDataPath", &dataPath);

        auto fmpPluginPreferenceHandler
            = std::make_unique<jami::PluginPreferenceHandler>(api, std::move(preferences), dataPath);
        auto fmpBotChatHandler
            = std::make_unique<jami::BotChatHandler>(api,
                                                     std::move(dataPath),
                                                     fmpPluginPreferenceHandler.get());
        if (api->manageComponent(api, "ChatHandlerManager", fmpBotChatHandler.release())) {
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
    std::cout << "********************************" << std::endl;
    std::cout << "**  AutoAnswer Debug Version  **" << std::endl;
    std::cout << "********************************" << std::endl;
    std::cout << "Version " << AutoAnswer_VERSION_MAJOR << "." << AutoAnswer_VERSION_MINOR << "."
              << AutoAnswer_VERSION_PATCH << std::endl << std::endl;

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

    std::string dataPath = "tester";

    auto fmpPluginPreferenceHandler
        = std::make_unique<jami::PluginPreferenceHandler>(nullptr, std::move(preferences), dataPath);

    auto fmpBotChatHandler
        = std::make_unique<jami::BotChatHandler>(nullptr,
                                                    std::move(dataPath),
                                                    fmpPluginPreferenceHandler.get());

    auto subject = std::make_shared<jami::PublishObservable<jami::pluginMessagePtr>>();
    std::pair<std::string, std::string> subjectConnection("origin", "destiny");
    fmpBotChatHandler->notifyChatSubject(subjectConnection, subject);

    // Only test for swarm

    // Valid Sender, Receiver, direction and message
    std::cout << "Test 1" << std::endl << "Should print input/output" << std::endl;
    std::map<std::string, std::string> sendMsg = {{"type", "text/plain"}, {"body", preferences["default"]["inText"]}};
    jami::pluginMessagePtr jamiMsg = std::make_shared<JamiMessage>("origin",
                                                                   "destiny",
                                                                   true,
                                                                   sendMsg,
                                                                   false);
    jamiMsg->isSwarm = true;
    subject->publish(jamiMsg);


    // Valid Sender, Receiver and message but not direction
    std::cout << "Test 2" << std::endl << "Should NOT print input/output" << std::endl;
    jamiMsg.reset(new JamiMessage("origin",
                                  "destiny",
                                  false,
                                  sendMsg,
                                  false));
    jamiMsg->isSwarm = true;
    subject->publish(jamiMsg);

    // Invalid Sender, Receiver, direction and message
    std::cout << "Test 3" << std::endl << "Should NOT print input/output" << std::endl;
    sendMsg["body"] = preferences["default"]["invalid"];
    jamiMsg.reset(new JamiMessage("destiny",
                                  "origin",
                                  true,
                                  sendMsg,
                                  false));
    jamiMsg->isSwarm = true;
    subject->publish(jamiMsg);

    return 0;
}
#endif
