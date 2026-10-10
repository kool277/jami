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

# This script must unify the Plugins build for
# every project and Operational System

import os
import sys
import json
import platform
import argparse
import subprocess
import multiprocessing

IOS_DISTRIBUTION_NAME = "ios"
OSX_DISTRIBUTION_NAME = "osx"
ANDROID_DISTRIBUTION_NAME = "android"
WIN32_DISTRIBUTION_NAME = "win32"
UBUNTU_DISTRIBUTION_NAME = "ubuntu"

def parse():
    parser = argparse.ArgumentParser(description='Builds Plugins projects')
    parser.add_argument('--projects', type=str,
                        help='Select plugins to be built.')
    parser.add_argument('--distribution')
    parser.add_argument('--processor', type=str, default="GPU",
                        help='Runtime plugin CPU/GPU setting.')
    parser.add_argument('--buildOptions', default='', type=str,
                        help="Type all build options to pass to package.json 'defines' property.\nThis argument consider that you're using cmake.")
    parser.add_argument('--arch', type=str, default=None,
                        help='Specify the architecture (arm64 or x86_64).')

    dist = choose_distribution()


    args = parser.parse_args()
    args.projects = args.projects.split(',')
    args.processor = args.processor.split(',')

    if (args.distribution is not None):
        args.distribution = args.distribution.lower()
    else:
        args.distribution = dist

    if (len(args.processor) == 1):
        args.processor *= len(args.projects)

    validate_args(args)

    return args


def validate_args(parsed_args):
    """Validate the args values, exit if error is found"""

    # Filter unsupported distributions.
    supported_distros = [
        ANDROID_DISTRIBUTION_NAME, UBUNTU_DISTRIBUTION_NAME,
        WIN32_DISTRIBUTION_NAME, OSX_DISTRIBUTION_NAME
    ]

    if parsed_args.distribution not in supported_distros:
        print('Distribution \'{0}\' not supported.\nChoose one of: {1}'.format(
            parsed_args.distribution, ', '.join(supported_distros)
        ))
        sys.exit(1)

    if (len(parsed_args.processor) != len(parsed_args.projects)):
        sys.exit('Processor must be single or the same size as projects.')

    for processor in parsed_args.processor:
        if (processor not in ['GPU', 'CPU']):
            sys.exit('Processor can only be GPU or CPU.')

    if (parsed_args.buildOptions):
        parsed_args.buildOptions = parsed_args.buildOptions.split(',')

    valid_archs = ['arm64', 'x86_64', None]
    if parsed_args.arch not in valid_archs:
        sys.exit(f"Invalid architecture: {parsed_args.arch}. Must be one of {valid_archs}")


def choose_distribution():
    system = platform.system().lower()

    if system == "linux" or system == "linux2":
        if os.path.isfile("/etc/arch-release"):
            return "arch"
        with open("/etc/os-release") as f:
            for line in f:
                k, v = line.split("=")
                if k.strip() == 'ID':
                    return v.strip().replace('"', '').split(' ')[0]
    elif system == "darwin":
        return OSX_DISTRIBUTION_NAME
    elif system == "windows":
        return WIN32_DISTRIBUTION_NAME

    return 'Unknown'


def buildPlugin(pluginPath, distribution):
    # Change the current working directory to pluginPath
    os.chdir(pluginPath)

    if distribution == ANDROID_DISTRIBUTION_NAME:
        android_abi = os.environ.get('ANDROID_ABI', 'arm64-v8a')
        build_dir = f'build-{android_abi}'
    else:
        android_abi = None
        build_dir = 'build-local'

    if not os.path.exists(build_dir):
        os.mkdir(build_dir)
    else:
        cmake_cache = os.path.join(build_dir, 'CMakeCache.txt')
        if os.path.exists(cmake_cache):
            os.remove(cmake_cache)

    os.chdir(build_dir)

    if distribution == ANDROID_DISTRIBUTION_NAME:
        ndk_path = os.environ.get('ANDROID_NDK', '/opt/android/ndk/26.3.11579264')
        toolchain = os.path.join(ndk_path, 'build/cmake/android.toolchain.cmake')
        os.system(f'cmake .. -DCMAKE_TOOLCHAIN_FILE={toolchain} -DANDROID_ABI={android_abi} -DANDROID_PLATFORM=android-24 -DANDROID_STL=c++_shared')
    else:
        os.system('cmake ..')

    # Run the cmake build command
    os.system('cmake --build .')

def main():
    args = parse()
    currentDir = os.getcwd()

    for i, plugin in enumerate(args.projects):
        os.chdir(currentDir + "/" + plugin)
        buildPlugin(currentDir + "/" + plugin, args.distribution)

if __name__ == "__main__":
    main()
