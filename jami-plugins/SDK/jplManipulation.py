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
import shutil
import typing
import argparse
import platform
import subprocess
from zipfile import ZipFile

from sdkConstants import OS_IDS


def getSystem():
    system = platform.system().lower()
    if system == "linux" or system == "linux2":
        return OS_IDS["Linux"]
    elif system == "darwin":
        return OS_IDS["Darwin"]
    elif system == "windows":
        return OS_IDS["Windows"]
    sys.exit("Plugins SDK not supported on this system")


def getJpls():
    filePaths = input("\nInput jpls path you want to merge:\n")
    filePaths = filePaths.replace(' ', ',').replace(",,", ',')
    filePaths = filePaths.split(',')
    if (len(filePaths) > 0):
        print("\nJpl files to merge:")
    for filePath in filePaths:
        print(filePath)
    return filePaths


def checkValidityJpls(filePaths):
    for filePath in filePaths:
        if (not os.path.exists(filePath) or not filePath.endswith(".jpl")):
            return False
    return True


class JPLStructure:
    def __init__(self, paths, output = "", is_merge = True):
        self.paths = paths
        self.outputName = output
        self.pluginNames = []
        self.ZipObjcts: typing.Dict[str, list[ZipFile]] = {}
        if is_merge:
            self.getOutName()
        self.discoverJPLs()
        if is_merge:
            self.mergeJPLs()

    def getOutName(self):
        while (not self.outputName or not self.outputName.endswith(".jpl")):
            self.outputName = input("\nWhere to save the resulting JPL? ")
        self.OutObj = ZipFile(self.outputName, 'w')

    def discoverJPLs(self):
        for path in self.paths:
            name = os.path.split(path)[0].split('.')[0]
            self.pluginNames.append(name)
            self.ZipObjcts[path] = []
            self.ZipObjcts[path].append(ZipFile(path, 'r'))
        return

    def mergeJPLs(self):
        self.fileNames = []
        for path in self.paths:
            [obj] = self.ZipObjcts[path]
            for item in obj.filelist:
                if item.filename not in self.fileNames:
                    self.OutObj.writestr(item, obj.open(item).read())
                    self.fileNames.append(item.filename)
        self.OutObj.close()


def onerror(func, path, exc_info):
    """
    Error handler for ``shutil.rmtree``.

    If the error is due to an access error (read only file)
    it attempts to add write permission and then retries.

    If the error is for another reason it re-raises the error.

    Usage : ``shutil.rmtree(path, onerror=onerror)``
    """
    import stat
    if not os.access(path, os.W_OK):
        # Is the error an access error ?
        os.chmod(path, stat.S_IWUSR)
        func(path)
    else:
        raise


def preAssemble(pluginId, distribution='', arch='', dataSubdir=None, buildDir=None):
    localSystem = getSystem()
    root = os.path.dirname(os.path.abspath(__file__)) + "/.."

    osBuildPath = "build-local"
    if localSystem == OS_IDS["Linux"]:
        if (distribution != 'android'):
            distribution = "x86_64-linux-gnu"
    elif localSystem == OS_IDS["Darwin"]:
        distribution = f"{arch}-apple-Darwin"
    elif localSystem == OS_IDS["Windows"]:
        distribution = "x64-windows"
        osBuildPath = "msvc"

    if buildDir:
        # Out-of-tree build: all paths are absolute, derived from CMAKE_BINARY_DIR.
        jplBase = buildDir
        sourceDir = os.path.join(root, pluginId)
        chDir = False
    else:
        # Legacy in-tree build: navigate relative to CWD.
        chDir = False
        if (osBuildPath in os.getcwd()):
            chDir = True
            os.chdir("./../")
        jplBase = f"./../{pluginId}/{osBuildPath}"
        sourceDir = f"./../{pluginId}"
        if not os.path.exists(jplBase):
            os.mkdir(jplBase)

    jplDir = os.path.join(jplBase, "jpl")

    if os.path.exists(jplDir):
        shutil.rmtree(jplDir, onerror=onerror)
    os.makedirs(os.path.join(jplDir, "lib"), exist_ok=True)
    if (distribution != 'android'):
        os.makedirs(os.path.join(jplDir, "lib", distribution), exist_ok=True)
    else:
        if ("ANDROID_ABI" in os.environ.keys()):
            for abi in os.environ["ANDROID_ABI"].split(' '):
                os.makedirs(os.path.join(jplDir, "lib", abi), exist_ok=True)

    if dataSubdir is None:
        dataSubdir = []
    if dataSubdir:
        # dataSubdir is a list of paths relative to data/ (e.g. ["models/nllb200"]).
        # Copy data/ skipping all top-level parent dirs that have selected entries,
        # then copy only the selected subdirectories. This avoids staging gigabytes
        # of unused files.
        parent_dirs = {s.split('/')[0] for s in dataSubdir}
        shutil.copytree(os.path.join(sourceDir, "data"),
                        os.path.join(jplDir, "data"),
                        ignore=shutil.ignore_patterns(*parent_dirs))
        for sub in dataSubdir:
            src_sub = os.path.join(sourceDir, "data", sub)
            dst_sub = os.path.join(jplDir, "data", sub)
            if os.path.exists(src_sub):
                shutil.copytree(src_sub, dst_sub)
    else:
        shutil.copytree(os.path.join(sourceDir, "data"),
                        os.path.join(jplDir, "data"))
    _manifest_src = os.path.join(sourceDir, "manifest.json")
    if os.path.exists(_manifest_src):
        shutil.copyfile(_manifest_src, os.path.join(jplDir, "manifest.json"))
    elif not os.path.exists(os.path.join(sourceDir, "manifest.json.in")):
        # Only warn when there's no .in template — plugins with configure_file
        # handle manifest copying via a separate cmake -E copy command.
        print(f"Warning: {_manifest_src} not found — JPL will have no manifest.json",
              file=sys.stderr)
    if os.path.exists(os.path.join(sourceDir, "data", "preferences.json")):
        shutil.copyfile(
            os.path.join(sourceDir, "data", "preferences.json"),
            os.path.join(jplDir, "data", "preferences.json"))
    if chDir:
        os.chdir(f"./{osBuildPath}")


