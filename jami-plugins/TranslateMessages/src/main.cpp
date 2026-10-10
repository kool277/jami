/**
 *  Copyright (C) 2023-2026 Savoir-faire Linux Inc.
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

#include <string>
#include <memory>

#define PLUGIN_NAME   "TranslateMessages"
#define VERSION_MAJOR 1
#define VERSION_MINOR 0
#define VERSION_PATCH 1

#include "plugin/jamiplugin.h"
#include "TranslationChatHandler.h"
#include "TranslationPreferenceHandler.h"
#include "translatelog.h"

#ifdef WIN32
#define EXPORT_PLUGIN __declspec(dllexport)
#else
#define EXPORT_PLUGIN
#endif

extern "C" {

void
pluginExit(void)
{}

EXPORT_PLUGIN JAMI_PluginExitFunc
JAMI_dynPluginInit(const JAMI_PluginAPI* api)
{
    PLOG(Plog::LogPriority::INFO,
         "PluginInit",
         "***** " + std::string {PLUGIN_NAME} + " v" + std::to_string(VERSION_MAJOR) + "."
             + std::to_string(VERSION_MINOR) + "." + std::to_string(VERSION_PATCH) + " *****");

    if (api) {
        if (api->version.api < JAMI_PLUGIN_API_VERSION) {
            return nullptr;
        }

        std::string dataPath;
        api->invokeService(api, "getPluginDataPath", &dataPath);

        auto prefHandler = std::make_unique<jami::TranslationPreferenceHandler>(api, dataPath);
        auto chatHandler = std::make_unique<jami::TranslationChatHandler>(api,
                                                                          std::move(dataPath),
                                                                          prefHandler.get());

        // prefHandler before chatHandler: framework destroys in reverse registration
        // order (LIFO), and chatHandler holds a raw prefHandler_ pointer.
        if (api->manageComponent(api, "PreferenceHandlerManager", prefHandler.get())) {
            return nullptr;
        }
        prefHandler.release();

        if (api->manageComponent(api, "ChatHandlerManager", chatHandler.get())) {
            return nullptr;
        }
        chatHandler.release();

        // Must follow manageComponent so hasHandlers() returns true.
        api->invokeService(api, "loadMissingBodyOverwritesAllConversations", nullptr);
    }

    return pluginExit;
}
} // extern "C"