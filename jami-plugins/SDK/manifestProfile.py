#!/usr/bin/env python3
#
# Copyright (C) 2020-2021 Savoir-faire Linux Inc.
#
# Author: Aline Gondim Santos <aline.gondimsantos@savoirfairelinux.com>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
# Creates packaging targets for a distribution and architecture.
# This helps reduce the length of the top Makefile.
#

import os
import json
from termcolor import colored, cprint

from sdkConstants import *
from pluginStructureProfile import PluginStructure


class Manifest(PluginStructure):
    def __init__(self, action):
        PluginStructure.__init__(self, action)
        self.description = ''
        self.version = '0'
        self.manifest = {}
        with open("./Templates/manifest.json") as f:
            self.manifestSkeleton = f.read()
            f.close()
        if (self.isManifest()):
            with open(self.manifestFile) as f:
                self.manifest = json.load(f)
                f.close()
            self.pluginId = self.manifest["id"]
            self.pluginName = self.manifest["name"]
            self.description = self.manifest["description"]
            self.version = self.manifest["version"]
            self.iconPath = self.manifest["iconPath"]
            self.backgroundPath = self.manifest["backgroundPath"]

    def checkVersionFormat(self, version):
        return False if (len(version.split('.')) != 3) else True

    def createManifest(self):
        print(
            f"\nDefining the manifest for \"{self.pluginId}\" extension.")
        print(colored("\nPress 'q' to quit this option.", "yellow"))

        pluginName = input("\nEnter Extension display name (may contain spaces): ")
        if (pluginName == 'q' or pluginName == 'Q'):
            return False
        self.pluginName = pluginName
        pluginDescription = input("\nEnter Extension description: ")
        if (pluginDescription == 'q' or pluginDescription == 'Q'):
            return False
        self.description = pluginDescription
        pluginVersion = '0'
        while (not self.checkVersionFormat(
                pluginVersion) and pluginVersion != ""):
            print(colored("\nVersion must be of the form X.Y.Z", "yellow"))
            pluginVersion = input("Enter Extension version (leave blank for '0.0.0'): ")
            if (pluginVersion == 'q' or pluginVersion == 'Q'):
                return False
            if (not pluginVersion):
                pluginVersion = '0.0.0'
        self.version = pluginVersion
        self.manifest["id"] = self.pluginId
        self.manifest["name"] = self.pluginName
        self.manifest["description"] = self.description
        self.manifest["version"] = self.version
        self.manifest["iconPath"] = self.pluginIcon
        self.manifest["backgroundPath"] = self.pluginBackground

        self.saveManifest(self.manifest)
        return True

    def modifyManifestInternal(self, action):
        self.callUpdateVersion = False
        if (action == ACTIONS["DELETE_MANIFEST"]):
            self.deleteManifest()
        elif (self.isManifest()):
            self.manifest["id"] = self.pluginId
            self.manifest["name"] = self.pluginName
            self.manifest["iconPath"] = self.iconPath
            self.manifest["backgroundPath"] = self.backgroundPath
            pluginDescription = input(
                "Enter Extension description (leave blank to keep previous description): ")
            pluginVersion = input(
                "Enter Extension version (leave blank to keep previous version): ")
            while (not self.checkVersionFormat(
                    pluginVersion) and pluginVersion != ""):
                print("Version must be of the form X.Y.Z")
                pluginVersion = input(
                    "Enter Extension version (leave blank to keep previous version): ")
            if (pluginDescription != ""):
                self.description = pluginDescription
            self.manifest["description"] = self.description
            if (pluginVersion !=
                    "" and self.manifest["version"] != pluginVersion):
                self.version = pluginVersion
                self.manifest["version"] = self.version
                self.callUpdateVersion = True
            self.saveManifest(self.manifest)
        else:
            self.createManifest()
        return self.callUpdateVersion