def assemble(pluginId, extraPath='', distribution='', arch='', buildDir=None):
    extraPath = '/' + extraPath
    localSystem = getSystem()
    root = os.path.dirname(os.path.abspath(__file__)) + "/.."
    osBuildPath = "build-local"

    if localSystem == OS_IDS["Linux"]:
        if (distribution != 'android'):
            distribution = "x86_64-linux-gnu"
    elif localSystem == OS_IDS["Darwin"]:
        distribution = f"{arch}-apple-Darwin"
    elif localSystem == OS_IDS["Windows"]:
        distribution = "x64-windows"
        osBuildPath = 'msvc'
    if (not os.path.exists(f"{root}/build")):
        os.mkdir(f"{root}/build")
    if (not os.path.exists(f"{root}/build/{distribution}")):
        os.mkdir(f"{root}/build/{distribution}")
    if (not os.path.exists(f"{root}/build/{distribution}{extraPath}")):
        os.mkdir(f"{root}/build/{distribution}{extraPath}")
    if (os.path.exists(f"./../build/{pluginId}.jpl")):
        os.remove(f"./../build/{pluginId}.jpl")

    outputJPL = f"{root}/build/{distribution}{extraPath}/{pluginId}.jpl"
    if buildDir:
        outputBuild = os.path.join(buildDir, "jpl")
    else:
        outputBuild = f"{root}/{pluginId}/{osBuildPath}/jpl"

    with ZipFile(outputJPL, 'w') as zipObj:
        for folderName, subfolders, filenames in os.walk(outputBuild):
            for filename in filenames:
                filePath = os.path.join(folderName, filename)
                arcname = os.path.relpath(filePath, outputBuild).replace('\\', '/')
                zipObj.write(filePath, arcname)


def build(pluginId):
    currentDir = os.getcwd()
    os.chdir('./../')
    subprocess.run([
        sys.executable, os.path.join(
            os.getcwd(), "build-plugin.py"),
        "--projects", pluginId
    ], check=True)
    os.chdir(currentDir)


def parser():
    parser = argparse.ArgumentParser(description='Build some plugins.')
    parser.add_argument('--plugin', type=str,
                        help='Name of plugin to be built')
    parser.add_argument('--extraPath', type=str, default="",
                        help='output intermediate Path')
    parser.add_argument('--distribution', type=str, default='',
                        help="GNU/Linux or Windows, leave empty. Android, type android")
    parser.add_argument('--arch', type=str,
                        help='Specify the architecture (x86_64, arm64).')

    # to build or not to build
    parser.add_argument('--build', action='store_true')

    # to preassemble or not
    parser.add_argument('--preassemble', action='store_true')
    parser.add_argument('--data-subdir', nargs='*', default=[],
                        help='Only stage these subdirectories of data/ (e.g. models/nllb200 voices/en)')

    # to assemble jpl or not
    parser.add_argument('--assemble', action='store_true')

    parser.add_argument('--build-dir', type=str, default=None,
                        help='CMake binary directory (PROJECT_BINARY_DIR) for out-of-tree builds.')

    # to assemble jpl or not
    parser.add_argument('--merge', action='store_true')

    # to merge two or more jpl
    parser.add_argument('--path', nargs='*', required=False,
                        help="Jpl full path")
    parser.add_argument('--output', type=str, default='',
                        help="Jpl output full path")

    args = parser.parse_args()
    return args


def main():
    args = parser()

    if args.preassemble:
        preAssemble(args.plugin, args.distribution, args.arch, args.data_subdir, args.build_dir)
    if (args.build):
        build(args.plugin)
    if (args.assemble):
        assemble(args.plugin, args.extraPath, args.distribution, args.arch, args.build_dir)
    if (args.merge):
        JPLStructure(args.path, args.output)


if __name__ == '__main__':
    main()
