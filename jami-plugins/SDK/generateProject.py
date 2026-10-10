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

from utils import *


def runoption(action):
    if(initializeClasses(action)):
        if (action == ACTIONS["CREATE"]):
            runFullCreation()
        elif (action == ACTIONS["CREATE_FUNCTIONALITY"]):
            modifyFunctionality(action)
        elif (action == ACTIONS["CREATE_MAIN"]):
            getSkeletonSourceFiles().createMain(addAllowed='n')
        elif (action == ACTIONS["CREATE_PREFERENCES"] or action == ACTIONS["DELETE_PREFERENCES"]):
            modifyPreferences(action)
        elif (action == ACTIONS["CREATE/MODIFY_MANIFEST"] or action == ACTIONS["DELETE_MANIFEST"]):
            getSkeletonSourceFiles().modifyManifest(action)
        elif (action == ACTIONS["CREATE_PACKAGE_JSON"]):
            getSkeletonSourceFiles().createPackageJson()
        elif (action == ACTIONS["DELETE"]):
            delete()
        elif (action == ACTIONS["PREASSEMBLE"]):
            from jplManipulation import preAssemble
            preAssemble(getSkeletonSourceFiles().pluginId)
        elif (action == ACTIONS["BUILD"]):
            from jplManipulation import build
            build(getSkeletonSourceFiles().pluginId)
        elif (action == ACTIONS["ASSEMBLE"]):
            from jplManipulation import assemble
            assemble(getSkeletonSourceFiles().pluginId)
        elif (action == ACTIONS["CREATE_BUILD_FILES"]):
            getSkeletonSourceFiles().createBuildFiles()


def delete():
    getSkeletonSourceFiles().delete()


def modifyPreferences(action):
    if (action == ACTIONS["DELETE_PREFERENCES"]):
        getSkeletonSourceFiles().deletePreference()
    elif (action == ACTIONS["CREATE_PREFERENCES"]):
        getSkeletonSourceFiles().createPreferences(getSkeletonSourceFiles().names)


def runFullCreation():
    getSkeletonSourceFiles().createManifest()
    getSkeletonSourceFiles().createMain()
    getSkeletonSourceFiles().createPackageJson()
    getSkeletonSourceFiles().createBuildFiles()


def modifyFunctionality(action):
    if (action == ACTIONS["CREATE_FUNCTIONALITY"]):
        getSkeletonSourceFiles().createFunctionality()
