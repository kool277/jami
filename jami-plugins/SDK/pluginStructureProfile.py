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

from userProfile import UserInfos
from sdkConstants import *
import os
import json
import shutil
from termcolor import colored, cprint


class PluginStructure(UserInfos):
    def __init__(self, action):
        UserInfos.__init__(self, action)
        self.create(action)
        self.createFolderStructure()

    def delete(self):
        if (os.path.exists(self.pluginDirectory)
                and os.path.isdir(self.pluginDirectory)):
            shutil.rmtree(self.pluginDirectory)

    def reInitialize(self, pluginId):
        self.pluginId = pluginId
        self.pluginDirectory = f"./../{self.pluginId}"
        self.manifestFile = f"{self.pluginDirectory}/manifest.json"
        self.pluginDataDirectory = f"{self.pluginDirectory}/data"
        # Wrong! These 2 should adapt to iconPath and backgroundPath. But it's not getting passed in this function
        # Only pluginId is getting passed.
        self.pluginIcon = "icon.svg"
        self.pluginBackground = "background.jpg"
        self.preferencesFile = f"{self.pluginDataDirectory}/preferences.json"
        self.packageFile = f"{self.pluginDirectory}/package.json"
        self.cmakelistsFile = f"{self.pluginDirectory}/CMakeLists.txt"

    def create(self, action):
        plugins = os.listdir("../")
        print(colored("\nLeave blank or press 'q' to quit this option.", "yellow"))
        if (action == ACTIONS["CREATE"]):
            print("\nEnter the extension unique identifier to be created.")
            pluginId = "SDK"
            while (pluginId in plugins):
                pluginId = input("\nEnter a unique identifier for the extension: ")
                if (pluginId == 'q' or pluginId == 'Q' or not pluginId):
                    self.reInitialize('')
                    break
                if (pluginId in plugins):
                    print(colored("The extension identifier is already in use!", "red"))
                else:
                    self.reInitialize(pattern.sub('', pluginId))
            if (self.pluginId):
                coloredTitle = colored(self.pluginId, "green")
                print(f"\nThe extension identifier is {coloredTitle}")

        elif (action == ACTIONS["DELETE"] or action == ACTIONS["DELETE_PREFERENCES"] \
                or action == ACTIONS["DELETE_MANIFEST"]):
            pluginId = ""
            while (pluginId not in plugins or pluginId in FORBIDDEN_NAMES):
                pluginId = input("\nExtension to be modified: ")
                if (pluginId == 'q' or pluginId == 'Q' or not pluginId):
                    self.reInitialize('')
                    break
                if (pluginId not in plugins or pluginId in FORBIDDEN_NAMES):
                    print(colored("Invalid name!", "red"))
                else:
                    self.reInitialize(pattern.sub('', pluginId))

        elif (action == ACTIONS["CREATE/MODIFY_MANIFEST"] or action == ACTIONS["CREATE_PREFERENCES"] \
                or action == ACTIONS["CREATE_FUNCTIONALITY"] or action == ACTIONS["CREATE_PACKAGE_JSON"] \
                or action == ACTIONS["CREATE_MAIN"] or action == ACTIONS["CREATE_BUILD_FILES"] \
                or action == ACTIONS["ASSEMBLE"] or action == ACTIONS["PREASSEMBLE"] \
                or action == ACTIONS["BUILD"]):
            pluginId = ""
            while (pluginId in FORBIDDEN_NAMES):
                pluginId = input("\nExtension to be modified or created: ")
                if (pluginId == 'q' or pluginId == 'Q' or not pluginId):
                    self.reInitialize('')
                    break
                if (pluginId in FORBIDDEN_NAMES):
                    print(colored("Invalid name!", "red"))
                else:
                    self.reInitialize(pattern.sub('', pluginId))

    def createFolderStructure(self):
        if (self.pluginId):
            if (not os.path.exists(self.pluginDirectory)):
                os.mkdir(self.pluginDirectory)
            if (not os.path.exists(self.pluginDataDirectory)):
                os.mkdir(self.pluginDataDirectory)
            if (not os.path.exists(self.pluginIcon)):
                shutil.copyfile("./Templates/icon.svg", f"{self.pluginDataDirectory}/{self.pluginIcon}")
            if (not os.path.exists(self.pluginBackground)):
                shutil.copyfile("./Templates/background.jpg", f"{self.pluginDataDirectory}/{self.pluginBackground}")

    def saveManifest(self, manifestTxt):
        with open(self.manifestFile, 'w') as f:
            json.dump(manifestTxt, f, indent=4)
            f.close()

    def deleteManifest(self):
        if (os.path.exists(self.manifestFile)):
            os.remove(self.manifestFile)

    def isManifest(self):
        return os.path.exists(self.manifestFile)

    def isMainDirectory(self):
        return os.path.exists(self.pluginDirectory)
