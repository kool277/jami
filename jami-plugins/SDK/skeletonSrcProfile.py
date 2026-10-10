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
import sys
import json
from zipfile import ZipFile
from termcolor import colored, cprint

from sdkConstants import *
from preferencesProfile import Preferences


class SkeletonSourceFiles(Preferences):
    def __init__(self, action):
        Preferences.__init__(self, action)
        self.names = []
        self.apis = []
        self.dataTypes = []
        self.mainFile = self.pluginDirectory + "/main.cpp"
        self.newNames = []
        self.globNames()
        self.initPackage()
        with open('./Templates/defaultStrings.json') as f:
            self.defaultStrings = json.load(f)
            f.close()

    def initPackage(self):
        if os.path.exists(self.packageFile):
            with open(self.packageFile, 'r') as f:
                self.package = json.load(f)

    def updateMainFileVersion(self):
        if os.path.exists(self.mainFile):
            with open(self.mainFile, 'r') as f:
                lines = f.readlines()
                splits = self.version.split('.')
                if (not self.version):
                    splits = ['', '', '']
                splitStr = [
                    "#define " +
                    self.pluginId +
                    "_VERSION_MAJOR ",
                    "#define " +
                    self.pluginId +
                    "_VERSION_MINOR ",
                    "#define " +
                    self.pluginId +
                    "_VERSION_PATCH "]
                outStr = []
                idx = 0
                for line in lines:
                    if (idx < 3 and splitStr[idx] in line):
                        parts = line.split(splitStr[idx])
                        line = line.replace(parts[-1], splits[idx] + "\n")
                        idx += 1
                    outStr.append(line)
                f.close()
            with open(self.mainFile, 'w') as f:
                f.write(''.join(outStr))

    def updatePackageFileVersion(self):
        if os.path.exists(self.packageFile):
            if(not self.package):
                with open(self.packageFile, 'w') as f:
                    self.package = json.load(f)
                    f.close()
            self.package["version"] = self.version
            with open(self.packageFile, 'w') as f:
                json.dump(self.package, f, indent=4)
                f.close()

    def updateCMakeListsFileVersion(self):
        if os.path.exists(self.cmakelistsFile):
            with open(self.cmakelistsFile, 'r') as f:
                outStr = f.read()
                lines = outStr.split("\n")
                for i, line in enumerate(lines):
                    if ("set (Version " in line):
                        lines[i] = f"set (Version {self.version})"
                        break
                f.close()

            with open(self.cmakelistsFile, 'w') as f:
                f.write('\n'.join(lines))
                f.close()

    def updateVersion(self):
        self.updateMainFileVersion()
        self.updatePackageFileVersion()
        self.updateCMakeListsFileVersion()

    def createMain(self, addAllowed='y'):
        if (not self.isManifest()):
            self.createManifest()
        with open('./Templates/main.cpp') as f:
            mainStr = f.read()
            mainStr = mainStr.replace('HEADER', self.header)
            mainStr = mainStr.replace('PLUGINID', self.pluginId)
            if (not self.checkVersionFormat(self.version)):
                self.version = '0.0.0'
            version = self.version.split(".")
            pluginVersionMajor = version[0]
            pluginVersionMinor = version[1]
            pluginVersionPatch = version[2]

            mainStr = mainStr.replace('PLUGINVERSIONMAJOR', pluginVersionMajor)
            mainStr = mainStr.replace('PLUGINVERSIONMINOR', pluginVersionMinor)
            mainStr = mainStr.replace('PLUGINVERSIONPATCH', pluginVersionPatch)
            splits = mainStr.split("----------------")
            includesAPIStr = None
            pluginAPIStr = None
            for i, split in enumerate(splits):
                if ("PLUGINAPI" in split and "APIMANAGER" in split):
                    if (not pluginAPIStr):
                        pluginAPIStr = self.createHandlers(split)
                    splits[i] = splits[i].replace(split, pluginAPIStr)
                if ("INCLUDESAPI" in split):  # must always be called first
                    if (not includesAPIStr):
                        includesAPIStr = self.getIncludeStr(split, addAllowed)
                    splits[i] = splits[i].replace(split, includesAPIStr)

            mainStr = ''.join(splits)
            f.close()
        with open(self.mainFile, 'w') as f:
            f.write(mainStr)
            f.close()
        return True

    def globNames(self):
        if (self.isMainDirectory()):
            files = os.listdir(self.pluginDirectory)
            for file in files:
                if (".h" in file):
                    if (("MediaHandler" in file or "ChatHandler" in file)):
                        name = file.replace(".h", "")
                        name = name.replace("MediaHandler", "")
                        name = name.replace("ChatHandler", "")
                        self.names.append(name)
                    if ("MediaHandler" in file):
                        self.apis.append(PLUGINS_APIS["MEDIA_HANDLER"])
                    elif ("ChatHandler" in file):
                        self.apis.append(PLUGINS_APIS["CHAT_HANDLER"])
                    if ("Subscriber" in file):
                        if ("Video" in file):
                            self.dataTypes.append(DATA_TYPES["VIDEO"])
                        elif ("Audio" in file):
                            self.dataTypes.append(DATA_TYPES["AUDIO"])
                        elif ("Chat" in file):
                            self.dataTypes.append(DATA_TYPES["TEXT"])

    def createHandlers(self, split):
        if (len(self.names) == 0):
            return ""
        createStr = ""
        for i, name in enumerate(self.names):
            if (self.apis[i] == PLUGINS_APIS["MEDIA_HANDLER"]):
                temp = split.replace("PLUGINAPI", f"{name}MediaHandler")
                temp = temp.replace("APIMANAGER", "CallMediaHandlerManager")
                temp = temp.replace("CHATHANDLER", "")
            elif (self.apis[i] == PLUGINS_APIS["CHAT_HANDLER"]):
                temp = split.replace("PLUGINAPI", f"{name}ChatHandler")
                temp = temp.replace("APIMANAGER", "ChatHandlerManager")
                temp = temp.replace("CHATHANDLER", "api, ")
            createStr += temp
        return createStr

    def getIncludeStr(self, split='', addAllowed='y'):
        includesStr = ""
        self.newNames = []
        while (addAllowed == "y" or addAllowed == "Y"):
            addAllowed = ''
            functionName = ""
            while(functionName == "" or functionName in self.names):
                functionName = input("\nEnter functionality name: ")
                functionName = pattern.sub('', functionName)
            apiType = ''
            while (apiType not in PLUGINS_APIS.values()):
                print(f"\nSelect an API for the \"{functionName}\" functionality.")
                print("\nAvailable APIs: ")
                print("(1) video during a call (Media Handler API)")
                print("(2) audio during a call (Media Handler API)")
                print("(3) chat messages (Chat Handler API)")
                print(
                    colored(
                        "For more information about the API, call help preferences.",
                        "yellow"))
                # or (2) to chat messages: ")
                apiType = input("\nEnter datatype number: ")
                if (apiType not in PLUGINS_APIS.values()):
                    print(colored(f"Invalid '{apiType}' datatype!", "red"))
                else:
                    self.dataTypes.append(list(DATA_TYPES.values())[int(apiType)-1])
                    if (apiType == PLUGINS_APIS["MEDIA_HANDLER_AUDIO"]):
                        apiType = PLUGINS_APIS["MEDIA_HANDLER"]
            functionName = functionName.capitalize()
            self.names.append(functionName)
            self.newNames.append(functionName)
            self.apis.append(apiType)
            while (addAllowed not in ['y', 'N', 'Y', 'n']):
                addAllowed = input("\nAdd another functionality? [y/N] ")
                if not addAllowed:
                    addAllowed = 'N'
                    break
        for j, item in enumerate(self.apis):
            temp = ''
            localNames = self.names.copy()
            if (item == PLUGINS_APIS["MEDIA_HANDLER"]):
                localNames[j] = self.names[j] + "MediaHandler"
                if (split):
                    temp = split.replace("INCLUDESAPI", localNames[j])
            elif (item == PLUGINS_APIS["CHAT_HANDLER"]):
                localNames[j] = self.names[j] + "ChatHandler"
                if (split):
                    temp = split.replace("INCLUDESAPI", localNames[j])
            includesStr += temp
        if (self.newNames != []):
            self.createAPIHeaderFiles()
            self.createAPIImplFiles()
        return includesStr

    def createAPIHeaderFiles(self):
        for j, item in enumerate(self.apis):
            if (self.names[j] in self.newNames):
                if (item == PLUGINS_APIS["MEDIA_HANDLER"]):
                    with open('./Templates/genericMediaHandler.h', 'r') as f:
                        data = f.read()
                        data = data.replace("HEADER", self.header)
                        data = data.replace("GENERIC", self.names[j])
                        data = data.replace("DATATYPE", self.dataTypes[j])
                        f.close()
                    with open(f"{self.pluginDirectory}/{self.names[j]}MediaHandler.h", 'w') as f:
                        f.write(data)
                        f.close()
                    with open('./Templates/genericMediaSubscriber.h', 'r') as f:
                        data = f.read()
                        data = data.replace("HEADER", self.header)
                        data = data.replace("GENERIC", self.names[j])
                        data = data.replace("DATATYPE", self.dataTypes[j])
                        f.close()
                    data = data.split("---")
                    for k, dataItem in enumerate(data):
                        if (f"{self.dataTypes[j]}INCLUDES" in dataItem):
                            tempString = data[k]
                            data[k] = ""
                            if (self.defaultStrings["genericmediasubscriber"]["header"][f"{self.dataTypes[j]}INCLUDES"]):
                                for string in self.defaultStrings["genericmediasubscriber"]["header"][f"{self.dataTypes[j]}INCLUDES"]:
                                    data[k] += tempString.replace(f"{self.dataTypes[j]}INCLUDES", string)
                        elif (f"{self.dataTypes[j]}PRIVATE" in dataItem):
                            tempString = data[k]
                            data[k] = ""
                            if (self.defaultStrings["genericmediasubscriber"]["header"][f"{self.dataTypes[j]}PRIVATE"]):
                                for string in self.defaultStrings["genericmediasubscriber"]["header"][f"{self.dataTypes[j]}PRIVATE"]:
                                    data[k] += tempString.replace(f"{self.dataTypes[j]}PRIVATE", string)
                    data = "".join(data)
                    with open(f"{self.pluginDirectory}/{self.names[j]}{self.dataTypes[j]}Subscriber.h", 'w') as f:
                        f.write(data)
                        f.close()
                elif (item == PLUGINS_APIS["CHAT_HANDLER"]):
                    with open('./Templates/genericChatHandler.h', 'r') as f:
                        data = f.read()
                        data = data.replace("HEADER", self.header)
                        data = data.replace('GENERIC', self.names[j])
                        f.close()
                    with open(f"{self.pluginDirectory}/{self.names[j]}{self.dataTypes[j]}Handler.h", 'w') as f:
                        f.write(data)
                        f.close()
                    with open('./Templates/genericChatSubscriber.h', 'r') as f:
                        data = f.read()
                        data = data.replace("HEADER", self.header)
                        data = data.replace("GENERIC", self.names[j])
                        f.close()
                    with open(f"{self.pluginDirectory}/{self.names[j]}{self.dataTypes[j]}Subscriber.h", 'w') as f:
                        f.write(data)
                        f.close()

    def createAPIImplFiles(self):
        for j, item in enumerate(self.apis):
            if (self.names[j] in self.newNames):
                if (item == PLUGINS_APIS["MEDIA_HANDLER"]):
                    with open('./Templates/genericMediaHandler.cpp', 'r') as f:
                        data = f.read()
                        data = data.replace("HEADER", self.header)
                        data = data.replace("PLUGINID", self.pluginId)
                        data = data.replace("GENERIC", self.names[j])
                        data = data.replace("DATATYPE", self.dataTypes[j])
                        data = data.replace("DataType", self.dataTypes[j].lower())
                        f.close()
                    with open(f"{self.pluginDirectory}/{self.names[j]}MediaHandler.cpp", 'w') as f:
                        f.write(data)
                        f.close()
                    with open('./Templates/genericMediaSubscriber.cpp', 'r') as f:
                        data = f.read()
                        data = data.replace("HEADER", self.header)
                        data = data.replace("GENERIC", self.names[j])
                        data = data.replace("DATATYPE", self.dataTypes[j])
                        f.close()
                    data = data.split("---")
                    for k, dataItem in enumerate(data):
                        if (f"FFMPEG{self.dataTypes[j]}INCLUDES" in dataItem):
                            tempString = data[k]
                            tempStringSplits = tempString.split("\n")[1:]
                            data[k] = ""
                            if (self.defaultStrings["genericmediasubscriber"]["impl"][f"FFMPEG{self.dataTypes[j]}INCLUDES"]):
                                for string in self.defaultStrings["genericmediasubscriber"]["impl"][f"FFMPEG{self.dataTypes[j]}INCLUDES"]:
                                    data[k] += tempStringSplits[1].replace(f"FFMPEG{self.dataTypes[j]}INCLUDES", string) + "\n"
                                tempStringSplits[1] = data[k]
                                data[k] = tempStringSplits[0] + "\n" + tempStringSplits[1] + tempStringSplits[2]
                        elif (f"{self.dataTypes[j]}INCLUDES" in dataItem):
                            tempString = data[k]
                            data[k] = ""
                            if (self.defaultStrings["genericmediasubscriber"]["impl"][f"{self.dataTypes[j]}INCLUDES"]):
                                for string in self.defaultStrings["genericmediasubscriber"]["impl"][f"{self.dataTypes[j]}INCLUDES"]:
                                    data[k] += tempString.replace(f"{self.dataTypes[j]}INCLUDES", string)
                        elif (f"{self.dataTypes[j]}UPDATE" in dataItem):
                            fileName = self.defaultStrings["genericmediasubscriber"]["impl"][f"{self.dataTypes[j]}UPDATE"]
                            with open(f"./Templates/{fileName}") as updateFile:
                                updateTxt = updateFile.read()
                                updateFile.close()
                            data[k] = data[k].replace(f"{self.dataTypes[j]}UPDATE", updateTxt)
                            
                    data = "".join(data)
                    with open(f"{self.pluginDirectory}/{self.names[j]}{self.dataTypes[j]}Subscriber.cpp", 'w') as f:
                        f.write(data)
                        f.close()
                elif (item == PLUGINS_APIS["CHAT_HANDLER"]):
                    with open('./Templates/genericChatHandler.cpp', 'r') as f:
                        data = f.read()
                        data = data.replace("HEADER", self.header)
                        data = data.replace("GENERIC", self.names[j])
                        f.close()
                    with open(f"{self.pluginDirectory}/{self.names[j]}{self.dataTypes[j]}Handler.cpp", 'w') as f:
                        f.write(data)
                        f.close()
                    with open('./Templates/genericChatSubscriber.cpp', 'r') as f:
                        data = f.read()
                        data = data.replace("HEADER", self.header)
                        data = data.replace("GENERIC", self.names[j])
                        f.close()
                    with open(f"{self.pluginDirectory}/{self.names[j]}{self.dataTypes[j]}Subscriber.cpp", 'w') as f:
                        f.write(data)
                        f.close()
        self.createPreferences(self.names)
        self.setRuntimePreferences()

    def setRuntimePreferences(self):
        for j, item in enumerate(self.apis):
            baseStr1 = ''
            baseStr2 = ''
            if (len(self.newNames) > 0 and self.names[j] in self.newNames):
                if (item == PLUGINS_APIS["MEDIA_HANDLER"]):
                    with open(f"{self.pluginDirectory}/{self.names[j]}MediaHandler.cpp", 'r') as f:
                        data = f.read()
                        parts = data.split("----------------")
                        for part in parts:
                            if "PREFERENCE1" in part:
                                baseStr1 = part
                            if "PREFERENCE2" in part:
                                baseStr2 = part
                        newStr1 = ''
                        newStr2 = ''
                        for preference in self.preferences:
                            if (self.names[j] in preference['scope']):
                                editable = ''
                                while(editable not in ['y', 'Y', 'n', 'N']):
                                    editable = input(
                                        f"\nAllow the {preference['title']} preference to change at runtime\nfor the {self.names[j]} functionality? [y/n] ")
                                if (editable == 'y' or editable == 'Y'):
                                    newStr1 += baseStr1.replace(
                                        "PREFERENCE1", preference['key'])
                                    newStr2 += baseStr2.replace(
                                        "PREFERENCE2", preference['key'])
                        data = data.replace(baseStr1, newStr1)
                        data = data.replace(baseStr2, newStr2)
                        f.close()
                    with open(f"{self.pluginDirectory}/{self.names[j]}MediaHandler.cpp", 'w') as f:
                        parts = data.split("----------------")
                        f.write(''.join(parts))
                        f.close()
                elif (item == PLUGINS_APIS["CHAT_HANDLER"]):
                    with open(f"{self.pluginDirectory}/{self.names[j]}ChatHandler.cpp", 'r') as f:
                        data = f.read()
                        parts = data.split("----------------")
                        for part in parts:
                            if "PREFERENCE1" in part:
                                baseStr1 = part
                            if "PREFERENCE2" in part:
                                baseStr2 = part
                        newStr1 = ''
                        newStr2 = ''
                        for preference in self.preferences:
                            if (self.names[j] in preference['scope']):
                                editable = ''
                                while(editable not in ['y', 'Y', 'n', 'N']):
                                    editable = input(
                                        f"\nAllow the {preference['title']} preference to change at runtime\nfor the {self.names[j]} functionality? [y/n] ")
                                if (editable == 'y' or editable == 'Y'):
                                    newStr1 += baseStr1.replace(
                                        "PREFERENCE1", preference['key'])
                                    newStr2 += baseStr2.replace(
                                        "PREFERENCE1", preference['key'])
                        data = data.replace(baseStr1, newStr1)
                        data = data.replace(baseStr2, newStr2)
                        f.close()
                    with open(f"{self.pluginDirectory}/{self.names[j]}ChatHandler.cpp", 'w') as f:
                        parts = data.split("----------------")
                        f.write(''.join(parts))
                        f.close()

    def createFunctionality(self):
        if (not self.isManifest()):
            print("\nBefore creating a functionality, the manifest must be defined.")
            self.createManifest()
            print("\nManifest OK, continuing functionality creation.")
        self.getIncludeStr()
        self.createMain(addAllowed='n')
        self.createBuildFiles()

    def modifyManifest(self, action):
        if (self.modifyManifestInternal(action)):
            self.updateVersion()

    def createPackageJson(self):
        if (not self.isManifest()):
            print("\nBefore creating a package, the manifest must be defined.")
            self.createManifest()
            print("\nManifest OK, continuing package creation.")
        with open("./Templates/package.json") as f:
            self.package = json.load(f)
            self.package["id"] = self.pluginId
            self.package["name"] = self.pluginName
            self.package["version"] = self.version
            self.package["iconPath"] = self.pluginIcon
            self.package["backgroundPath"] = self.pluginBackground
            if (not self.checkVersionFormat(self.version)):
                self.package["version"] = '0.0.0'
            f.close()

        for api in self.apis:
            if api == PLUGINS_APIS["MEDIA_HANDLER"]:
                for dep in self.defaultStrings["package.json"]["MediaHandler"]["deps"]:
                    if dep not in self.package["deps"]:
                        self.package["deps"].append(dep)
        with open(f"{self.pluginDirectory}/package.json", 'w') as f:
            json.dump(self.package, f, indent=4)
            f.close()

        print("\nPackage OK.")

    def globFiles(self, baseStr, key, ext):
        import glob
        files = glob.glob(f"{self.pluginDirectory}/**.{ext}", recursive=True)
        outputStr = ""
        for item in files:
            name = os.path.split(item)[1]
            outputStr += baseStr.replace(key, name)
        return outputStr

    def fillBuildFile(self, inputStr):
        inputStr = inputStr.replace('PLUGINID', self.pluginId)
        inputStr = inputStr.replace('MANIFESTVERSION', self.version)
        splits = inputStr.split('---')
        tempPart = []
        for i, split in enumerate(splits):
            if ("FFMPEG" in split
                    and PLUGINS_APIS['MEDIA_HANDLER'] not in self.apis):
                splits[i] = ''
            elif ("CPPFILENAME" in split):
                splits[i] = self.globFiles(split, "CPPFILENAME", "cpp")
            elif ("HFILENAME" in split):
                splits[i] = self.globFiles(split, "HFILENAME", "h")
            elif ("FFMPEGEXTRA" in split):
                splits[i] = splits[i].replace("FFMPEGEXTRA", "")
            elif ("FFMPEGCPP" in split):
                tempString = splits[i]
                splits[i] = ""
                for item in self.defaultStrings["buildFiles"]["MediaHandler"][f"{self.ffmpegBuildOption}FFMPEGCPP"]:
                    splits[i] += tempString.replace("FFMPEGCPP", item)
            elif ("FFMPEGH" in split):
                tempString = splits[i]
                splits[i] = ""
                for item in self.defaultStrings["buildFiles"]["MediaHandler"][f"{self.ffmpegBuildOption}FFMPEGH"]:
                    splits[i] += tempString.replace("FFMPEGH", item)
            elif ("FFMPEGLIBS" in split):
                tempString = splits[i]
                splits[i] = ""
                for item in self.defaultStrings["buildFiles"]["MediaHandler"][f"{self.ffmpegBuildOption}FFMPEGLIBS"]:
                    splits[i] += tempString.replace("FFMPEGLIBS", f"{item} ")
        inputStr = ''.join(splits)
        return inputStr

    def createBuildFiles(self):
        self.ffmpegBuildOption = None
        for typeItem in self.dataTypes:
            if (typeItem == DATA_TYPES["VIDEO"]):
                self.ffmpegBuildOption = 'Video'
                break
            elif (typeItem == DATA_TYPES["AUDIO"]):
                self.ffmpegBuildOption = 'Audio'
        with open("./Templates/CMakeLists.txt", 'r') as f:
            cmakelists = f.read()
            f.close()
        cmakelists = self.fillBuildFile(cmakelists)
        with open(self.cmakelistsFile, 'w') as f:
            f.write(cmakelists)
            f.close()
        print("\nCMakeLists.txt OK.")
        return
