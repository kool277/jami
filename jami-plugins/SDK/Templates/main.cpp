HEADER

#include <iostream>
#include <string.h>
#include <thread>
#include <memory>
#include <plugin/jamiplugin.h>
----------------
#include "INCLUDESAPI.h"----------------


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

#define PLUGINNAME_VERSION_MAJOR PLUGINVERSIONMAJOR
#define PLUGINNAME_VERSION_MINOR PLUGINVERSIONMINOR
#define PLUGINNAME_VERSION_PATCH PLUGINVERSIONPATCH

extern "C" {

void
pluginExit(void)
{}

EXPORT_PLUGIN JAMI_PluginExitFunc
JAMI_dynPluginInit(const JAMI_PluginAPI* api)
{
    std::cout << "**************************" << std::endl;
    std::cout << "**  PLUGINNAME  **" << std::endl;
    std::cout << "**************************" << std::endl << std::endl;
    std::cout << "Version " << PLUGINNAME_VERSION_MAJOR << "." << PLUGINNAME_VERSION_MINOR << "."
              << PLUGINNAME_VERSION_PATCH << std::endl;

    // If invokeService doesn't return an error
    if (api) {
        std::map<std::string, std::string> preferences;
        api->invokeService(api, "getPluginPreferences", &preferences);
        std::string dataPath;
        api->invokeService(api, "getPluginDataPath", &dataPath);
----------------
        auto fmpPLUGINAPI = std::make_unique<jami::PLUGINAPI>(CHATHANDLERstd::move(preferences), std::move(dataPath));
        if (api->manageComponent(api, "APIMANAGER", fmpPLUGINAPI.release())) {
            return nullptr;
        }
----------------
    }
    return pluginExit;
}
}

#ifdef __DEBUG__

int
main ()
{
    std::cout << "*******************************" << std::endl;
    std::cout << "**  PLUGINNAME Debug Version  **" << std::endl;
    std::cout << "*******************************" << std::endl;
    std::cout << "Version " << PLUGINNAME_VERSION_MAJOR << "." << PLUGINNAME_VERSION_MINOR << "."
              << PLUGINNAME_VERSION_PATCH << std::endl << std::endl;

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



    return 0;
}

#endif
