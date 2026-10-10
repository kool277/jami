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

from manifestProfile import Manifest


class Preferences(Manifest):
    def __init__(self, action):
        Manifest.__init__(self, action)
        self.preferences = []
        self.preferencesTitles = []
        self.preferencesKeys = [""]
        self.preferences_options = {}
        self.preferences_options_keys = []
        self.getPreferencesOptions()
        self.globPreferencesList()

    def getPreferencesOptions(self):
        with open("./Templates/preferences.json") as f:
            preferences = json.load(f)
            for preference in preferences:
                self.preferences_options_keys.append(preference["type"])
                self.preferences_options[preference["type"]] = preference
            f.close()

    def globPreferencesList(self):
        if os.path.exists(self.preferencesFile):
            with open(self.preferencesFile) as f:
                self.preferences = json.load(f)
                for preference in self.preferences:
                    self.preferencesTitles.append(preference["title"])
                    self.preferencesKeys.append(preference["key"])
                f.close()

    def completeListValues(self, item, entryValues=[]):
        if (item == "entryValues"):
            addNew = ''
            entryValues = []
            while (addNew != 'n' and addNew != 'N'):
                addNew = input(
                    "\nAdd a new entry value? [y/n] ")
                if (addNew == 'y' or addNew == 'Y'):
                    newValue = input("Enter one new entry: ")
                    if (newValue):
                        entryValues.append(newValue)
            return entryValues
        elif (item == 'entries'):
            entries = []
            addNew = ''
            for i in range(len(entryValues)):
                newValue = input(
                    f"Enter an entry name for '{entryValues[i]}': ")
                entries.append(newValue)
            return entries

    def completePathValues(self):
        allExts = ''
        while(allExts not in ['y', 'Y', 'n', 'N']):
            allExts = input("Allow access all file types? [y/n] ")
            if (allExts not in ['y', 'Y', 'n', 'N']):
                print(
                    colored(
                        "Invalid response, please type 'y' or 'n' and press Enter",
                        "red"))
        if (allExts == 'y' or allExts == 'Y'):
            return "*/*"
        else:
            print("Now, tell us the accepted files extensions, one by one!")
            newExt = ''
            ext = []
            while (newExt != 'n' and newExt != 'N'):
                temp = input(
                    "Type a file extension (if empty, all files extensions will be considered valid): ")
                if (temp):
                    ext.append("*/." + temp.split('.')[-1])
                    newExt = ''
                    while (newExt not in ['y', 'Y', 'n', 'N']):
                        newExt = input(
                            "Add another extension? [y/n] ")
                        if (newExt not in ['y', 'Y', 'n', 'N']):
                            print(
                                colored(
                                    "Invalid response, please type 'y' or 'n' and press Enter",
                                    "red"))
                else:
                    return "*/*"
        return ','.join(ext)

    def createPreferencesInternal(self, names, loop=True):
        self.newPreferences = []
        addAllowed = ''
        while (addAllowed != "n" and addAllowed != "N"):
            addAllowed = input("\nAdd a preference? [y/n] ")
            if (addAllowed == "y" or addAllowed == "Y"):
                print("\nAvailable preferences: ")
                options = []
                for i, key in enumerate(self.preferences_options_keys):
                    options.append(str(i))
                    print(f"({i}) {key};")
                newType = ''
                while (newType not in options):
                    newType = input("\nSelect preference type: ")
                preferenceSkeleton = self.preferences_options[self.preferences_options_keys[int(
                    newType)]].copy()
                for item in preferenceSkeleton:
                    if (item != "type"):
                        if (item == "scope"):
                            scopeStr = ["plugin"]
                            forbbidenScope = [""]
                            scopeOptions = []
                            addScope = 'n'
                            if (len(names) > 0):
                                addScope = ''
                            for j, name in enumerate(names):
                                scopeOptions.append(str(j))
                            while (addScope != 'n' and not set(
                                    scopeOptions).issubset(set(forbbidenScope))):
                                if (not set(scopeOptions).issubset(
                                        set(forbbidenScope))):
                                    addScope = input(
                                        "\nAdd a scope? [y/n] ")
                                    if (addScope == "y" or addScope == "Y"):
                                        newScope = ''
                                        print(
                                            "\nAvailable values for scope:")
                                        for j, name in enumerate(names):
                                            if (str(j) not in forbbidenScope):
                                                print(f"({j}) {name};")
                                        while((newScope not in scopeOptions or newScope in forbbidenScope)):
                                            newScope = input(
                                                "\nSelect scope: ")
                                        forbbidenScope.append(newScope)
                                        scopeStr.append(
                                            f"{names[int(newScope)]}")
                                else:
                                    print(
                                        colored(
                                            "\nAll available scopes have been added to this preference!\nContinuing…",
                                            "yellow"))
                                    addScope = "n"
                            preferenceSkeleton[item] = ",".join(scopeStr)
                        elif (preferenceSkeleton["type"] == "List" and item in [
                                "entries", "entryValues"]):
                            if (item == 'entryValues'):
                                preferenceSkeleton[item] = self.completeListValues(
                                    item)
                            if (item == 'entries'):
                                preferenceSkeleton[item] = self.completeListValues(
                                    item, preferenceSkeleton['entryValues'].copy())
                        elif (preferenceSkeleton["type"] == "Path" and item in ["mimeType"]):
                            preferenceSkeleton[item] = self.completePathValues(
                            )
                        elif (item == "key"):
                            itemValue = ""
                            while (itemValue in self.preferencesKeys):
                                itemValue = input(
                                    f"Type a value for {item}: ")
                                if (itemValue in self.preferencesKeys):
                                    print(
                                        colored(
                                            "\nValue not permitted",
                                            "red"))
                            self.preferencesKeys.append(itemValue)
                            preferenceSkeleton[item] = itemValue
                        elif (item == "defaultValue"):
                            itemValue = ''
                            while (not itemValue):
                                itemValue = input(
                                    f"Type a value for {item}: ")
                                if (not itemValue):
                                    print(
                                        colored(
                                            "\nValue not permitted",
                                            "red"))
                            preferenceSkeleton[item] = itemValue
                        else:
                            preferenceSkeleton[item] = input(
                                f"Type a value for {item}: ")
                self.newPreferences.append(preferenceSkeleton)
            if (not loop):
                return

    def createPreferences(self, names):
        self.createPreferencesInternal(names)

        for p in self.newPreferences:
            self.preferences.append(p)

        if (len(self.newPreferences) > 0):
            with open(self.preferencesFile, 'w') as f:
                json.dump(self.preferences, f, indent=4)
                f.close()
        elif (len(self.preferences) == 0):
            with open(self.preferencesFile, 'w') as f:
                json.dump(self.preferences, f, indent=4)
                f.close()

    def deletePreference(self):
        options = []
        print("\nCurrent preferences: ")
        for i in range(len(self.preferencesTitles)):
            print(colored(f"({i}) {self.preferencesTitles[i]}", "yellow"))
            options.append(str(i))
        prefDel = ''
        if (len(options) > 0):
            while (prefDel not in options):
                prefDel = input(
                    "\nSelect preference to delete (select 'q' to quit): ")
                if (prefDel == 'q' or prefDel == 'Q'):
                    break
                if (prefDel not in options):
                    print(colored("Invalid response!", "red"))
            if (prefDel != 'q' and prefDel != 'Q'):
                for preference in self.preferences:
                    if self.preferencesTitles[int(
                            prefDel)] == preference["title"]:
                        self.preferences.remove(preference)
                        prefDel = preference
                        break
                with open(self.preferencesFile, 'w') as f:
                    json.dump(self.preferences, f, indent=4)
                    f.close
        else:
            input(
                colored(
                    "\nThere are no preferences to be deleted.\nTo continue, press Enter.",
                    "yellow"))
