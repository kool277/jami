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

#include "pluginParameters.h" // Logger
#include "pluglog.h"

PluginParameters pluginParameters;

void
setGlobalPluginParameters(std::map<std::string, std::string> pp)
{
    if (!pp.empty()) {
        if (pp.find("streamslist") != pp.end()) {
            pluginParameters.stream = pp.at("streamslist");
            Plog::log(Plog::LogPriority::INFO, "GLOBAL STREAM ", pluginParameters.stream);
        }
        if (pp.find("modellist") != pp.end()) {
            pluginParameters.model = pp.at("modellist");
            Plog::log(Plog::LogPriority::INFO, "GLOBAL MODEL ", pluginParameters.model);
        }
        if (pp.find("background") != pp.end()) {
            pluginParameters.image = pp.at("background");
            Plog::log(Plog::LogPriority::INFO, "GLOBAL IMAGE ", pluginParameters.image);
        }
    }
}

void
getGlobalPluginParameters(PluginParameters* mPluginParameters)
{
    mPluginParameters->image = pluginParameters.image;
    mPluginParameters->model = pluginParameters.model;
    mPluginParameters->stream = pluginParameters.stream;
}

PluginParameters*
getGlobalPluginParameters()
{
    return &pluginParameters;
}