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

import cmd
import sys
from termcolor import colored, cprint

from generateProject import *
from jplManipulation import *

os.chdir("./SDK")


def mainRun(action):
    runoption(action)


class JamiPluginsSDKShell(cmd.Cmd):
    intro = colored(
        "\nWelcome to the Jami Plugins SDK shell.    Type help or ? to list commands.\n",
        "green")
    prompt = colored('(Jami Plugins SDK) ', "yellow")
    file = None

    # ----- basic Jami Plugins SDK commands -----
    # ---- BUILD ----
    def help_build(self):
        helperFile = './Docs/buildHelper.txt'
        with open(helperFile) as f:
            helperText = f.read()
            f.close()
        print(helperText)

    def do_build(self, arg):
        if (arg == '-def'):
            runoption(ACTIONS["CREATE_BUILD_FILES"])
        else:
            runoption(ACTIONS["BUILD"])

    # ---- JPL MANIPULATION ----
    def help_merge(self):
        helperFile = './Docs/jplMergeHelper.txt'
        with open(helperFile) as f:
            helperText = f.read()
            f.close()
        print(helperText)

    def do_merge(self, arg):
        filePaths = getJpls()
        if (len(filePaths) < 2 or not checkValidityJpls(filePaths)):
            print(
                colored(
                    "Invalid file(s).\nTwo or more valid jpl files are required to merge.\n",
                    "red"))
            return
        JPLStructure(filePaths)
        return

    def help_assemble(self):
        helperFile = './Docs/jplAssembleHelper.txt'
        with open(helperFile) as f:
            helperText = f.read()
            f.close()
        print(helperText)

    def do_assemble(self, arg):
        if (arg == '-pre'):
            runoption(ACTIONS["PREASSEMBLE"])
        else:
            runoption(ACTIONS["ASSEMBLE"])
        return

    # ---- FULL PIPELINE ----
    def help_plugin(self):
        helperFile = './Docs/pipelineHelper.txt'
        with open(helperFile) as f:
            helperText = f.read()
            f.close()
        print(helperText)

    def do_plugin(self, arg):
        mainRun(ACTIONS["CREATE"])

    # ---- MAIN ----
    def help_main(self):
        helperFile = './Docs/mainHelper.txt'
        with open(helperFile) as f:
            helperText = f.read()
            f.close()
        print(helperText)

    def do_main(self, args):
        mainRun(ACTIONS["CREATE_MAIN"])

    # ---- FUNCTIONALITY ----
    def help_functionality(self):
        helperFile = './Docs/functionalityHelper.txt'
        with open(helperFile) as f:
            helperText = f.read()
            f.close()
        print(helperText)

    def do_functionality(self, args):
        mainRun(ACTIONS["CREATE_FUNCTIONALITY"])

    # ---- PACKAGE ----
    def help_package(self):
        helperFile = './Docs/packageHelper.txt'
        with open(helperFile) as f:
            helperText = f.read()
            f.close()
        print(helperText)

    def do_package(self, args):
        mainRun(ACTIONS["CREATE_PACKAGE_JSON"])

    # ---- PREFERENCES ----
    def help_preference(self, args=''):
        helperFile = "./Docs/preferenceHelper.txt"
        if (PREFERENCES_TYPES[0].lower() in args):  # List - 0
            helperFile = "./Docs/preferenceList.txt"
        elif (PREFERENCES_TYPES[1].lower() in args):  # Path - 1
            helperFile = "./Docs/preferencePath.txt"

        with open(helperFile) as f:
            helpText = f.read()
            f.close()
        print(helpText)

    def do_preference(self, arg):
        if ("-h" in arg):
            self.help_preference(arg.replace("-h", ""))
        elif ("-del" in arg):
            mainRun(ACTIONS["DELETE_PREFERENCES"])
        else:
            mainRun(ACTIONS["CREATE_PREFERENCES"])

    # ---- MANIFEST ----
    def help_manifest(self):
        helperFile = './Docs/manifestHelper.txt'
        with open(helperFile) as f:
            helperText = f.read()
            f.close()
        print(helperText)

    def do_manifest(self, arg):
        if (arg == "-del"):
            mainRun(ACTIONS["DELETE_MANIFEST"])
        else:
            mainRun(ACTIONS["CREATE/MODIFY_MANIFEST"])

    # ---- PLUGIN DELETION ----
    def do_delete(self, arg):
        'Select Extension to delete: DELETE'
        print("\nUnable to delete the extension(s)/folder(s): ")
        print(colored(FORBIDDEN_NAMES[:-1], "yellow"))
        mainRun(ACTIONS["DELETE"])

    # ---- EXIT ----
    def do_exit(self, arg):
        'Stop Jami Plugin SDK, and exit: EXIT'
        print('Thank you for using the Jami Plugin SDK')
        return True

    # ----- clear shell -----
    def do_clear(self, arg):
        'Clear your prompt: CLEAR'
        os.system("clear")
        print(self.intro)

    def precmd(self, line):
        line = line.lower()
        if line == 'eof':
            return ('exit')
        return line


if __name__ == '__main__':
    os.system('clear')
    JamiPluginsSDKShell().cmdloop()
